import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bucketLabel, type Period } from "@/lib/period";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadStatusChartColors,
  stageChartColors,
  type LeadSourceValue,
  type LeadStatusValue,
} from "@/lib/labels";

/** Сделка считается зависшей, если открыта и не менялась дольше этого числа дней. */
export const STUCK_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

const num = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? 0 : Number(v.toString()));

export type StageStat = { id: string; code: string; name: string; count: number; sum: number; color: string };
export type FunnelStage = { name: string; code: string; color: string; sum: number; count: number };
export type StageTrend = { name: string; code: string; color: string; values: number[]; counts: number[] };

export type AttentionDeal = {
  id: string;
  title: string;
  account: string;
  stage: string;
  amount: number;
  /** Сколько дней сделка не менялась, если это больше порога STUCK_DAYS. */
  stuckDays: number | null;
  overdueTasks: { id: string; body: string; dueDate: Date | null }[];
};

export type LeadStatusStat = { status: LeadStatusValue; count: number; budget: number; color: string };
export type LeadSourceStat = { source: LeadSourceValue; count: number; budget: number };

/**
 * Все показатели считаются на сервере запросами Prisma groupBy / aggregate / count
 * при каждом открытии страницы. Возвращаются только простые числа и строки.
 */
export async function getDashboardData(period: Period) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY);
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * DAY);

  const inPeriod = { gte: period.from, lte: period.to };
  const overdueOnDeal = { type: "task", done: false, dueDate: { lt: startOfToday } } as const;
  const attentionFilter: Prisma.OpportunityWhereInput = { OR: [{ updatedAt: { lt: stuckBefore } }, { activities: { some: overdueOnDeal } }] };
  const openTask = { type: "task", done: false } as const;

  const [
    leadsByStatus,
    leadsBySource,
    newLeadsPeriod,
    convertedPeriod,
    openDeals,
    dealsByStage,
    closedInPeriod,
    wonInPeriod,
    stages,
    overdueCount,
    todayCount,
    recentLeads,
    attentionRows,
    attentionCount,
    bucketRows,
  ] = await Promise.all([
    db.lead.groupBy({ by: ["status"], _count: { _all: true }, _sum: { budget: true } }),
    db.lead.groupBy({ by: ["source"], _count: { _all: true }, _sum: { budget: true } }),
    db.lead.count({ where: { createdAt: inPeriod } }),
    db.lead.count({ where: { createdAt: inPeriod, status: "converted" } }),
    db.opportunity.aggregate({ where: { status: "open" }, _count: { _all: true }, _sum: { amount: true } }),
    db.opportunity.groupBy({ by: ["stageId"], _count: { _all: true }, _sum: { amount: true } }),
    db.opportunity.groupBy({ by: ["status"], where: { status: { in: ["won", "lost"] }, closedAt: inPeriod }, _count: { _all: true } }),
    db.opportunity.aggregate({ where: { status: "won", closedAt: inPeriod }, _count: { _all: true }, _sum: { amount: true } }),
    db.stage.findMany({ orderBy: { position: "asc" } }),
    db.activity.count({ where: { ...openTask, dueDate: { lt: startOfToday } } }),
    db.activity.count({ where: { ...openTask, dueDate: { gte: startOfToday, lt: endOfToday } } }),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    // Сделки, требующие внимания: открытые сделки с просроченной задачей или без изменений дольше STUCK_DAYS.
    db.opportunity.findMany({
      where: { AND: [{ status: "open" }, attentionFilter] },
      orderBy: { amount: { sort: "desc", nulls: "last" } },
      take: 50,
      include: {
        account: { select: { name: true } },
        stage: { select: { name: true } },
        activities: { where: overdueOnDeal, orderBy: { dueDate: "asc" }, select: { id: true, body: true, dueDate: true } },
      },
    }),
    db.opportunity.count({ where: { AND: [{ status: "open" }, attentionFilter] } }),
    // Динамика: сколько денег попадало на каждый этап по корзинам периода (шаг из allowlist day|week|month, группировка в БД).
    db.$queryRaw<{ stageId: string; bucket: Date; cnt: number; sum: number }[]>(Prisma.sql`
      SELECT "stageId", date_trunc(${Prisma.raw(`'${period.step}'`)}, "createdAt") AS bucket, COUNT(*)::int AS cnt, COALESCE(SUM("amount"), 0)::float8 AS sum
      FROM "StageTransition"
      WHERE "createdAt" >= ${period.buckets[0] ?? period.from} AND "createdAt" <= ${period.to}
      GROUP BY "stageId", date_trunc(${Prisma.raw(`'${period.step}'`)}, "createdAt")`),
  ]);

  // Лиды
  const statusCount = new Map(leadsByStatus.map((r) => [r.status, r._count._all]));
  const statusBudget = new Map(leadsByStatus.map((r) => [r.status, num(r._sum.budget)]));
  const sourceCount = new Map(leadsBySource.map((r) => [r.source, r._count._all]));
  const sourceBudget = new Map(leadsBySource.map((r) => [r.source, num(r._sum.budget)]));
  const leadStatuses: LeadStatusStat[] = LEAD_STATUSES.map((status) => ({
    status,
    count: statusCount.get(status) ?? 0,
    budget: statusBudget.get(status) ?? 0,
    color: leadStatusChartColors[status],
  }));
  const leadSources: LeadSourceStat[] = LEAD_SOURCES.map((source) => ({ source, count: sourceCount.get(source) ?? 0, budget: sourceBudget.get(source) ?? 0 }));
  const totalLeads = leadStatuses.reduce((n, s) => n + s.count, 0);

  // Сделки по стадиям (все стадии воронки, включая пустые)
  const byStage = new Map(dealsByStage.map((r) => [r.stageId, r]));
  const stageStats: StageStat[] = stages.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    count: byStage.get(s.id)?._count._all ?? 0,
    sum: num(byStage.get(s.id)?._sum.amount),
    color: stageChartColors[s.code] ?? "#6F97A8",
  }));

  // Воронка: объём сделок, дошедших до этапа и дальше (без проигранных). Отказы выводятся отдельным числом.
  const funnelBase = stageStats.filter((s) => s.code !== "lost");
  const funnel: FunnelStage[] = funnelBase.map((stage, i) => {
    const reached = funnelBase.slice(i);
    return {
      name: stage.name,
      code: stage.code,
      color: stage.color,
      sum: reached.reduce((n, x) => n + x.sum, 0),
      count: reached.reduce((n, x) => n + x.count, 0),
    };
  });
  const lostStage = stageStats.find((s) => s.code === "lost");
  const refusals = { count: lostStage?.count ?? 0, sum: lostStage?.sum ?? 0 };

  // Динамика по этапам: корзины периода по оси X, сумма переходов на этап по оси Y.
  const bucketKeys = period.buckets.map((b) => b.toISOString().slice(0, 10));
  const trendLabels = period.buckets.map((b) => bucketLabel(b, period.step));
  const trends: StageTrend[] = funnelBase.map((stage) => {
    const rows = bucketRows.filter((r) => r.stageId === stage.id);
    const at = (key: string) => rows.find((r) => r.bucket.toISOString().slice(0, 10) === key);
    return {
      name: stage.name,
      code: stage.code,
      color: stage.color,
      values: bucketKeys.map((k) => at(k)?.sum ?? 0),
      counts: bucketKeys.map((k) => at(k)?.cnt ?? 0),
    };
  });

  // Список отсортирован по убыванию объёма денег (сделки без суммы в конце); длинный список прокручивается в интерфейсе.
  const attention: AttentionDeal[] = attentionRows
    .map((o) => ({
      id: o.id,
      title: o.title,
      account: o.account.name,
      stage: o.stage.name,
      amount: num(o.amount),
      stuckDays: o.updatedAt < stuckBefore ? Math.floor((now.getTime() - o.updatedAt.getTime()) / DAY) : null,
      overdueTasks: o.activities,
    }))
    .sort((a, b) => b.amount - a.amount);

  const statusOfDeals = new Map(closedInPeriod.map((r) => [r.status, r._count._all]));
  const won = statusOfDeals.get("won") ?? 0;
  const lost = statusOfDeals.get("lost") ?? 0;

  return {
    generatedAt: now,
    kpi: {
      totalLeads,
      openDeals: openDeals._count._all,
      openDealsSum: num(openDeals._sum.amount),
      overdueTasks: overdueCount,
      newLeadsPeriod,
      conversionPct: newLeadsPeriod > 0 ? Math.round((convertedPeriod / newLeadsPeriod) * 100) : 0,
      wonCount: wonInPeriod._count._all,
      wonSum: num(wonInPeriod._sum.amount),
      winRatePct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
      todayTasks: todayCount,
    },
    stageStats,
    funnel,
    refusals,
    trendLabels,
    trends,
    leadStatuses,
    leadSources,
    recentLeads,
    attention,
    attentionCount,
  };
}
