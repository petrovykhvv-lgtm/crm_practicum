import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Period } from "@/lib/period";
import { APP_TZ, addDays, startOfDay } from "@/lib/tz";
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

/** Фильтр по ответственному: null — все, { value: null } — без ответственного, { value: id } — конкретный менеджер. */
export type ManagerScope = { value: string | null } | null;

/**
 * Все показатели считаются на сервере запросами Prisma groupBy / aggregate / count
 * при каждом открытии страницы. Возвращаются только простые числа и строки.
 */
export async function getDashboardData(period: Period, manager: ManagerScope = null) {
  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = addDays(startOfToday, 1);
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * DAY);

  const inPeriod = { gte: period.from, lte: period.to };
  const byManager = manager ? { managerId: manager.value } : {};
  const byAssignee = manager ? { assigneeId: manager.value } : {};
  const transitionScope = !manager ? Prisma.empty : manager.value === null ? Prisma.sql`AND o."managerId" IS NULL` : Prisma.sql`AND o."managerId" = ${manager.value}`;
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
    lostGroups,
    reasonList,
  ] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: byManager, _count: { _all: true }, _sum: { budget: true } }),
    db.lead.groupBy({ by: ["source"], where: byManager, _count: { _all: true }, _sum: { budget: true } }),
    db.lead.count({ where: { createdAt: inPeriod, ...byManager } }),
    db.lead.count({ where: { createdAt: inPeriod, status: "converted", ...byManager } }),
    db.opportunity.aggregate({ where: { status: "open", ...byManager }, _count: { _all: true }, _sum: { amount: true } }),
    db.opportunity.groupBy({ by: ["stageId"], where: byManager, _count: { _all: true }, _sum: { amount: true } }),
    db.opportunity.groupBy({ by: ["status"], where: { status: { in: ["won", "lost"] }, closedAt: inPeriod, ...byManager }, _count: { _all: true } }),
    db.opportunity.aggregate({ where: { status: "won", closedAt: inPeriod, ...byManager }, _count: { _all: true }, _sum: { amount: true } }),
    db.stage.findMany({ orderBy: { position: "asc" } }),
    db.activity.count({ where: { ...openTask, ...byAssignee, dueDate: { lt: startOfToday } } }),
    db.activity.count({ where: { ...openTask, ...byAssignee, dueDate: { gte: startOfToday, lt: endOfToday } } }),
    db.lead.findMany({ where: byManager, orderBy: { createdAt: "desc" }, take: 20 }),
    // Сделки, требующие внимания: открытые сделки с просроченной задачей или без изменений дольше STUCK_DAYS.
    db.opportunity.findMany({
      where: { AND: [{ status: "open" }, attentionFilter, byManager] },
      orderBy: { amount: { sort: "desc", nulls: "last" } },
      take: 50,
      include: {
        account: { select: { name: true } },
        stage: { select: { name: true } },
        activities: { where: overdueOnDeal, orderBy: { dueDate: "asc" }, select: { id: true, body: true, dueDate: true } },
      },
    }),
    db.opportunity.count({ where: { AND: [{ status: "open" }, attentionFilter, byManager] } }),
    // Динамика: сколько денег попадало на каждый этап по корзинам периода (шаг из allowlist day|week|month, группировка в БД).
    db.$queryRaw<{ stageId: string; bucket: Date; cnt: number; sum: number }[]>(Prisma.sql`
      SELECT t."stageId" AS "stageId", date_trunc(${Prisma.raw(`'${period.step}'`)}, t."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TZ}) AS bucket, COUNT(*)::int AS cnt, COALESCE(SUM(t."amount"), 0)::float8 AS sum
      FROM "StageTransition" t
      JOIN "Opportunity" o ON o."id" = t."opportunityId"
      WHERE t."createdAt" >= ${period.from} AND t."createdAt" <= ${period.to} ${transitionScope}
      GROUP BY 1, 2`),
    // Причины отказов за период: сколько сделок и денег потеряно по каждой причине.
    db.opportunity.groupBy({ by: ["lostReasonId"], where: { status: "lost", closedAt: inPeriod, ...byManager }, _count: { _all: true }, _sum: { amount: true } }),
    db.lostReason.findMany({ select: { id: true, name: true } }),
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
  const probabilityOf = new Map(stages.map((st) => [st.id, st.probability]));
  const forecast = stageStats.filter((st) => st.code !== "won" && st.code !== "lost").reduce((n, st) => n + (st.sum * (probabilityOf.get(st.id) ?? 0)) / 100, 0);
  const reasonName = new Map(reasonList.map((r) => [r.id, r.name]));
  const lostByReason = lostGroups
    .map((g) => ({ name: g.lostReasonId ? (reasonName.get(g.lostReasonId) ?? "Без причины") : "Без причины", count: g._count._all, sum: num(g._sum.amount) }))
    .sort((a, b) => b.sum - a.sum || b.count - a.count);
  const lostStage = stageStats.find((s) => s.code === "lost");
  const refusals = { count: lostStage?.count ?? 0, sum: lostStage?.sum ?? 0 };

  // Динамика по этапам: корзины периода по оси X, сумма переходов на этап по оси Y.
  const bucketKeys = period.buckets.map((b) => b.key);
  const trendLabels = period.buckets.map((b) => b.label);
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
      forecast,
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
    lostByReason,
  };
}
