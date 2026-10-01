import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const MANAGER_COOKIE = "crm_manager";

/** Активные менеджеры для выпадающих списков. */
export async function getManagers() {
  return db.manager.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Идентификатор текущего менеджера из cookie, если такой менеджер существует и активен. */
export async function getCurrentManagerId(): Promise<string | null> {
  let id: string | undefined;
  try {
    id = (await cookies()).get(MANAGER_COOKIE)?.value;
  } catch {
    return null; // вне запроса (тесты, скрипты)
  }
  if (!id) return null;
  const manager = await db.manager.findFirst({ where: { id, active: true }, select: { id: true } });
  return manager?.id ?? null;
}

/**
 * Фильтр по ответственному из параметра ?manager=: "me" — текущий менеджер, "none" — без ответственного,
 * иначе идентификатор. Пустое значение или неизвестный менеджер означают «все».
 */
export async function resolveManagerFilter(value: string | undefined): Promise<{ value: string | null; label: string } | null> {
  if (!value) return null;
  if (value === "none") return { value: null, label: "Без ответственного" };
  if (value === "me") {
    const id = await getCurrentManagerId();
    return id ? { value: id, label: "Мои" } : null;
  }
  const m = await db.manager.findUnique({ where: { id: value }, select: { id: true, name: true } });
  return m ? { value: m.id, label: m.name } : null;
}
