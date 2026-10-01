import { db } from "@/lib/db";

export { db };
export const cookieJar = () => (globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar;

/** Защита от случайного запуска на рабочей базе. */
export async function assertTestDb() {
  const [{ current_database }] = await db.$queryRaw<{ current_database: string }[]>`select current_database()`;
  if (!current_database.endsWith("_test")) throw new Error(`Тест запущен не на тестовой базе: ${current_database}`);
}

/** Очищает все таблицы данных (кроме служебных миграций). */
export async function resetDb() {
  await assertTestDb();
  await db.$executeRawUnsafe(
    `TRUNCATE "AuditLog","StageTransition","Activity","Opportunity","Lead","Contact","Account","Stage","LostReason","Manager" RESTART IDENTITY CASCADE`,
  );
  cookieJar().clear();
}

/** Базовые справочники: стадии с вероятностями, причины отказа, менеджеры. */
export async function seedReference() {
  await db.stage.createMany({
    data: [
      { id: "stage_new", code: "new", name: "Новая", position: 1, isClosed: false, probability: 10 },
      { id: "stage_qualification", code: "qualification", name: "Квалификация", position: 2, isClosed: false, probability: 25 },
      { id: "stage_proposal", code: "proposal", name: "Смета / КП", position: 3, isClosed: false, probability: 50 },
      { id: "stage_negotiation", code: "negotiation", name: "Согласование", position: 4, isClosed: false, probability: 75 },
      { id: "stage_won", code: "won", name: "Выиграна", position: 5, isClosed: true, probability: 100 },
      { id: "stage_lost", code: "lost", name: "Проиграна", position: 6, isClosed: true, probability: 0 },
    ],
  });
  await db.lostReason.createMany({
    data: [
      { id: "lr_price", name: "Цена выше ожиданий", position: 1 },
      { id: "lr_other", name: "Другое", position: 2, requiresComment: true },
    ],
  });
  await db.manager.createMany({
    data: [
      { id: "mgr_a", name: "Анна" },
      { id: "mgr_b", name: "Борис" },
    ],
  });
}

export function form(values: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== undefined) fd.set(k, v);
  return fd;
}

/** Выполняет действие, которое при успехе делает redirect, и возвращает адрес перехода либо состояние формы. */
export async function run<T>(fn: () => Promise<T>): Promise<{ redirect?: string; result?: T }> {
  try {
    return { result: await fn() };
  } catch (error) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec((error as Error).message);
    if (m) return { redirect: m[1] };
    throw error;
  }
}
