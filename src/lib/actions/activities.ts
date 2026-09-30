"use server";

import { revalidatePath } from "next/cache";
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

/** Добавляет заметку или задачу к карточке сущности. Для задачи срок обязателен. */
export async function addActivity(kind: ActivityTarget, id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(activitySchema, formData);
  if (!parsed.ok) return parsed.state;
  const { type, body, dueDate } = parsed.data;

  try {
    if (!(await targetExists(kind, id))) return { message: "Запись не найдена: возможно, её уже удалили." };
    await db.activity.create({
      data: { type, body, dueDate: type === "task" ? dueDate : null, [foreignKey[kind]]: id },
    });
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
    const activity = await db.activity.findUnique({ where: { id: activityId }, select: { type: true } });
    if (!activity) return { ok: false, message: "Задача не найдена: возможно, её уже удалили." };
    if (activity.type !== "task") return { ok: false, message: "Отметить можно только задачу." };
    await db.activity.update({ where: { id: activityId }, data: { done, completedAt: done ? new Date() : null } });
  } catch (error) {
    return { ok: false, message: actionError(error).message ?? "Не удалось обновить задачу." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Правка текста заметки или текста и срока задачи. Тип активности не меняется. */
export async function updateActivity(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const existing = await db.activity.findUnique({ where: { id }, select: { type: true } });
    if (!existing) return { message: "Запись не найдена: возможно, её уже удалили." };

    formData.set("type", existing.type);
    const parsed = parseForm(activitySchema, formData);
    if (!parsed.ok) return parsed.state;
    const { body, dueDate } = parsed.data;

    await db.activity.update({ where: { id }, data: { body, dueDate: existing.type === "task" ? dueDate : null } });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteActivity(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const existing = await db.activity.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { ok: true }; // уже удалена, цель достигнута
    await db.activity.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
