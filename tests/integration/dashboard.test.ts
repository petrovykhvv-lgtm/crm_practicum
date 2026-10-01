import { beforeEach, describe, expect, it } from "vitest";
import { getDashboardData } from "@/lib/dashboard";
import { resolvePeriod } from "@/lib/period";
import { addDays, formatYmd, startOfDay } from "@/lib/tz";
import { db, resetDb, seedReference } from "../helpers/db";

const DAY = 86_400_000;
let accountId: string;
let contactId: string;

beforeEach(async () => {
  await resetDb();
  await seedReference();
  accountId = (await db.account.create({ data: { name: "Компания" } })).id;
  contactId = (await db.contact.create({ data: { firstName: "И", lastName: "П", accountId } })).id;

  await db.lead.createMany({
    data: [
      { name: "Л1", source: "site", status: "new", budget: 100_000, managerId: "mgr_a" },
      { name: "Л2", source: "referral", status: "converted", budget: 300_000, managerId: "mgr_b" },
      { name: "Л3", source: "manual", status: "disqualified", managerId: "mgr_a" },
    ],
  });
  const deal = (id: string, stageId: string, amount: number, extra: object = {}) =>
    db.opportunity.create({ data: { id, title: id, accountId, contactId, stageId, amount, ...extra } });
  await deal("D1", "stage_new", 1_000_000, { managerId: "mgr_a" });
  await deal("D2", "stage_proposal", 2_000_000, { managerId: "mgr_b" });
  await deal("D3", "stage_negotiation", 400_000, { managerId: "mgr_a" });
  await deal("D4", "stage_won", 3_000_000, { status: "won", closedAt: new Date(), managerId: "mgr_b" });
  await deal("D5", "stage_lost", 500_000, { status: "lost", closedAt: new Date(), lostReasonId: "lr_price", managerId: "mgr_a" });
  await deal("D6", "stage_qualification", 5_000_000, { updatedAt: new Date(Date.now() - 20 * DAY) });

  // просроченная задача по D3 и задача на сегодня по лиду
  await db.activity.create({ data: { type: "task", body: "Просрочено", dueDate: addDays(startOfDay(), -2), opportunityId: "D3", assigneeId: "mgr_a" } });
  await db.activity.create({ data: { type: "task", body: "Сегодня", dueDate: new Date(startOfDay().getTime() + 12 * 3_600_000), leadId: (await db.lead.findFirstOrThrow()).id, assigneeId: "mgr_b" } });

  // история переходов: D2 попала на «Смету» 3 дня назад, D1 на «Новую» сегодня
  const threeDaysAgo = new Date(addDays(startOfDay(), -3).getTime() + 12 * 3_600_000);
  await db.stageTransition.create({ data: { opportunityId: "D2", stageId: "stage_proposal", amount: 2_000_000, createdAt: threeDaysAgo } });
  await db.stageTransition.create({ data: { opportunityId: "D1", stageId: "stage_new", amount: 1_000_000 } });
});

const period = () => resolvePeriod({ period: "30d" });

describe("дашборд: показатели считаются по данным БД", () => {
  it("KPI, прогноз и доли", async () => {
    const d = await getDashboardData(period());
    expect(d.kpi).toMatchObject({
      totalLeads: 3,
      openDeals: 4,
      openDealsSum: 8_400_000,
      forecast: 100_000 + 1_000_000 + 300_000 + 1_250_000, // сумма × вероятность стадии
      overdueTasks: 1,
      todayTasks: 1,
      newLeadsPeriod: 3,
      conversionPct: 33,
      wonCount: 1,
      wonSum: 3_000_000,
      winRatePct: 50,
    });
  });

  it("сводки по статусам и источникам с бюджетом", async () => {
    const d = await getDashboardData(period());
    expect(d.leadStatuses.map((s) => [s.status, s.count, s.budget])).toEqual([
      ["new", 1, 100_000],
      ["in_progress", 0, 0],
      ["qualified", 0, 0],
      ["converted", 1, 300_000],
      ["disqualified", 1, 0],
    ]);
    expect(d.leadSources.map((s) => [s.source, s.count])).toEqual([["site", 1], ["email", 0], ["phone", 0], ["referral", 1], ["manual", 1]]);
  });

  it("воронка: накопительные объёмы без проигранных, отказы отдельным числом", async () => {
    const d = await getDashboardData(period());
    expect(d.funnel.map((f) => [f.code, f.sum, f.count])).toEqual([
      ["new", 11_400_000, 5],
      ["qualification", 10_400_000, 4],
      ["proposal", 5_400_000, 3],
      ["negotiation", 3_400_000, 2],
      ["won", 3_000_000, 1],
    ]);
    expect(d.funnel.some((f) => f.code === "lost")).toBe(false);
    expect(d.refusals).toEqual({ count: 1, sum: 500_000 });
    expect(d.lostByReason).toEqual([{ name: "Цена выше ожиданий", count: 1, sum: 500_000 }]);
  });

  it("«требуют внимания»: просроченные задачи и зависшие сделки, по убыванию суммы", async () => {
    const d = await getDashboardData(period());
    expect(d.attention.map((a) => [a.title, a.amount])).toEqual([["D6", 5_000_000], ["D3", 400_000]]);
    expect(d.attention[0].stuckDays).toBeGreaterThanOrEqual(19);
    expect(d.attention[1].overdueTasks).toHaveLength(1);
    expect(d.attentionCount).toBe(2);
  });

  it("динамика по этапам: деньги попадают в корзину своего дня", async () => {
    const p = resolvePeriod({ period: "7d", step: "day" });
    const d = await getDashboardData(p);
    const proposal = d.trends.find((t) => t.code === "proposal")!;
    const key = formatYmd(addDays(startOfDay(), -3));
    const idx = p.buckets.findIndex((b) => b.key === key);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(proposal.values[idx]).toBe(2_000_000);
    expect(proposal.values.reduce((a, b) => a + b, 0)).toBe(2_000_000);
    const today = d.trends.find((t) => t.code === "new")!;
    expect(today.values.at(-1)).toBe(1_000_000);
    expect(d.trendLabels).toHaveLength(7);
  });

  it("период ограничивает показатели «за период»", async () => {
    await db.opportunity.update({ where: { id: "D4" }, data: { closedAt: new Date(Date.now() - 40 * DAY) } });
    const d = await getDashboardData(period());
    expect(d.kpi.wonCount).toBe(0);
    expect(d.kpi.winRatePct).toBe(0); // закрыто за период: 0 выиграно, 1 проиграно
  });
});

describe("дашборд: фильтр по ответственному", () => {
  it("конкретный менеджер видит только свои данные", async () => {
    const d = await getDashboardData(period(), { value: "mgr_a" });
    expect(d.kpi).toMatchObject({ totalLeads: 2, openDeals: 2, openDealsSum: 1_400_000, forecast: 400_000, overdueTasks: 1, todayTasks: 0 });
    expect(d.refusals.count).toBe(1);
    expect(d.attention.map((a) => a.title)).toEqual(["D3"]);
  });

  it("«без ответственного» даёт только не назначенное", async () => {
    const d = await getDashboardData(period(), { value: null });
    expect(d.kpi).toMatchObject({ totalLeads: 0, openDeals: 1, openDealsSum: 5_000_000, overdueTasks: 0 });
    expect(d.attention.map((a) => a.title)).toEqual(["D6"]);
  });
});

describe("дашборд: обновляется при повторном запросе", () => {
  it("новый лид и изменение сделки сразу видны в показателях", async () => {
    const before = await getDashboardData(period());
    await db.lead.create({ data: { name: "Новый", source: "phone", budget: 50_000 } });
    await db.opportunity.update({ where: { id: "D1" }, data: { amount: 2_500_000 } });
    const after = await getDashboardData(period());
    expect(after.kpi.totalLeads).toBe(before.kpi.totalLeads + 1);
    expect(after.kpi.openDealsSum).toBe(before.kpi.openDealsSum + 1_500_000);
    expect(after.leadSources.find((s) => s.source === "phone")?.count).toBe(1);
  });
});
