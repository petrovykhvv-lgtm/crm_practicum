import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { diffFields } from "@/lib/audit";

describe("diffFields", () => {
  it("возвращает только изменённые отслеживаемые поля", () => {
    const before = { name: "Иван", company: "А", budget: new Prisma.Decimal("1000.00"), deadline: null, id: "x", updatedAt: new Date() };
    const after = { name: "Иван", company: "Б", budget: new Prisma.Decimal("1000.00"), deadline: null, id: "x", updatedAt: new Date(Date.now() + 1000) };
    expect(diffFields("lead", before, after)).toEqual([{ field: "company", from: "А", to: "Б" }]);
  });
  it("сравнивает Decimal по значению и приводит пустое к null", () => {
    const d = diffFields("lead", { budget: new Prisma.Decimal("1000.00"), phone: "" }, { budget: new Prisma.Decimal("1500"), phone: null });
    expect(d).toEqual([{ field: "budget", from: "1000", to: "1500" }]);
  });
  it("даты форматируются как дата в поясе приложения", () => {
    const d = diffFields("opportunity", { eventDate: null }, { eventDate: new Date("2026-10-05T09:00:00Z") });
    expect(d).toEqual([{ field: "eventDate", from: null, to: "2026-10-05" }]);
  });
  it("игнорирует поля, которых нет в новом снимке", () => {
    expect(diffFields("account", { name: "А", city: "М" }, { name: "Б" })).toEqual([{ field: "name", from: "А", to: "Б" }]);
  });
});
