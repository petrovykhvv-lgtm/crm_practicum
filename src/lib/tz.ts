/**
 * Единый часовой пояс приложения. Все границы «сегодня», недель и месяцев считаются в нём.
 * Задаётся переменной APP_TIMEZONE (например, Europe/Moscow), по умолчанию это пояс сервера.
 */
export const APP_TZ: string = process.env.APP_TIMEZONE?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export type Ymd = { y: number; m: number; d: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    partsCache.set(tz, f);
  }
  return f;
}

function wall(at: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(at)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Смещение пояса (локальное время минус UTC) в миллисекундах в указанный момент. */
function offsetMs(at: Date, tz: string): number {
  const w = wall(at, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** Календарная дата момента в поясе приложения. */
export function ymdOf(at: Date = new Date(), tz: string = APP_TZ): Ymd {
  const w = wall(at, tz);
  return { y: w.year, m: w.month, d: w.day };
}

/** Момент локальной полуночи указанной даты (месяц и день можно выходить за границы: 32-е = 1-е следующего месяца). */
export function dayStart({ y, m, d }: Ymd, tz: string = APP_TZ): Date {
  const utcGuess = Date.UTC(y, m - 1, d);
  const first = utcGuess - offsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - offsetMs(new Date(first), tz));
}

/** Момент локального полудня указанной даты: так хранятся даты без времени (срок задачи, дата мероприятия). */
export function dayNoon({ y, m, d }: Ymd, tz: string = APP_TZ): Date {
  return new Date(dayStart({ y, m, d }, tz).getTime() + 12 * 60 * 60 * 1000);
}

/** Начало дня (локальная полночь), в котором находится момент. */
export function startOfDay(at: Date = new Date(), tz: string = APP_TZ): Date {
  return dayStart(ymdOf(at, tz), tz);
}

/** Начало дня со сдвигом на n календарных дней (корректно при переходе на летнее время). */
export function addDays(start: Date, n: number, tz: string = APP_TZ): Date {
  const { y, m, d } = ymdOf(start, tz);
  return dayStart({ y, m, d: d + n }, tz);
}

/** Дата в формате yyyy-mm-dd в поясе приложения (для <input type="date"> и ключей). */
export function formatYmd(at: Date, tz: string = APP_TZ): string {
  const { y, m, d } = ymdOf(at, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Разбор yyyy-mm-dd, null для некорректных дат (например, 2026-02-31). */
export function parseYmd(value: string | undefined): Ymd | null {
  const match = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}

export function formatDateRu(at: Date, tz: string = APP_TZ): string {
  return at.toLocaleDateString("ru-RU", { timeZone: tz });
}

export function formatDateTimeRu(at: Date, tz: string = APP_TZ): string {
  return at.toLocaleString("ru-RU", { timeZone: tz, dateStyle: "short", timeStyle: "short" });
}
