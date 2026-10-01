import { describe, expect, it } from "vitest";
import { addDays, dayNoon, dayStart, formatYmd, parseYmd, startOfDay, ymdOf } from "@/lib/tz";

describe("часовой пояс приложения", () => {
  it("локальная полночь Москвы: 30 сентября 00:00 = 29 сентября 21:00 UTC", () => {
    expect(dayStart({ y: 2026, m: 9, d: 30 }, "Europe/Moscow").toISOString()).toBe("2026-09-29T21:00:00.000Z");
  });
  it("полдень хранится как локальный полдень", () => {
    expect(dayNoon({ y: 2026, m: 10, d: 5 }, "Europe/Moscow").toISOString()).toBe("2026-10-05T09:00:00.000Z");
  });
  it("день определяется по поясу, а не по UTC", () => {
    const at = new Date("2026-09-29T21:30:00Z"); // в Москве уже 30 сентября
    expect(ymdOf(at, "Europe/Moscow")).toEqual({ y: 2026, m: 9, d: 30 });
    expect(formatYmd(at, "Europe/Moscow")).toBe("2026-09-30");
    expect(startOfDay(at, "Europe/Moscow").toISOString()).toBe("2026-09-29T21:00:00.000Z");
  });
  it("переход на летнее время: сутки 8 марта в Нью-Йорке длятся 23 часа", () => {
    const start = dayStart({ y: 2026, m: 3, d: 8 }, "America/New_York");
    const next = addDays(start, 1, "America/New_York");
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
  it("выход за границы месяца нормализуется", () => {
    expect(dayStart({ y: 2026, m: 9, d: 31 }, "UTC").toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("parseYmd отвергает несуществующие даты и неверный формат", () => {
    expect(parseYmd("2026-02-31")).toBeNull();
    expect(parseYmd("30.09.2026")).toBeNull();
    expect(parseYmd(undefined)).toBeNull();
    expect(parseYmd("2026-09-30")).toEqual({ y: 2026, m: 9, d: 30 });
  });
});
