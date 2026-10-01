"use server";

import { revalidatePath } from "next/cache";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { LEAD_SOURCES, leadSourceLabels } from "@/lib/labels";
import { leadSchema } from "@/lib/validation";

export type ImportResult = {
  ok: boolean;
  message?: string;
  dryRun?: boolean;
  total?: number;
  imported?: number;
  skipped?: { row: number; reason: string }[];
};

const MAX_ROWS = 2000;
const MAX_BYTES = 2 * 1024 * 1024;

/** Заголовки столбцов: русские и английские варианты. */
const HEADERS: Record<string, string> = {
  имя: "name", лид: "name", name: "name",
  компания: "company", company: "company",
  email: "email", почта: "email", "e-mail": "email",
  телефон: "phone", phone: "phone",
  источник: "source", source: "source",
  бюджет: "budget", budget: "budget",
  площадка: "venue", venue: "venue",
  "формат работ": "workFormat", формат: "workFormat", workformat: "workFormat",
  ответственный: "manager", менеджер: "manager", manager: "manager",
  статус: "status", status: "status",
  срок: "deadline", deadline: "deadline",
};

function sourceCode(value: string): string {
  const v = value.trim().toLowerCase();
  const byLabel = LEAD_SOURCES.find((s) => leadSourceLabels[s].toLowerCase() === v);
  return byLabel ?? (LEAD_SOURCES.find((s) => s === v) ?? value.trim());
}

/** Дата из Excel-формата дд.мм.гггг в гггг-мм-дд для схемы. */
function normalizeDate(value: string): string {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : value.trim();
}

/**
 * Импорт лидов из CSV. Каждая строка проверяется той же схемой Zod, что и форма лида.
 * Некорректные строки и дубли по email пропускаются и перечисляются в отчёте. С флажком «только проверить» ничего не записывается.
 */
export async function importLeads(_prev: ImportResult | undefined, formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  const dryRun = formData.get("dryRun") === "on";
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Выберите CSV-файл." };
  if (file.size > MAX_BYTES) return { ok: false, message: "Файл больше 2 МБ. Разбейте его на части." };

  const table = parseCsv(await file.text());
  if (table.length < 2) return { ok: false, message: "В файле нет данных: нужна строка заголовков и хотя бы одна строка лида." };
  if (table.length - 1 > MAX_ROWS) return { ok: false, message: `В файле больше ${MAX_ROWS} строк. Разбейте его на части.` };

  const columns = table[0].map((h) => HEADERS[h.trim().toLowerCase()]);
  if (!columns.includes("name")) return { ok: false, message: "Не найден столбец «Имя». Скачайте шаблон и сверьте заголовки." };

  const managers = await db.manager.findMany({ where: { active: true }, select: { id: true, name: true } });
  const managerByName = new Map(managers.map((m) => [m.name.toLowerCase(), m.id]));
  const knownEmails = new Set((await db.lead.findMany({ where: { email: { not: null } }, select: { email: true } })).map((l) => l.email!.toLowerCase()));

  const skipped: { row: number; reason: string }[] = [];
  const valid: ReturnType<typeof leadSchema.parse>[] = [];

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2; // строка в файле, считая заголовок первой
    const raw: Record<string, string> = { status: "new" };
    columns.forEach((field, i) => {
      if (field && cells[i] !== undefined) raw[field] = cells[i].trim();
    });
    if (raw.source !== undefined) raw.source = sourceCode(raw.source);
    if (raw.deadline) raw.deadline = normalizeDate(raw.deadline);
    if (raw.manager) {
      raw.managerId = managerByName.get(raw.manager.toLowerCase()) ?? "";
      if (!raw.managerId) {
        skipped.push({ row: rowNumber, reason: `Менеджер «${raw.manager}» не найден` });
        return;
      }
    }
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push({ row: rowNumber, reason: parsed.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const email = parsed.data.email?.toLowerCase();
    if (email && knownEmails.has(email)) {
      skipped.push({ row: rowNumber, reason: `Дубль: лид с email ${parsed.data.email} уже есть` });
      return;
    }
    if (email) knownEmails.add(email);
    valid.push(parsed.data);
  });

  if (!dryRun && valid.length > 0) {
    await db.lead.createMany({ data: valid.map(({ disqualifyReason, ...d }) => ({ ...d, disqualifyReason: d.status === "disqualified" ? disqualifyReason : null })) });
    revalidatePath("/leads");
    revalidatePath("/");
  }
  return { ok: true, dryRun, total: table.length - 1, imported: valid.length, skipped };
}
