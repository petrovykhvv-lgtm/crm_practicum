"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import type { EntityType } from "@/lib/audit";
import { db } from "@/lib/db";
import { activitySchema } from "@/lib/validation";
import { actionError, parseForm, rawValues, type FormState } from "./shared";

export type ActivityTarget = "opportunity" | "lead" | "contact" | "account";

const foreignKey = {
  opportunity: "opportunityId",
  lead: "leadId",
  contact: "contactId",
  account: "accountId",
} as const;

async function targetExists(kind: ActivityTarget, id: string): Promise<boolean> {
  switch (kind) {
    case "opportunity":
      return !!(await db.opportunity.findUnique({ where: { id }, select: { id: true } }));
    case "lead":
      return !!(await db.lead.findUnique({ where: { id }, select: { id: true } }));
    case "contact":
      return !!(await db.contact.findUnique({ where: { id }, select: { id: true } }));
    case "account":
      return !!(await db.account.findUnique({ where: { id }, select: { id: true } }));
  }
}

/** Родительская сущность активности: под неё пишутся события журнала. */
function parentOf(a: { opportunityId: string | null; leadId: string | null; contactId: string | null; accountId: string | null }): { type: EntityType; id: string } | null {
  if (a.opportunityId) return { type: "opportunity", id: a.opportunityId };
  if (a.leadId) return { type: "lead", id: a.leadId };
  if (a.contactId) return { type: "contact", id: a.contactId };
  if (a.accountId) return { type: "account", id: a.accountId };
  return null;
}

const short = (text: string) => (text.length > 60 ? `${text.slice(0, 60)}…` : text);

/** Добавляет заметку или задачу к карточке сущности. Для задачи срок обязателен. */
export async function addActivity(kind: ActivityTarget, id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(activitySchema, formData);
  if (!parsed.ok) return parsed.state;
  const { type, body, dueDate, assigneeId } = parsed.data;

  try {
    if (!(await targetExists(kind, id))) return { message: "Запись не найдена: возможно, её уже удалили." };
    await db.activity.create({
      data: { type, body, dueDate: type === "task" ? dueDate : null, assigneeId: type === "task" ? assigneeId : null, [foreignKey[kind]]: id },
    });
    await audit({ entityType: kind, entityId: id, action: "update", summary: `${type === "task" ? "Добавлена задача" : "Добавлена заметка"}: «${short(body)}»` });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export type ToggleResult = { ok: true } | { ok: false; message: string };

/** Отмечает задачу выполненной или возвращает в работу. */
export async function toggleTask(activityId: string, done: boolean): Promise<ToggleResult> {
  try {
    const activity = await db.activity.findUnique({ where: { id: activityId } });
    if (!activity) return { ok: false, message: "Задача не найдена: возможно, её уже удалили." };
    if (activity.type !== "task") return { ok: false, message: "Отметить можно только задачу." };
    await db.activity.update({ where: { id: activityId }, data: { done, completedAt: done ? new Date() : null } });
    const parent = parentOf(activity);
    if (parent) await audit({ entityType: parent.type, entityId: parent.id, action: "update", summary: `${done ? "Задача выполнена" : "Задача возвращена в работу"}: «${short(activity.body)}»` });
  } catch (error) {
    return { ok: false, message: actionError(error).message ?? "Не удалось обновить задачу." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Правка текста заметки или текста, срока и исполнителя задачи. Тип активности не меняется. */
export async function updateActivity(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const existing = await db.activity.findUnique({ where: { id } });
    if (!existing) return { message: "Запись не найдена: возможно, её уже удалили." };

    formData.set("type", existing.type);
    const parsed = parseForm(activitySchema, formData);
    if (!parsed.ok) return parsed.state;
    const { body, dueDate, assigneeId } = parsed.data;

    await db.activity.update({
      where: { id },
      data: { body, dueDate: existing.type === "task" ? dueDate : null, assigneeId: existing.type === "task" ? assigneeId : null },
    });
    const parent = parentOf(existing);
    if (parent) await audit({ entityType: parent.type, entityId: parent.id, action: "update", summary: `Изменена ${existing.type === "task" ? "задача" : "заметка"}: «${short(body)}»` });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteActivity(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const existing = await db.activity.findUnique({ where: { id } });
    if (!existing) return { ok: true }; // уже удалена, цель достигнута
    await db.activity.delete({ where: { id } });
    const parent = parentOf(existing);
    if (parent) await audit({ entityType: parent.type, entityId: parent.id, action: "update", summary: `Удалена ${existing.type === "task" ? "задача" : "заметка"}: «${short(existing.body)}»` });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
