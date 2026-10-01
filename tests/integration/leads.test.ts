import { beforeEach, describe, expect, it } from "vitest";
import { createLead, deleteLead, updateLead } from "@/lib/actions/leads";
import { db, form, resetDb, run, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
});

const leadForm = (over: Record<string, string> = {}) => form({ name: "Иван Петров", source: "site", status: "new", ...over });

describe("создание лида", () => {
  it("сохраняет лид со всеми источниками и пишет журнал", async () => {
    for (const source of ["site", "email", "phone", "referral", "manual"]) {
      const r = await run(() => createLead(undefined, leadForm({ source, name: `Лид ${source}`, budget: "100 000" })));
      expect(r.redirect).toMatch(/^\/leads\//);
    }
    expect(await db.lead.count()).toBe(5);
    expect((await db.lead.findFirstOrThrow({ where: { source: "site" } })).budget?.toString()).toBe("100000");
    expect(await db.auditLog.count({ where: { action: "create", entityType: "lead" } })).toBe(5);
  });

  it("не сохраняет пустые и некорректные обязательные поля", async () => {
    const empty = await run(() => createLead(undefined, form({ name: "", source: "", status: "new" })));
    expect(empty.result?.fieldErrors?.name).toBeTruthy();
    expect(empty.result?.fieldErrors?.source).toBeTruthy();
    const bad = await run(() => createLead(undefined, leadForm({ email: "x", phone: "abc", budget: "-1" })));
    expect(Object.keys(bad.result?.fieldErrors ?? {}).sort()).toEqual(["budget", "email", "phone"]);
    expect(await db.lead.count()).toBe(0);
  });

  it("предупреждает о дубле по email и по названию компании, создаёт после подтверждения", async () => {
    await db.lead.create({ data: { name: "Старый", email: "Ivan@Example.com", source: "site" } });
    await db.account.create({ data: { name: "ООО Ромашка" } });

    const dupEmail = await run(() => createLead(undefined, leadForm({ email: "ivan@example.com" })));
    expect(dupEmail.result?.duplicates?.[0].kind).toBe("lead");
    expect(await db.lead.count()).toBe(1);

    const dupCompany = await run(() => createLead(undefined, leadForm({ company: "ооо ромашка" })));
    expect(dupCompany.result?.duplicates?.some((d) => d.kind === "account")).toBe(true);

    const confirmed = await run(() => createLead(undefined, leadForm({ email: "ivan@example.com", confirmDuplicate: "1" })));
    expect(confirmed.redirect).toMatch(/^\/leads\//);
    expect(await db.lead.count()).toBe(2);
  });
});

describe("правка лида", () => {
  it("конвертированному лиду нельзя сменить статус, остальные поля правятся и попадают в журнал", async () => {
    const lead = await db.lead.create({ data: { name: "К", source: "site", status: "converted", convertedAt: new Date() } });
    await run(() => updateLead(lead.id, undefined, leadForm({ name: "К Новый", status: "new" })));
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("converted");
    expect(after.name).toBe("К Новый");
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: lead.id, action: "update" } });
    expect(JSON.stringify(log.changes)).toContain("К Новый");
  });

  it("при отклонении нужна причина, при возврате в работу причина очищается", async () => {
    const lead = await db.lead.create({ data: { name: "Л", source: "site" } });
    const noReason = await run(() => updateLead(lead.id, undefined, leadForm({ status: "disqualified" })));
    expect(noReason.result?.fieldErrors?.disqualifyReason).toBeTruthy();
    await run(() => updateLead(lead.id, undefined, leadForm({ status: "disqualified", disqualifyReason: "нет бюджета" })));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).disqualifyReason).toBe("нет бюджета");
    await run(() => updateLead(lead.id, undefined, leadForm({ status: "in_progress" })));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).disqualifyReason).toBeNull();
  });

  it("правка несуществующего лида возвращает ошибку", async () => {
    const r = await run(() => updateLead("nope", undefined, leadForm()));
    expect(r.result?.message).toMatch(/не найден/);
  });
});

describe("удаление лида", () => {
  it("конвертированного удалить нельзя, обычного можно вместе с его активностями", async () => {
    const converted = await db.lead.create({ data: { name: "К", source: "site", status: "converted" } });
    const blocked = await run(() => deleteLead(converted.id, undefined, new FormData()));
    expect(blocked.result?.message).toMatch(/Конвертированного лида нельзя/);
    expect(await db.lead.count()).toBe(1);

    const plain = await db.lead.create({ data: { name: "П", source: "site", activities: { create: { type: "note", body: "x" } } } });
    const ok = await run(() => deleteLead(plain.id, undefined, new FormData()));
    expect(ok.redirect).toBe("/leads");
    expect(await db.lead.count()).toBe(1);
    expect(await db.activity.count()).toBe(0);
  });
});
