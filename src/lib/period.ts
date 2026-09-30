import type { SearchParams } from "@/lib/search";
import { pickParam } from "@/lib/search";

export const PERIOD_PRESETS = [
  { key: "7d", label: "7 дней", days: 7 },
  { key: "30d", label: "30 дней", days: 30 },
  { key: "90d", label: "90 дней", days: 90 },
  { key: "180d", label: "6 месяцев", days: 180 },
  { key: "365d", label: "Год", days: 365 },
] as const;

export const DEFAULT_PRESET = "90d";
export type Step = "day" | "week" | "month";
export const STEP_LABELS: Record<Step, string> = { day: "по дням", week: "по неделям", month: "по месяцам" };

const DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 731;
const MAX_POINTS = 120;

export type Period = {
  /** Ключ пресета или "custom". */
  key: string;
  from: Date;
  to: Date;
  step: Step;
  /** Шаг выбран автоматически (или был укрупнён, чтобы на графике было не больше точек, чем читаемо). */
  stepAuto: boolean;
  label: string;
  fromInput: string;
  toInput: string;
  buckets: Date[];
};

const utcMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || iso(d) !== value ? null : d;
}

/** Начало корзины, как у date_trunc(step) в PostgreSQL (неделя с понедельника, UTC). */
export function bucketStart(d: Date, step: Step): Date {
  const day = utcMidnight(d);
  if (step === "day") return day;
  if (step === "week") return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function nextBucket(d: Date, step: Step): Date {
  if (step === "day") return new Date(d.getTime() + DAY);
  if (step === "week") return new Date(d.getTime() + 7 * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function makeBuckets(from: Date, to: Date, step: Step): Date[] {
  const out: Date[] = [];
  for (let b = bucketStart(from, step); b <= to; b = nextBucket(b, step)) out.push(b);
  return out;
}

function autoStep(days: number): Step {
  return days <= 31 ? "day" : days <= 180 ? "week" : "month";
}

export function bucketLabel(d: Date, step: Step): string {
  return step === "month"
    ? d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit", timeZone: "UTC" })
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/**
 * Разбирает параметры ?period=30d | ?from=2026-09-01&to=2026-09-30 и ?step=day|week|month.
 * Некорректные значения игнорируются. Границы считаются в UTC, как и группировка по неделям в БД.
 */
export function resolvePeriod(sp: SearchParams, now = new Date()): Period {
  const today = utcMidnight(now);
  const fromParam = parseDay(pickParam(sp, "from"));
  const toParam = parseDay(pickParam(sp, "to"));
  const presetParam = pickParam(sp, "period");

  let key: string;
  let from: Date;
  let to: Date;
  if (fromParam && toParam && fromParam <= toParam) {
    key = "custom";
    to = new Date(toParam.getTime() + DAY - 1);
    from = new Date(Math.max(fromParam.getTime(), toParam.getTime() - (MAX_RANGE_DAYS - 1) * DAY));
  } else {
    const preset = PERIOD_PRESETS.find((p) => p.key === presetParam) ?? PERIOD_PRESETS.find((p) => p.key === DEFAULT_PRESET)!;
    key = preset.key;
    to = new Date(today.getTime() + DAY - 1);
    from = new Date(today.getTime() - (preset.days - 1) * DAY);
  }

  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  const requested = pickParam(sp, "step");
  let step: Step = requested === "day" || requested === "week" || requested === "month" ? requested : autoStep(days);
  let stepAuto = !(requested === "day" || requested === "week" || requested === "month");

  let buckets = makeBuckets(from, to, step);
  // Слишком много точек нечитаемо: укрупняем шаг.
  while (buckets.length > MAX_POINTS && step !== "month") {
    step = step === "day" ? "week" : "month";
    stepAuto = true;
    buckets = makeBuckets(from, to, step);
  }

  const preset = PERIOD_PRESETS.find((p) => p.key === key);
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "UTC" });
  return {
    key,
    from,
    to,
    step,
    stepAuto,
    label: preset ? `за ${preset.label.toLowerCase()}` : `${fmt(from)} – ${fmt(to)}`,
    fromInput: key === "custom" ? iso(from) : "",
    toInput: key === "custom" ? iso(to) : "",
    buckets,
  };
}
