import { describe, expect, it } from "vitest";
import { accountSchema, activitySchema, contactSchema, convertLeadSchema, leadSchema, opportunitySchema } from "@/lib/validation";

const lead = { name: "Иван Петров", source: "site", status: "new" };
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("leadSchema", () => {
  it("принимает минимальный корректный лид и нормализует пустые значения в null", () => {
    const r = leadSchema.safeParse({ ...lead, company: "", email: "", budget: "", deadline: "", managerId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ company: null, email: null, budget: null, deadline: null, managerId: null });
  });
  it("требует имя и источник", () => {
    expect(leadSchema.safeParse({ source: "site", status: "new" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...lead, name: "   " }).success).toBe(false);
    expect(messages(leadSchema.safeParse({ ...lead, source: "fax" }))).toContain("Источник: выберите значение");
  });
  it("проверяет email, телефон и бюджет", () => {
    expect(messages(leadSchema.safeParse({ ...lead, email: "no-at" }))).toContain("Введите корректный email");
    expect(messages(leadSchema.safeParse({ ...lead, phone: "abc" })).join()).toContain("корректный телефон");
    expect(leadSchema.safeParse({ ...lead, budget: "-5" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...lead, budget: "abc" }).success).toBe(false);
  });
  it("разбирает бюджет с пробелами и запятой", () => {
    const r = leadSchema.parse({ ...lead, budget: "1 250 000,50" });
    expect(r.budget).toBeCloseTo(1_250_000.5);
  });
  it("принимает все пять источников", () => {
    for (const source of ["site", "email", "phone", "referral", "manual"]) expect(leadSchema.safeParse({ ...lead, source }).success).toBe(true);
  });
  it("статус «Отклонён» требует причину, «Конвертирован» вручную выставить нельзя", () => {
    expect(leadSchema.safeParse({ ...lead, status: "disqualified" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...lead, status: "disqualified", disqualifyReason: "нет бюджета" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...lead, status: "converted" }).success).toBe(false);
  });
  it("отклоняет несуществующую дату", () => {
    expect(leadSchema.safeParse({ ...lead, deadline: "2026-02-31" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...lead, deadline: "2026-09-30" }).success).toBe(true);
  });
});

describe("accountSchema и contactSchema", () => {
  it("компании нужно название, сайт только http(s)", () => {
    expect(accountSchema.safeParse({ name: "" }).success).toBe(false);
    expect(accountSchema.safeParse({ name: "ООО", website: "ftp://x" }).success).toBe(false);
    expect(accountSchema.safeParse({ name: "ООО", website: "https://x.example" }).success).toBe(true);
  });
  it("контакту нужны имя, фамилия и компания", () => {
    expect(contactSchema.safeParse({ firstName: "А", lastName: "Б" }).success).toBe(false);
    expect(contactSchema.safeParse({ firstName: "А", lastName: "Б", accountId: "acc" }).success).toBe(true);
  });
});

describe("opportunitySchema", () => {
  const base = { title: "Стенд", accountId: "a", stageId: "s" };
  it("обязательны название, компания и стадия", () => {
    expect(opportunitySchema.safeParse(base).success).toBe(true);
    expect(opportunitySchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, accountId: "" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, stageId: "" }).success).toBe(false);
  });
});

describe("activitySchema", () => {
  it("у задачи обязателен срок, у заметки нет", () => {
    expect(activitySchema.safeParse({ type: "task", body: "Позвонить" }).success).toBe(false);
    expect(activitySchema.safeParse({ type: "task", body: "Позвонить", dueDate: "2026-10-05" }).success).toBe(true);
    expect(activitySchema.safeParse({ type: "note", body: "Заметка" }).success).toBe(true);
    expect(activitySchema.safeParse({ type: "note", body: "  " }).success).toBe(false);
  });
});

describe("convertLeadSchema", () => {
  const base = { firstName: "Иван", lastName: "Петров", accountChoice: "new", accountName: "ООО Пример" };
  it("для новой компании нужно название, для сделки её название", () => {
    expect(convertLeadSchema.safeParse(base).success).toBe(true);
    expect(convertLeadSchema.safeParse({ ...base, accountName: "" }).success).toBe(false);
    expect(convertLeadSchema.safeParse({ ...base, createDeal: "on" }).success).toBe(false);
    expect(convertLeadSchema.safeParse({ ...base, createDeal: "on", dealTitle: "Сделка" }).success).toBe(true);
  });
  it("фамилия обязательна", () => {
    expect(convertLeadSchema.safeParse({ ...base, lastName: "" }).success).toBe(false);
  });
});
