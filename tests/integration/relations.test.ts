import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount, updateAccount } from "@/lib/actions/accounts";
import { deleteContact, updateContact } from "@/lib/actions/contacts";
import { db, form, resetDb, run, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
});

describe("связи компаний, контактов и сделок", () => {
  it("компанию со связанными данными удалить нельзя, пустую можно", async () => {
    const account = await db.account.create({ data: { name: "А" } });
    const contact = await db.contact.create({ data: { firstName: "И", lastName: "П", accountId: account.id } });
    await db.opportunity.create({ data: { title: "С", accountId: account.id, contactId: contact.id, stageId: "stage_new" } });
    const blocked = await run(() => deleteAccount(account.id, undefined, new FormData()));
    expect(blocked.result?.message).toMatch(/контактов: 1.*сделок: 1/);
    expect(await db.account.count()).toBe(1);

    const empty = await db.account.create({ data: { name: "Пустая" } });
    const ok = await run(() => deleteAccount(empty.id, undefined, new FormData()));
    expect(ok.redirect).toBe("/accounts");
    expect(await db.account.count()).toBe(1);
  });

  it("контакт со сделкой не удаляется и не может сменить компанию", async () => {
    const a = await db.account.create({ data: { name: "А" } });
    const b = await db.account.create({ data: { name: "Б" } });
    const contact = await db.contact.create({ data: { firstName: "И", lastName: "П", accountId: a.id } });
    await db.opportunity.create({ data: { title: "С", accountId: a.id, contactId: contact.id, stageId: "stage_new" } });

    const del = await run(() => deleteContact(contact.id, undefined, new FormData()));
    expect(del.result?.message).toMatch(/связан со сделками/);
    const move = await run(() => updateContact(contact.id, undefined, form({ firstName: "И", lastName: "П", accountId: b.id })));
    expect(move.result?.fieldErrors?.accountId?.[0]).toMatch(/Нельзя сменить компанию/);
    expect((await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).accountId).toBe(a.id);
  });

  it("правка компании пишет в журнал только изменённые поля", async () => {
    const a = await db.account.create({ data: { name: "Старое", city: "Москва" } });
    await run(() => updateAccount(a.id, undefined, form({ name: "Новое", city: "Москва" })));
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: a.id, action: "update" } });
    expect(log.changes).toEqual([{ field: "name", from: "Старое", to: "Новое" }]);
  });

  it("удаление менеджера оставляет лиды и сделки «без ответственного»", async () => {
    const account = await db.account.create({ data: { name: "А" } });
    await db.lead.create({ data: { name: "Л", source: "site", managerId: "mgr_a" } });
    await db.opportunity.create({ data: { title: "С", accountId: account.id, stageId: "stage_new", managerId: "mgr_a" } });
    await db.manager.delete({ where: { id: "mgr_a" } });
    expect((await db.lead.findFirstOrThrow()).managerId).toBeNull();
    expect((await db.opportunity.findFirstOrThrow()).managerId).toBeNull();
  });
});
