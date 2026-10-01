import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/export/[entity]/route";
import { importLeads } from "@/lib/actions/import";
import { db, resetDb, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
});

const upload = (csv: string, dryRun = false) => {
  const fd = new FormData();
  fd.set("file", new File([csv], "leads.csv", { type: "text/csv" }));
  if (dryRun) fd.set("dryRun", "on");
  return fd;
};

describe("импорт лидов из CSV", () => {
  const csv = [
    "Имя;Компания;Email;Телефон;Источник;Бюджет;Площадка;Формат работ;Ответственный;Срок",
    "Иван Петров;ООО Пример;ivan@example.com;+7 900 000-00-00;Сайт;1 500 000;Крокус;Стенд;Анна;15.11.2026",
    "Мария Ким;Nordic;kim@example.com;;phone;300000;;;;",
    ";Без имени;;;Сайт;;;;;",
    "Плохой Email;X;not-an-email;;Сайт;;;;;",
    "Неверный Источник;X;;;Факс;;;;;",
    "Чужой Менеджер;X;;;Сайт;;;;Неизвестный;",
    "Дубль В Файле;X;ivan@example.com;;Сайт;;;;;",
  ].join("\r\n");

  it("режим «только проверить» ничего не записывает, но считает и объясняет ошибки", async () => {
    const r = await importLeads(undefined, upload(csv, true));
    expect(r).toMatchObject({ ok: true, dryRun: true, total: 7, imported: 2 });
    expect(r.skipped?.map((s) => s.row)).toEqual([4, 5, 6, 7, 8]);
    expect(r.skipped?.[2].reason).toMatch(/Источник/);
    expect(r.skipped?.[3].reason).toMatch(/Менеджер «Неизвестный»/);
    expect(r.skipped?.[4].reason).toMatch(/Дубль/);
    expect(await db.lead.count()).toBe(0);
  });

  it("реальный импорт записывает корректные строки с разбором источника, бюджета, срока и менеджера", async () => {
    const r = await importLeads(undefined, upload(csv));
    expect(r.imported).toBe(2);
    const leads = await db.lead.findMany({ orderBy: { name: "asc" } });
    expect(leads.map((l) => l.name)).toEqual(["Иван Петров", "Мария Ким"]);
    const ivan = leads[0];
    expect(ivan).toMatchObject({ source: "site", managerId: "mgr_a", status: "new" });
    expect(Number(ivan.budget)).toBe(1_500_000);
    expect(ivan.deadline?.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(leads[1].source).toBe("phone");
  });

  it("повторная загрузка того же файла пропускает всё как дубли по email", async () => {
    await importLeads(undefined, upload(csv));
    const again = await importLeads(undefined, upload(csv));
    expect(again.skipped?.filter((s) => /Дубль/.test(s.reason)).length).toBeGreaterThanOrEqual(1);
    expect(await db.lead.count()).toBe(2 + 0); // без новых записей с теми же email
  });

  it("понятные ошибки для пустого файла и файла без столбца «Имя»", async () => {
    expect((await importLeads(undefined, new FormData())).message).toMatch(/Выберите CSV/);
    expect((await importLeads(undefined, upload("Имя\n"))).message).toMatch(/нет данных/);
    expect((await importLeads(undefined, upload("Компания;Email\nX;a@b.co"))).message).toMatch(/столбец «Имя»/);
  });
});

describe("экспорт CSV", () => {
  it("выгружает список с теми же фильтрами и корректной кодировкой", async () => {
    await db.lead.createMany({
      data: [
        { name: "Сайтовый", source: "site", budget: 1000, email: "a@b.co" },
        { name: "Почтовый", source: "email" },
      ],
    });
    const res = await GET(new NextRequest("http://localhost/api/export/leads?source=site"), { params: Promise.resolve({ entity: "leads" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/leads-\d{4}-\d{2}-\d{2}\.csv/);
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // BOM для Excel
    const body = await res.text();
    expect(body).toContain("Сайтовый");
    expect(body).not.toContain("Почтовый");
    expect(body.split("\r\n")[0]).toContain("Ответственный");
  });

  it("экспортирует сделки со стадией, статусом и причиной отказа; неизвестный тип даёт 404", async () => {
    const account = await db.account.create({ data: { name: "Компания" } });
    await db.opportunity.create({ data: { title: "Проигранная", accountId: account.id, stageId: "stage_lost", status: "lost", amount: 1000, lostReasonId: "lr_price" } });
    const res = await GET(new NextRequest("http://localhost/api/export/opportunities"), { params: Promise.resolve({ entity: "opportunities" }) });
    const body = await res.text();
    expect(body).toContain("Проигранная");
    expect(body).toContain("Проиграна");
    expect(body).toContain("Цена выше ожиданий");
    const bad = await GET(new NextRequest("http://localhost/api/export/secrets"), { params: Promise.resolve({ entity: "secrets" }) });
    expect(bad.status).toBe(404);
  });

  it("шаблон импорта содержит заголовки, понятные импорту", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export/leads-template"), { params: Promise.resolve({ entity: "leads-template" }) });
    const template = await res.text();
    const r = await importLeads(undefined, upload(template.replace("﻿", ""), true));
    expect(r).toMatchObject({ ok: true, imported: 1 });
    expect(r.skipped).toEqual([]);
  });
});
