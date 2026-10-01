import { beforeEach, describe, expect, it } from "vitest";
import { convertLead } from "@/lib/actions/convert";
import { db, form, resetDb, run, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
});

async function makeLead(over: Partial<{ status: "new" | "in_progress" | "qualified" | "disqualified" | "converted"; budget: number }> = {}) {
  return db.lead.create({ data: { name: "Иван Петров", company: "ООО Пример", source: "site", status: "new", budget: 900_000, managerId: "mgr_a", ...over } });
}

const base = { firstName: "Иван", lastName: "Петров", email: "ivan@example.com", accountChoice: "new", accountName: "ООО Пример" };

describe("конвертация лида", () => {
  it("создаёт компанию, контакт и сделку, связывает их и переводит лид в «Конвертирован»", async () => {
    const lead = await makeLead();
    const r = await run(() => convertLead(lead.id, undefined, form({ ...base, createDeal: "on", dealTitle: "Стенд для ООО Пример", amount: "900000", managerId: "mgr_b" })));
    expect(r.redirect).toBe(`/leads/${lead.id}`);

    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { opportunity: { include: { transitions: true } }, convertedAccount: true, convertedContact: true } });
    expect(after.status).toBe("converted");
    expect(after.convertedAt).not.toBeNull();
    expect(after.convertedAccount?.name).toBe("ООО Пример");
    expect(after.convertedContact).toMatchObject({ firstName: "Иван", lastName: "Петров", accountId: after.convertedAccountId });
    expect(after.opportunity).toMatchObject({ title: "Стенд для ООО Пример", status: "open", stageId: "stage_new", accountId: after.convertedAccountId, contactId: after.convertedContactId, managerId: "mgr_b" });
    expect(Number(after.opportunity?.amount)).toBe(900_000);
    expect(after.opportunity?.transitions).toHaveLength(1);
    expect(await db.account.count()).toBe(1);
    expect(await db.contact.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: "convert", entityId: lead.id } })).toBe(1);
  });

  it("с существующей компанией не создаёт дубликат, без флажка не создаёт сделку", async () => {
    const lead = await makeLead({ status: "qualified" });
    const account = await db.account.create({ data: { name: "ООО Пример" } });
    await run(() => convertLead(lead.id, undefined, form({ ...base, accountChoice: account.id, accountName: "" })));
    expect(await db.account.count()).toBe(1);
    expect(await db.opportunity.count()).toBe(0);
    expect((await db.contact.findFirstOrThrow()).accountId).toBe(account.id);
  });

  it("повторная конвертация запрещена и ничего не создаёт", async () => {
    const lead = await makeLead();
    await run(() => convertLead(lead.id, undefined, form({ ...base, createDeal: "on", dealTitle: "Сделка" })));
    const again = await run(() => convertLead(lead.id, undefined, form({ ...base, accountName: "Другая компания", createDeal: "on", dealTitle: "Ещё сделка" })));
    expect(again.result?.message).toMatch(/уже конвертирован/);
    expect(await db.account.count()).toBe(1);
    expect(await db.contact.count()).toBe(1);
    expect(await db.opportunity.count()).toBe(1);
  });

  it("отклонённого лида конвертировать нельзя", async () => {
    const lead = await makeLead({ status: "disqualified" });
    const r = await run(() => convertLead(lead.id, undefined, form(base)));
    expect(r.result?.message).toMatch(/Отклонённого/);
    expect(await db.contact.count()).toBe(0);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("disqualified");
  });

  it("без обязательных данных конвертация не выполняется", async () => {
    const lead = await makeLead();
    const noLast = await run(() => convertLead(lead.id, undefined, form({ ...base, lastName: "" })));
    expect(noLast.result?.fieldErrors?.lastName).toBeTruthy();
    const noCompany = await run(() => convertLead(lead.id, undefined, form({ ...base, accountName: "" })));
    expect(noCompany.result?.fieldErrors?.accountName).toBeTruthy();
    const noDealTitle = await run(() => convertLead(lead.id, undefined, form({ ...base, createDeal: "on" })));
    expect(noDealTitle.result?.fieldErrors?.dealTitle).toBeTruthy();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("new");
    expect(await db.account.count()).toBe(0);
  });

  it("при ошибке в середине транзакции откатывается всё, включая статус лида", async () => {
    const lead = await makeLead();
    const r = await run(() => convertLead(lead.id, undefined, form({ ...base, accountChoice: "несуществующая-компания" })));
    expect(r.result?.message).toMatch(/не найдена/);
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("new");
    expect(after.convertedAt).toBeNull();
    expect(await db.contact.count()).toBe(0);
  });

  it("два одновременных запроса: сработает ровно один", async () => {
    const lead = await makeLead();
    const results = await Promise.all([1, 2].map((n) => run(() => convertLead(lead.id, undefined, form({ ...base, accountName: `Компания ${n}` })))));
    expect(results.filter((r) => r.redirect).length).toBe(1);
    expect(await db.contact.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
  });
});
