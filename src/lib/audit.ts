import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentManagerId } from "@/lib/current-manager";
import { formatYmd } from "@/lib/tz";
import { leadSourceLabels, leadStatusLabels, opportunityStatusLabels, type LeadSourceValue, type LeadStatusValue } from "@/lib/labels";

export type EntityType = "lead" | "account" | "contact" | "opportunity" | "activity";
export type AuditAction = "create" | "update" | "delete" | "stage" | "convert";
export type FieldChange = { field: string; from: string | null; to: string | null };

/** Подписи полей в журнале. Поля, которых здесь нет, в журнал не попадают. */
export const FIELD_LABELS: Record<EntityType, Record<string, string>> = {
  lead: { name: "Имя", company: "Компания", email: "Email", phone: "Телефон", source: "Источник", status: "Статус", budget: "Бюджет", venue: "Площадка", deadline: "Срок", workFormat: "Формат работ", disqualifyReason: "Причина отказа", managerId: "Ответственный" },
  account: { name: "Название", industry: "Отрасль", website: "Сайт", phone: "Телефон", city: "Город" },
  contact: { firstName: "Имя", lastName: "Фамилия", position: "Должность", email: "Email", phone: "Телефон", accountId: "Компания" },
  opportunity: { title: "Название", amount: "Сумма", status: "Статус", stageId: "Стадия", accountId: "Компания", contactId: "Контакт", managerId: "Ответственный", venue: "Площадка", eventDate: "Мероприятие", lostReasonId: "Причина отказа", lostReason: "Комментарий к отказу" },
  activity: { body: "Текст", dueDate: "Срок", done: "Выполнено", assigneeId: "Исполнитель" },
};

function text(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return formatYmd(v);
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (Prisma.Decimal.isDecimal(v)) return String(Number(v.toString()));
  return String(v);
}

/** Сравнивает два снимка записи и возвращает изменённые поля из FIELD_LABELS. */
export function diffFields(entity: EntityType, before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(FIELD_LABELS[entity])) {
    if (!(field in after)) continue;
    const from = text(before[field]);
    const to = text(after[field]);
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/** Заменяет идентификаторы связей и коды перечислений на читаемые значения. */
async function humanize(entity: EntityType, changes: FieldChange[]): Promise<FieldChange[]> {
  const ids = (field: string) => changes.filter((c) => c.field === field).flatMap((c) => [c.from, c.to]).filter((x): x is string => !!x);
  const [managers, stages, accounts, contacts, reasons] = await Promise.all([
    ids("managerId").concat(ids("assigneeId")).length ? db.manager.findMany({ where: { id: { in: ids("managerId").concat(ids("assigneeId")) } }, select: { id: true, name: true } }) : [],
    ids("stageId").length ? db.stage.findMany({ where: { id: { in: ids("stageId") } }, select: { id: true, name: true } }) : [],
    ids("accountId").length ? db.account.findMany({ where: { id: { in: ids("accountId") } }, select: { id: true, name: true } }) : [],
    ids("contactId").length ? db.contact.findMany({ where: { id: { in: ids("contactId") } }, select: { id: true, firstName: true, lastName: true } }) : [],
    ids("lostReasonId").length ? db.lostReason.findMany({ where: { id: { in: ids("lostReasonId") } }, select: { id: true, name: true } }) : [],
  ]);
  const names = new Map<string, string>([
    ...managers.map((m) => [m.id, m.name] as const),
    ...stages.map((s) => [s.id, s.name] as const),
    ...accounts.map((a) => [a.id, a.name] as const),
    ...contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`] as const),
    ...reasons.map((r) => [r.id, r.name] as const),
  ]);
  const enumLabel = (field: string, v: string | null): string | null => {
    if (v === null) return null;
    if (entity === "lead" && field === "source") return leadSourceLabels[v as LeadSourceValue] ?? v;
    if (entity === "lead" && field === "status") return leadStatusLabels[v as LeadStatusValue] ?? v;
    if (entity === "opportunity" && field === "status") return opportunityStatusLabels[v as keyof typeof opportunityStatusLabels] ?? v;
    if (["managerId", "assigneeId", "stageId", "accountId", "contactId", "lostReasonId"].includes(field)) return names.get(v) ?? v;
    return v;
  };
  return changes.map((c) => ({ field: c.field, from: enumLabel(c.field, c.from), to: enumLabel(c.field, c.to) }));
}

type Entry = { entityType: EntityType; entityId: string; action: AuditAction; summary: string; changes?: FieldChange[] };

/** Записывает событие в журнал изменений. Сбой журнала не должен ломать основную операцию. */
export async function audit(entry: Entry): Promise<void> {
  try {
    const actorId = await getCurrentManagerId();
    const actor = actorId ? await db.manager.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
    const changes = entry.changes ? await humanize(entry.entityType, entry.changes) : undefined;
    await db.auditLog.create({
      data: { entityType: entry.entityType, entityId: entry.entityId, action: entry.action, summary: entry.summary, changes: changes as never, actorId, actorName: actor?.name ?? null },
    });
  } catch (error) {
    console.error("audit failed", error);
  }
}
