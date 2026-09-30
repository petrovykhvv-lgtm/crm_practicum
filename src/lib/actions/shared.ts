import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";

export type { FormState };

export type ParseResult<T> = { ok: true; data: T } | { ok: false; state: NonNullable<FormState> };

/** Разбирает FormData через Zod и возвращает либо данные, либо состояние формы с ошибками по полям. */
export function parseForm<T>(schema: z.ZodType<T>, formData: FormData): ParseResult<T> {
  const raw = rawValues(formData);
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const flat = z.flattenError(result.error);
  return {
    ok: false,
    state: {
      message: flat.formErrors[0] ?? "Проверьте выделенные поля и попробуйте ещё раз.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
      values: raw,
    },
  };
}

export function rawValues(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION")) raw[key] = typeof value === "string" ? value : "";
  }
  return raw;
}

export function fieldError(values: Record<string, string>, field: string, message: string): NonNullable<FormState> {
  return { message: "Проверьте выделенные поля и попробуйте ещё раз.", fieldErrors: { [field]: [message] }, values };
}

/** Превращает ошибку бэкенда в понятное пользователю сообщение. Ошибки не скрываются. */
export function actionError(error: unknown, values?: Record<string, string>): NonNullable<FormState> {
  console.error(error);
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { message: "Нет соединения с базой данных. Проверьте, что PostgreSQL запущен и DATABASE_URL верен.", values };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return { message: "Запись не найдена: возможно, её уже удалили.", values };
    if (error.code === "P2003") return { message: "Операция нарушает связи между записями. Сначала удалите или переназначьте связанные данные.", values };
    return { message: `Ошибка базы данных (${error.code}). Попробуйте ещё раз.`, values };
  }
  const detail = error instanceof Error ? `: ${error.message}` : "";
  return { message: `Не удалось выполнить операцию${detail}`, values };
}
