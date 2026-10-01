import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { addDays, startOfDay } from "@/lib/tz";
import { testDatabaseUrl } from "../helpers/test-db";
import { db, resetDb } from "../helpers/db";

describe("seed: предсказуемые контрольные данные", () => {
  beforeAll(async () => {
    await resetDb();
    // дважды: seed идемпотентен и каждый раз даёт одинаковый результат
    for (let i = 0; i < 2; i++) execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: testDatabaseUrl() }, stdio: "pipe" });
  });

  it("создаёт 6 лидов, 4 компании, 5 контактов, 6 сделок, 8 активностей, 3 менеджера и справочник причин", async () => {
    expect({
      leads: await db.lead.count(),
      accounts: await db.account.count(),
      contacts: await db.contact.count(),
      opportunities: await db.opportunity.count(),
      activities: await db.activity.count(),
      managers: await db.manager.count(),
      reasons: await db.lostReason.count(),
      stages: await db.stage.count(),
    }).toEqual({ leads: 6, accounts: 4, contacts: 5, opportunities: 6, activities: 8, managers: 3, reasons: 6, stages: 6 });
  });

  it("лиды покрывают все источники и несколько статусов, сделки все стадии", async () => {
    const sources = new Set((await db.lead.findMany()).map((l) => l.source));
    expect([...sources].sort()).toEqual(["email", "manual", "phone", "referral", "site"]);
    expect(new Set((await db.lead.findMany()).map((l) => l.status)).size).toBeGreaterThanOrEqual(4);
    const stageCodes = (await db.opportunity.findMany({ include: { stage: true } })).map((o) => o.stage.code).sort();
    expect(stageCodes).toEqual(["lost", "negotiation", "new", "proposal", "qualification", "won"]);
  });

  it("минимум две просроченные задачи и две на сегодня", async () => {
    const today = startOfDay();
    const overdue = await db.activity.count({ where: { type: "task", done: false, dueDate: { lt: today } } });
    const dueToday = await db.activity.count({ where: { type: "task", done: false, dueDate: { gte: today, lt: addDays(today, 1) } } });
    expect(overdue).toBeGreaterThanOrEqual(2);
    expect(dueToday).toBeGreaterThanOrEqual(2);
  });

  it("связи согласованы: контакт принадлежит компании сделки, конвертированный лид связан со сделкой, отказ имеет причину", async () => {
    for (const o of await db.opportunity.findMany({ include: { contact: true } })) if (o.contact) expect(o.contact.accountId).toBe(o.accountId);
    const converted = await db.lead.findFirstOrThrow({ where: { status: "converted" }, include: { opportunity: true } });
    expect(converted.opportunity).not.toBeNull();
    expect(converted.convertedAccountId).toBe(converted.opportunity!.accountId);
    const lost = await db.opportunity.findFirstOrThrow({ where: { status: "lost" } });
    expect(lost.lostReasonId).not.toBeNull();
    const won = await db.opportunity.findFirstOrThrow({ where: { status: "won" } });
    expect(Number(won.amount)).toBeGreaterThan(0);
    expect(won.contactId).not.toBeNull();
  });

  it("есть зависшая сделка для блока «требуют внимания» и история стадий для графиков", async () => {
    const stuck = await db.opportunity.count({ where: { status: "open", updatedAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
    expect(stuck).toBeGreaterThanOrEqual(1);
    expect(await db.stageTransition.count()).toBeGreaterThanOrEqual(15);
  });
});
