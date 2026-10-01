import { beforeAll, describe, expect, it } from "vitest";
import { addActivity, toggleTask } from "@/lib/actions/activities";
import { convertLead } from "@/lib/actions/convert";
import { createLead } from "@/lib/actions/leads";
import { changeStage, updateOpportunity } from "@/lib/actions/opportunities";
import { getDashboardData } from "@/lib/dashboard";
import { resolvePeriod } from "@/lib/period";
import { addDays, formatYmd, startOfDay } from "@/lib/tz";
import { db, form, resetDb, run, seedReference } from "../helpers/db";

/**
 * Демонстрационный сценарий из критериев приёмки:
 * запуск → данные → лид → convert lead → сделка → активность → воронка сделок → dashboard.
 */
describe("демонстрационный сценарий CRM-lite", () => {
  const dash = () => getDashboardData(resolvePeriod({ period: "30d" }));
  let leadId: string;
  let dealId: string;
  let accountId: string;
  let contactId: string;
  let d0: Awaited<ReturnType<typeof dash>>;

  beforeAll(async () => {
    await resetDb();
    await seedReference();
    d0 = await dash();
  });

  it("1. Создание лида: лид появляется в базе и на дашборде", async () => {
    const r = await run(() => createLead(undefined, form({ name: "Дмитрий Орлов", company: "ООО Экспо Плюс", email: "orlov@expoplus.example", source: "referral", status: "qualified", budget: "1 800 000", venue: "Крокус Экспо", managerId: "mgr_a" })));
    leadId = r.redirect!.split("/").pop()!;
    const d = await dash();
    expect(d.kpi.totalLeads).toBe(d0.kpi.totalLeads + 1);
    expect(d.leadSources.find((s) => s.source === "referral")?.budget).toBe(1_800_000);
    expect(d.recentLeads[0].name).toBe("Дмитрий Орлов");
  });

  it("2. Конвертация: создаются компания, контакт и сделка, связи видны в карточках", async () => {
    const r = await run(() =>
      convertLead(leadId, undefined, form({ firstName: "Дмитрий", lastName: "Орлов", email: "orlov@expoplus.example", accountChoice: "new", accountName: "ООО Экспо Плюс", createDeal: "on", dealTitle: "Стенд на MosBuild", amount: "1800000", managerId: "mgr_a" })),
    );
    expect(r.redirect).toBe(`/leads/${leadId}`);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { opportunity: true } });
    expect(lead.status).toBe("converted");
    dealId = lead.opportunity!.id;
    accountId = lead.convertedAccountId!;
    contactId = lead.convertedContactId!;

    const account = await db.account.findUniqueOrThrow({ where: { id: accountId }, include: { contacts: true, opportunities: true, leads: true } });
    expect(account.contacts.map((c) => c.id)).toEqual([contactId]);
    expect(account.opportunities.map((o) => o.id)).toEqual([dealId]);
    expect(account.leads.map((l) => l.id)).toEqual([leadId]);
    const contact = await db.contact.findUniqueOrThrow({ where: { id: contactId }, include: { opportunities: true, leads: true } });
    expect(contact.opportunities[0].id).toBe(dealId);
    expect(contact.leads[0].id).toBe(leadId);

    const d = await dash();
    expect(d.kpi.openDeals).toBe(d0.kpi.openDeals + 1);
    expect(d.kpi.openDealsSum).toBe(d0.kpi.openDealsSum + 1_800_000);
    expect(d.kpi.conversionPct).toBe(100);
  });

  it("3. Повторная конвертация невозможна", async () => {
    const again = await run(() => convertLead(leadId, undefined, form({ firstName: "Д", lastName: "О", accountChoice: "new", accountName: "Другая" })));
    expect(again.result?.message).toMatch(/уже конвертирован/);
    expect(await db.opportunity.count()).toBe(1);
  });

  it("4. Активности: заметка и просроченная задача отражаются в карточке и на дашборде", async () => {
    await addActivity("opportunity", dealId, undefined, form({ type: "note", body: "Клиент просит два варианта планировки" }));
    await addActivity("opportunity", dealId, undefined, form({ type: "task", body: "Уточнить площадку", dueDate: formatYmd(addDays(startOfDay(), -2)), assigneeId: "mgr_a" }));
    const card = await db.opportunity.findUniqueOrThrow({ where: { id: dealId }, include: { activities: true } });
    expect(card.activities.map((a) => a.type).sort()).toEqual(["note", "task"]);
    const d = await dash();
    expect(d.kpi.overdueTasks).toBe(1);
    expect(d.attention.map((a) => a.title)).toContain("Стенд на MosBuild");

    const task = card.activities.find((a) => a.type === "task")!;
    await toggleTask(task.id, true);
    expect((await dash()).kpi.overdueTasks).toBe(0);
  });

  it("5. Воронка: сделка проходит стадии, карточка и дашборд видят одну и ту же стадию", async () => {
    for (const [stageId, code] of [["stage_qualification", "qualification"], ["stage_proposal", "proposal"], ["stage_negotiation", "negotiation"]] as const) {
      expect((await changeStage(dealId, stageId, null, null)).ok).toBe(true);
      const deal = await db.opportunity.findUniqueOrThrow({ where: { id: dealId }, include: { stage: true } });
      expect(deal.stage.code).toBe(code);
      const d = await dash();
      expect(d.stageStats.find((s) => s.code === code)?.count).toBe(1);
    }
    const d = await dash();
    expect(d.kpi.forecast).toBe(1_800_000 * 0.75);
  });

  it("6. Изменение сделки сразу меняет дашборд; выигрыш закрывает сделку", async () => {
    await run(() => updateOpportunity(dealId, undefined, form({ title: "Стенд на MosBuild", accountId, contactId, stageId: "stage_negotiation", amount: "2000000", managerId: "mgr_a" })));
    expect((await dash()).kpi.openDealsSum).toBe(2_000_000);

    expect((await changeStage(dealId, "stage_won", null, null)).ok).toBe(true);
    const d = await dash();
    expect(d.kpi).toMatchObject({ openDeals: 0, openDealsSum: 0, wonCount: 1, wonSum: 2_000_000, winRatePct: 100 });
    expect(d.funnel.find((f) => f.code === "won")).toMatchObject({ sum: 2_000_000, count: 1 });
    const log = await db.auditLog.findMany({ where: { entityId: dealId }, orderBy: { createdAt: "asc" } });
    expect(log.length).toBeGreaterThanOrEqual(5); // создание, стадии, правка, выигрыш
  });
});
