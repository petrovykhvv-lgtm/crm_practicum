import type { SearchParams } from "@/lib/search";
import { pickParam } from "@/lib/search";
import { APP_TZ, addDays, dayStart, formatYmd, parseYmd, startOfDay, ymdOf, type Ymd } from "@/lib/tz";

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

/** Корзина графика: ключ yyyy-mm-dd совпадает с date_trunc(шаг) в часовом поясе приложения. */
export type Bucket = { key: string; label: string };

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
  buckets: Bucket[];
};

const utc = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d));
const ymdKey = ({ y, m, d }: Ymd) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const normalize = (v: Ymd): Ymd => {
  const n = new Date(Date.UTC(v.y, v.m - 1, v.d));
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
};

/** Начало корзины (календарная дата, неделя с понедельника), как у date_trunc в PostgreSQL. */
export function bucketStart(v: Ymd, step: Step): Ymd {
  const n = normalize(v);
  if (step === "day") return n;
  if (step === "week") return normalize({ y: n.y, m: n.m, d: n.d - ((utc(n).getUTCDay() + 6) % 7) });
  return { y: n.y, m: n.m, d: 1 };
}

function nextBucket(v: Ymd, step: Step): Ymd {
  if (step === "day") return normalize({ ...v, d: v.d + 1 });
  if (step === "week") return normalize({ ...v, d: v.d + 7 });
  return normalize({ y: v.y, m: v.m + 1, d: 1 });
}

export function bucketLabel(v: Ymd, step: Step): string {
  return step === "month"
    ? utc(v).toLocaleDateString("ru-RU", { month: "short", year: "2-digit", timeZone: "UTC" })
    : utc(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function makeBuckets(from: Ymd, to: Ymd, step: Step): Bucket[] {
  const out: Bucket[] = [];
  const last = ymdKey(normalize(to));
  for (let b = bucketStart(from, step); ymdKey(b) <= last; b = nextBucket(b, step)) out.push({ key: ymdKey(b), label: bucketLabel(b, step) });
  return out;
}

function autoStep(days: number): Step {
  return days <= 31 ? "day" : days <= 180 ? "week" : "month";
}

/**
 * Разбирает параметры ?period=30d | ?from=2026-09-01&to=2026-09-30 и ?step=day|week|month.
 * Некорректные значения игнорируются. Границы считаются в часовом поясе приложения (APP_TIMEZONE).
 */
export function resolvePeriod(sp: SearchParams, now = new Date()): Period {
  const fromParam = parseYmd(pickParam(sp, "from") ?? undefined);
  const toParam = parseYmd(pickParam(sp, "to") ?? undefined);
  const presetParam = pickParam(sp, "period");
  const today = ymdOf(now);

  let key: string;
  let fromYmd: Ymd;
  let toYmd: Ymd;
  if (fromParam && toParam && ymdKey(fromParam) <= ymdKey(toParam)) {
    key = "custom";
    toYmd = toParam;
    const span = Math.round((utc(toParam).getTime() - utc(fromParam).getTime()) / DAY) + 1;
    fromYmd = span > MAX_RANGE_DAYS ? normalize({ y: toParam.y, m: toParam.m, d: toParam.d - (MAX_RANGE_DAYS - 1) }) : fromParam;
  } else {
    const preset = PERIOD_PRESETS.find((p) => p.key === presetParam) ?? PERIOD_PRESETS.find((p) => p.key === DEFAULT_PRESET)!;
    key = preset.key;
    toYmd = today;
    fromYmd = normalize({ y: today.y, m: today.m, d: today.d - (preset.days - 1) });
  }

  const from = dayStart(fromYmd);
  const to = new Date(dayStart({ ...toYmd, d: toYmd.d + 1 }).getTime() - 1);
  const days = Math.round((utc(toYmd).getTime() - utc(fromYmd).getTime()) / DAY);

  const requested = pickParam(sp, "step");
  const explicit = requested === "day" || requested === "week" || requested === "month";
  let step: Step = explicit ? requested : autoStep(days);
  let stepAuto = !explicit;

  let buckets = makeBuckets(fromYmd, toYmd, step);
  // Слишком много точек нечитаемо: укрупняем шаг.
  while (buckets.length > MAX_POINTS && step !== "month") {
    step = step === "day" ? "week" : "month";
    stepAuto = true;
    buckets = makeBuckets(fromYmd, toYmd, step);
  }

  const preset = PERIOD_PRESETS.find((p) => p.key === key);
  const fmt = (v: Ymd) => utc(v).toLocaleDateString("ru-RU", { timeZone: "UTC" });
  return {
    key,
    from,
    to,
    step,
    stepAuto,
    label: preset ? `за ${preset.label.toLowerCase()}` : `${fmt(fromYmd)} – ${fmt(toYmd)}`,
    fromInput: key === "custom" ? ymdKey(fromYmd) : "",
    toInput: key === "custom" ? ymdKey(toYmd) : "",
    buckets,
  };
}

export { APP_TZ, addDays, formatYmd, startOfDay };
