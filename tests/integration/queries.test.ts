import { beforeEach, describe, expect, it } from "vitest";
import { accountQuery, contactQuery, leadQuery, opportunityQuery, pageOf } from "@/lib/queries";
import { db, resetDb, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
  await db.lead.createMany({
    data: [
      { name: "Иван Орлов", company: "Экспо Плюс", source: "site", status: "new", budget: 100, email: "orlov@expo.example", managerId: "mgr_a" },
      { name: "Мария Ким", company: "Nordic Home", source: "email", status: "qualified", budget: 300 },
      { name: "Олег Смирнов", company: "Fresh Lab", source: "site", status: "in_progress", managerId: "mgr_b" },
    ],
  });
});

const names = async (sp: Record<string, string>, field: "name" = "name") => {
  const q = await leadQuery(sp);
  return (await db.lead.findMany({ where: q.where, orderBy: q.orderBy })).map((l) => l[field]);
};

describe("поиск и фильтры лидов", () => {
  it("ищет без учёта регистра по нескольким словам в разных полях", async () => {
    expect(await names({ q: "иван орлов" })).toEqual(["Иван Орлов"]);
    expect(await names({ q: "nordic" })).toEqual(["Мария Ким"]);
    expect(await names({ q: "ORLOV@expo" })).toEqual(["Иван Орлов"]);
    expect(await names({ q: "несуществующий" })).toEqual([]);
  });
  it("фильтрует по источнику и статусу, сочетает условия", async () => {
    expect(await names({ source: "site" })).toHaveLength(2);
    expect(await names({ status: "qualified" })).toEqual(["Мария Ким"]);
    expect(await names({ source: "site", status: "in_progress" })).toEqual(["Олег Смирнов"]);
  });
  it("некорректные значения фильтров игнорируются", async () => {
    expect(await names({ source: "hack", status: "zzz" })).toHaveLength(3);
  });
  it("фильтр по ответственному: конкретный и «без ответственного»", async () => {
    expect(await names({ manager: "mgr_a" })).toEqual(["Иван Орлов"]);
    expect(await names({ manager: "none" })).toEqual(["Мария Ким"]);
  });
  it("сортировка: разрешённые поля работают, неизвестные игнорируются", async () => {
    expect(await names({ sort: "name", dir: "asc" })).toEqual(["Иван Орлов", "Мария Ким", "Олег Смирнов"]);
    expect(await names({ sort: "budget", dir: "desc" })).toEqual(["Мария Ким", "Иван Орлов", "Олег Смирнов"]); // без бюджета в конце
    const bad = await leadQuery({ sort: "password", dir: "asc" });
    expect(bad.sort).toMatchObject({ key: "createdAt", dir: "desc", isDefault: true });
  });
  it("номер страницы разбирается безопасно", async () => {
    expect([pageOf({}), pageOf({ page: "3" }), pageOf({ page: "-1" }), pageOf({ page: "abc" }), pageOf({ page: "2.5" })]).toEqual([1, 3, 1, 1, 1]);
  });
});

describe("поиск и фильтры сделок, компаний, контактов", () => {
  it("сделки: поиск по названию, компании и контакту, фильтры по стадии и статусу", async () => {
    const a = await db.account.create({ data: { name: "Экспо Плюс" } });
    const c = await db.contact.create({ data: { firstName: "Иван", lastName: "Орлов", accountId: a.id } });
    await db.opportunity.create({ data: { title: "Стенд MosBuild", accountId: a.id, contactId: c.id, stageId: "stage_proposal", amount: 10 } });
    await db.opportunity.create({ data: { title: "Pop-up", accountId: a.id, stageId: "stage_lost", status: "lost" } });

    const find = async (sp: Record<string, string>) => {
      const q = await opportunityQuery(sp);
      return (await db.opportunity.findMany({ where: q.where, orderBy: q.orderBy })).map((o) => o.title);
    };
    expect(await find({ q: "орлов" })).toEqual(["Стенд MosBuild"]);
    expect(await find({ q: "экспо" })).toHaveLength(2);
    expect(await find({ stage: "proposal" })).toEqual(["Стенд MosBuild"]);
    expect(await find({ status: "lost" })).toEqual(["Pop-up"]);
    expect(await find({ stage: "нет-такой" })).toHaveLength(2);
    expect(await find({ sort: "stage", dir: "desc" })).toEqual(["Pop-up", "Стенд MosBuild"]);
  });

  it("компании и контакты ищутся по названию, городу, имени и компании", async () => {
    const a = await db.account.create({ data: { name: "Nordic Home", city: "Санкт-Петербург" } });
    await db.contact.create({ data: { firstName: "Мария", lastName: "Ким", accountId: a.id } });
    expect(await db.account.count({ where: accountQuery({ q: "петербург" }).where })).toBe(1);
    expect(await db.contact.count({ where: contactQuery({ q: "nordic ким" }).where })).toBe(1);
    expect(await db.contact.count({ where: contactQuery({ q: "иванов" }).where })).toBe(0);
  });
});
