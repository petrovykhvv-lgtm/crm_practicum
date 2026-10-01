import { describe, expect, it } from "vitest";
import { resolvePeriod } from "@/lib/period";

const NOW = new Date("2026-09-30T10:00:00Z"); // среда, 30 сентября (Europe/Moscow, задаётся в tests/setup.ts)

describe("resolvePeriod", () => {
  it("по умолчанию 90 дней с шагом «неделя»", () => {
    const p = resolvePeriod({}, NOW);
    expect(p.key).toBe("90d");
    expect(p.step).toBe("week");
    expect(p.stepAuto).toBe(true);
    expect(p.buckets[0].key).toBe("2026-06-29"); // понедельник недели, где лежит начало периода
    expect(p.buckets.at(-1)?.key).toBe("2026-09-28"); // понедельник текущей недели
    expect(p.buckets.every((b, i, a) => i === 0 || b.key > a[i - 1].key)).toBe(true);
  });
  it("7 дней: шаг «день», 7 точек, последняя точка сегодня", () => {
    const p = resolvePeriod({ period: "7d" }, NOW);
    expect(p.step).toBe("day");
    expect(p.buckets).toHaveLength(7);
    expect(p.buckets.at(-1)?.key).toBe("2026-09-30");
    expect(p.buckets[0].key).toBe("2026-09-24");
  });
  it("год по месяцам автоматически не выбирается до 180 дней, дальше месяцы", () => {
    expect(resolvePeriod({ period: "180d" }, NOW).step).toBe("week");
    expect(resolvePeriod({ period: "365d" }, NOW).step).toBe("month");
  });
  it("свои даты важнее пресета, границы включают весь последний день", () => {
    const p = resolvePeriod({ period: "7d", from: "2026-08-01", to: "2026-08-31", step: "month" }, NOW);
    expect(p.key).toBe("custom");
    expect(p.step).toBe("month");
    expect(p.stepAuto).toBe(false);
    expect(p.buckets.map((b) => b.key)).toEqual(["2026-08-01"]);
    expect(p.to.getTime()).toBeGreaterThan(new Date("2026-08-31T20:00:00Z").getTime());
    expect(p.fromInput).toBe("2026-08-01");
  });
  it("некорректные параметры игнорируются", () => {
    const p = resolvePeriod({ period: "zzz", from: "bad", to: "2026-09-01", step: "hour" }, NOW);
    expect(p.key).toBe("90d");
    expect(p.step).toBe("week");
    expect(resolvePeriod({ from: "2026-09-30", to: "2026-09-01" }, NOW).key).toBe("90d"); // «с» позже «по»
  });
  it("слишком длинный диапазон обрезается до 731 дня, слишком мелкий шаг укрупняется", () => {
    const p = resolvePeriod({ from: "2020-01-01", to: "2026-09-30", step: "day" }, NOW);
    expect(p.step).not.toBe("day");
    expect(p.buckets.length).toBeLessThanOrEqual(120);
    expect(p.fromInput >= "2024-09-29").toBe(true);
  });
  it("подписи: день дд.мм, месяц коротко", () => {
    expect(resolvePeriod({ period: "7d" }, NOW).buckets.at(-1)?.label).toBe("30.09");
    expect(resolvePeriod({ period: "365d" }, NOW).buckets.at(-1)?.label).toMatch(/сент/);
  });
});
