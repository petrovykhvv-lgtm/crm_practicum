import { beforeEach, describe, expect, it } from "vitest";
import { createLostReason, createManager, deleteLostReason, deleteManager, setCurrentManager, setManagerActive, updateLostReason, updateManager, updateStageProbabilities } from "@/lib/actions/settings";
import { getCurrentManagerId, getManagers, resolveManagerFilter } from "@/lib/current-manager";
import { cookieJar, db, form, resetDb, seedReference } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedReference();
});

describe("менеджеры", () => {
  it("создание проверяет имя и email, правка и отключение работают", async () => {
    expect((await createManager(undefined, form({ name: "" })))?.fieldErrors?.name).toBeTruthy();
    expect((await createManager(undefined, form({ name: "Вера", email: "плохой" })))?.fieldErrors?.email).toBeTruthy();
    expect((await createManager(undefined, form({ name: "Вера", email: "vera@example.com" })))?.ok).toBe(true);
    const vera = await db.manager.findFirstOrThrow({ where: { name: "Вера" } });
    expect((await updateManager(vera.id, undefined, form({ name: "Вера С." })))?.ok).toBe(true);
    await setManagerActive(vera.id, false);
    expect((await getManagers()).map((m) => m.name)).not.toContain("Вера С.");
  });

  it("выбор текущего менеджера хранится в cookie; неактивный или чужой идентификатор не принимается", async () => {
    await setCurrentManager("mgr_a");
    expect(cookieJar().get("crm_manager")).toBe("mgr_a");
    expect(await getCurrentManagerId()).toBe("mgr_a");
    await setManagerActive("mgr_a", false);
    expect(await getCurrentManagerId()).toBeNull();
    await setCurrentManager("несуществующий");
    expect(cookieJar().get("crm_manager")).toBe("mgr_a"); // не перезаписан
    await setCurrentManager("");
    expect(cookieJar().has("crm_manager")).toBe(false);
  });

  it("фильтр «мои», «без ответственного» и конкретный менеджер", async () => {
    expect(await resolveManagerFilter(undefined)).toBeNull();
    expect(await resolveManagerFilter("me")).toBeNull(); // менеджер не выбран
    await setCurrentManager("mgr_b");
    expect(await resolveManagerFilter("me")).toEqual({ value: "mgr_b", label: "Мои" });
    expect(await resolveManagerFilter("none")).toEqual({ value: null, label: "Без ответственного" });
    expect((await resolveManagerFilter("mgr_a"))?.label).toBe("Анна");
    expect(await resolveManagerFilter("мусор")).toBeNull();
  });

  it("удаление менеджера снимает назначения", async () => {
    const lead = await db.lead.create({ data: { name: "Л", source: "site", managerId: "mgr_a" } });
    expect((await deleteManager("mgr_a", undefined, new FormData()))?.ok).toBe(true);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).managerId).toBeNull();
  });
});

describe("справочник причин отказа", () => {
  it("нельзя создать дубль названия, используемую причину нельзя удалить", async () => {
    expect((await createLostReason(undefined, form({ name: "Цена выше ожиданий" })))?.fieldErrors?.name).toBeTruthy();
    expect((await createLostReason(undefined, form({ name: "Нет финансирования", requiresComment: "on" })))?.ok).toBe(true);
    const created = await db.lostReason.findFirstOrThrow({ where: { name: "Нет финансирования" } });
    expect(created).toMatchObject({ requiresComment: true, position: 3 });
    expect((await updateLostReason(created.id, undefined, form({ name: "Цена выше ожиданий" })))?.fieldErrors?.name).toBeTruthy();

    const account = await db.account.create({ data: { name: "А" } });
    await db.opportunity.create({ data: { title: "С", accountId: account.id, stageId: "stage_lost", status: "lost", lostReasonId: "lr_price" } });
    expect((await deleteLostReason("lr_price", undefined, new FormData()))?.message).toMatch(/используется в сделках \(1\)/);
    expect((await deleteLostReason(created.id, undefined, new FormData()))?.ok).toBe(true);
  });
});

describe("вероятности стадий", () => {
  it("принимают целые 0–100 и отклоняют остальное без частичного сохранения", async () => {
    const stages = await db.stage.findMany();
    const valid = Object.fromEntries(stages.map((s) => [`p_${s.id}`, "20"]));
    const bad = await updateStageProbabilities(undefined, form({ ...valid, p_stage_new: "150", p_stage_won: "abc" }));
    expect(Object.keys(bad?.fieldErrors ?? {}).sort()).toEqual(["p_stage_new", "p_stage_won"]);
    expect((await db.stage.findUniqueOrThrow({ where: { id: "stage_proposal" } })).probability).toBe(50); // не изменилась

    expect((await updateStageProbabilities(undefined, form(valid)))?.ok).toBe(true);
    expect((await db.stage.findUniqueOrThrow({ where: { id: "stage_proposal" } })).probability).toBe(20);
  });
});
