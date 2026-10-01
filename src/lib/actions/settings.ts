"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { MANAGER_COOKIE } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { actionError, fieldError, parseForm, rawValues, type FormState } from "./shared";

const text = (label: string, max: number) =>
  z.string({ error: `${label}: обязательное поле` }).trim().min(1, `${label}: обязательное поле`).max(max, `${label}: не более ${max} символов`);
const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Введите корректный email");

const managerSchema = z.object({ name: text("Имя", 100), email: optionalEmail });
const reasonSchema = z.object({
  name: text("Название", 100),
  requiresComment: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Выбор текущего менеджера («работаю как»). Пустое значение сбрасывает выбор. Авторизации нет. */
export async function setCurrentManager(id: string): Promise<void> {
  const jar = await cookies();
  if (!id) {
    jar.delete(MANAGER_COOKIE);
  } else {
    const manager = await db.manager.findFirst({ where: { id, active: true }, select: { id: true } });
    if (manager) jar.set(MANAGER_COOKIE, manager.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  revalidateAll();
}

/* ---------- Менеджеры ---------- */

export async function createManager(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(managerSchema, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await db.manager.create({ data: parsed.data });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAll();
  return { ok: true };
}

export async function updateManager(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(managerSchema, formData);
  if (!parsed.ok) return parsed.state;
  try {
    await db.manager.update({ where: { id }, data: parsed.data });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAll();
  return { ok: true };
}

export async function setManagerActive(id: string, active: boolean): Promise<void> {
  await db.manager.update({ where: { id }, data: { active } });
  revalidateAll();
}

/** Удаление менеджера: назначения (лиды, сделки, задачи) становятся «без ответственного». */
export async function deleteManager(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    await db.manager.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidateAll();
  return { ok: true };
}

/* ---------- Причины отказа ---------- */

export async function createLostReason(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(reasonSchema, formData);
  if (!parsed.ok) return parsed.state;
  try {
    if (await db.lostReason.findUnique({ where: { name: parsed.data.name } })) return fieldError(rawValues(formData), "name", "Такая причина уже есть");
    const last = await db.lostReason.aggregate({ _max: { position: true } });
    await db.lostReason.create({ data: { ...parsed.data, position: (last._max.position ?? 0) + 1 } });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAll();
  return { ok: true };
}

export async function updateLostReason(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(reasonSchema, formData);
  if (!parsed.ok) return parsed.state;
  try {
    const clash = await db.lostReason.findFirst({ where: { name: parsed.data.name, id: { not: id } } });
    if (clash) return fieldError(rawValues(formData), "name", "Такая причина уже есть");
    await db.lostReason.update({ where: { id }, data: parsed.data });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteLostReason(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const used = await db.opportunity.count({ where: { lostReasonId: id } });
    if (used > 0) return { message: `Причина используется в сделках (${used}). Удалить её нельзя, переименуйте её.` };
    await db.lostReason.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidateAll();
  return { ok: true };
}

/* ---------- Вероятности стадий ---------- */

export async function updateStageProbabilities(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const stages = await db.stage.findMany({ select: { id: true, name: true } });
    const errors: Record<string, string[]> = {};
    const updates: { id: string; probability: number }[] = [];
    for (const stage of stages) {
      const raw = String(formData.get(`p_${stage.id}`) ?? "").trim();
      const n = Number(raw);
      if (raw === "" || !Number.isInteger(n) || n < 0 || n > 100) errors[`p_${stage.id}`] = [`${stage.name}: целое число от 0 до 100`];
      else updates.push({ id: stage.id, probability: n });
    }
    if (Object.keys(errors).length) return { message: "Проверьте выделенные поля и попробуйте ещё раз.", fieldErrors: errors, values: rawValues(formData) };
    await db.$transaction(updates.map((u) => db.stage.update({ where: { id: u.id }, data: { probability: u.probability } })));
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAll();
  return { ok: true };
}
