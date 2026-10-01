import { formatDateRu, formatYmd } from "@/lib/tz";

export const LEAD_SOURCES = ["site", "email", "phone", "referral", "manual"] as const;
export const LEAD_STATUSES = ["new", "in_progress", "qualified", "converted", "disqualified"] as const;
export const EDITABLE_LEAD_STATUSES = ["new", "in_progress", "qualified", "disqualified"] as const;

/** Значение выбора компании при конвертации: создать новую. */
export const NEW_ACCOUNT = "new";

export type LeadSourceValue = (typeof LEAD_SOURCES)[number];
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const leadSourceLabels: Record<LeadSourceValue, string> = {
  site: "Сайт",
  email: "Почта",
  phone: "Телефон",
  referral: "Рекомендация",
  manual: "Вручную",
};

export const leadStatusLabels: Record<LeadStatusValue, string> = {
  new: "Новый",
  in_progress: "В работе",
  qualified: "Квалифицирован",
  converted: "Конвертирован",
  disqualified: "Отклонён",
};

export const leadStatusColors: Record<LeadStatusValue, string> = {
  new: "var(--stage-new)",
  in_progress: "var(--warning)",
  qualified: "var(--green)",
  converted: "var(--forest)",
  disqualified: "var(--stage-lost)",
};

export const opportunityStatusLabels = { open: "В работе", won: "Выиграна", lost: "Проиграна" } as const;
export const opportunityStatusColors = { open: "var(--teal)", won: "var(--stage-won)", lost: "var(--stage-lost)" } as const;

export const stageColors: Record<string, string> = {
  new: "var(--stage-new)",
  qualification: "var(--stage-qualification)",
  proposal: "var(--stage-proposal)",
  negotiation: "var(--stage-negotiation)",
  won: "var(--stage-won)",
  lost: "var(--stage-lost)",
};

export function formatMoney(value: { toString(): string } | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value.toString()));
}

export function formatDate(value: Date | null | undefined): string {
  return value ? formatDateRu(value) : "—";
}

/** Значение для <input type="date"> в локальном часовом поясе. */
export function toDateInput(value: Date | null | undefined): string {
  return value ? formatYmd(value) : "";
}

export function toAmountInput(value: { toString(): string } | null | undefined): string {
  return value === null || value === undefined ? "" : String(Number(value.toString()));
}

/** Цвета для диаграмм (canvas не понимает CSS-переменные, поэтому здесь конкретные значения). */
export const stageChartColors: Record<string, string> = {
  new: "#6F97A8",
  qualification: "#A9BFAF",
  proposal: "#E7C9A0",
  negotiation: "#E8853D",
  won: "#2F8A63",
  lost: "#B9A99B",
};

export const leadStatusChartColors: Record<LeadStatusValue, string> = {
  new: "#6F97A8",
  in_progress: "#D89A2B",
  qualified: "#2F8A63",
  converted: "#1F5142",
  disqualified: "#B9A99B",
};
