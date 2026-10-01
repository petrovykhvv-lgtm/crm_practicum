import { beforeEach, describe, expect, it } from "vitest";
import { addActivity, deleteActivity, toggleTask, updateActivity } from "@/lib/actions/activities";
import { db, form, resetDb, seedReference } from "../helpers/db";

let dealId: string;
beforeEach(async () => {
  await resetDb();
  await seedReference();
  const account = await db.account.create({ data: { name: "А" } });
  dealId = (await db.opportunity.create({ data: { title: "Сделка", accountId: account.id, stageId: "stage_new" } })).id;
});

describe("активности", () => {
  it("заметка сохраняется без срока, задача требует срок и сохраняет его вместе с исполнителем", async () => {
    expect((await addActivity("opportunity", dealId, undefined, form({ type: "note", body: "Созвонились" })))?.ok).toBe(true);
    const badTask = await addActivity("opportunity", dealId, undefined, form({ type: "task", body: "Отправить КП" }));
    expect(badTask?.fieldErrors?.dueDate).toBeTruthy();
    expect((await addActivity("opportunity", dealId, undefined, form({ type: "task", body: "Отправить КП", dueDate: "2026-10-05", assigneeId: "mgr_a" })))?.ok).toBe(true);

    const task = await db.activity.findFirstOrThrow({ where: { type: "task" } });
    expect(task).toMatchObject({ opportunityId: dealId, assigneeId: "mgr_a", done: false });
    expect(task.dueDate?.toISOString()).toBe("2026-10-05T09:00:00.000Z"); // локальный полдень Europe/Moscow
    expect((await db.activity.findFirstOrThrow({ where: { type: "note" } })).dueDate).toBeNull();
  });

  it("отметка выполнения сохраняет done и время, снятие возвращает задачу", async () => {
    await addActivity("opportunity", dealId, undefined, form({ type: "task", body: "Задача", dueDate: "2026-10-05" }));
    const task = await db.activity.findFirstOrThrow();
    expect((await toggleTask(task.id, true)).ok).toBe(true);
    let t = await db.activity.findUniqueOrThrow({ where: { id: task.id } });
    expect(t.done).toBe(true);
    expect(t.completedAt).not.toBeNull();
    await toggleTask(task.id, false);
    t = await db.activity.findUniqueOrThrow({ where: { id: task.id } });
    expect(t).toMatchObject({ done: false, completedAt: null });
  });

  it("заметку нельзя «выполнить»", async () => {
    await addActivity("opportunity", dealId, undefined, form({ type: "note", body: "Заметка" }));
    const note = await db.activity.findFirstOrThrow();
    expect(await toggleTask(note.id, true)).toMatchObject({ ok: false });
  });

  it("правка меняет текст и срок, не меняя тип; для задачи срок остаётся обязательным", async () => {
    await addActivity("opportunity", dealId, undefined, form({ type: "task", body: "Старый текст", dueDate: "2026-10-05" }));
    const task = await db.activity.findFirstOrThrow();
    const bad = await updateActivity(task.id, undefined, form({ body: "Новый", dueDate: "" }));
    expect(bad?.fieldErrors?.dueDate).toBeTruthy();
    expect((await updateActivity(task.id, undefined, form({ body: "Новый текст", dueDate: "2026-10-09", assigneeId: "mgr_b" })))?.ok).toBe(true);
    const t = await db.activity.findUniqueOrThrow({ where: { id: task.id } });
    expect(t).toMatchObject({ type: "task", body: "Новый текст", assigneeId: "mgr_b" });
    expect(t.dueDate?.toISOString()).toBe("2026-10-09T09:00:00.000Z");
  });

  it("удаление убирает активность и пишет журнал в карточку родителя; повторное удаление безопасно", async () => {
    await addActivity("opportunity", dealId, undefined, form({ type: "note", body: "Удалить меня" }));
    const note = await db.activity.findFirstOrThrow();
    expect((await deleteActivity(note.id, undefined, new FormData()))?.ok).toBe(true);
    expect(await db.activity.count()).toBe(0);
    expect((await deleteActivity(note.id, undefined, new FormData()))?.ok).toBe(true);
    const logs = await db.auditLog.findMany({ where: { entityType: "opportunity", entityId: dealId } });
    expect(logs.map((l) => l.summary).join("|")).toMatch(/Удалена заметка/);
  });

  it("активность к несуществующей сущности не создаётся", async () => {
    const r = await addActivity("lead", "nope", undefined, form({ type: "note", body: "x" }));
    expect(r?.message).toMatch(/не найдена/);
    expect(await db.activity.count()).toBe(0);
  });

  it("на уровне БД у активности не может быть двух целей или ни одной", async () => {
    const lead = await db.lead.create({ data: { name: "Л", source: "site" } });
    await expect(db.activity.create({ data: { type: "note", body: "x", opportunityId: dealId, leadId: lead.id } })).rejects.toThrow();
    await expect(db.activity.create({ data: { type: "note", body: "x" } })).rejects.toThrow();
  });
});
