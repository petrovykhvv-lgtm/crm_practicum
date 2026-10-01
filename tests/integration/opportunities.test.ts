import { beforeEach, describe, expect, it } from "vitest";
import { changeStage, createOpportunity, deleteOpportunity, updateOpportunity } from "@/lib/actions/opportunities";
import { db, form, resetDb, run, seedReference } from "../helpers/db";

let accountId: string;
let contactId: string;

beforeEach(async () => {
  await resetDb();
  await seedReference();
  accountId = (await db.account.create({ data: { name: "Nordic Home" } })).id;
  contactId = (await db.contact.create({ data: { firstName: "Мария", lastName: "Ким", accountId } })).id;
});

const dealForm = (over: Record<string, string> = {}) => form({ title: "Бренд-зона", accountId, stageId: "stage_new", ...over });

describe("создание сделки", () => {
  it("создаёт сделку на стадии, пишет переход и журнал, перенаправляет на карточку", async () => {
    const r = await run(() => createOpportunity(undefined, dealForm({ amount: "1 500 000", contactId, managerId: "mgr_a" })));
    const deal = await db.opportunity.findFirstOrThrow({ include: { transitions: true } });
    expect(r.redirect).toBe(`/opportunities/${deal.id}`);
    expect(Number(deal.amount)).toBe(1_500_000);
    expect(deal.status).toBe("open");
    expect(deal.managerId).toBe("mgr_a");
    expect(deal.transitions).toHaveLength(1);
    expect(deal.transitions[0].stageId).toBe("stage_new");
    expect(await db.auditLog.count({ where: { entityType: "opportunity", entityId: deal.id, action: "create" } })).toBe(1);
  });

  it("не создаёт сделку без названия и выводит ошибку поля", async () => {
    const r = await run(() => createOpportunity(undefined, dealForm({ title: "  " })));
    expect(r.result?.fieldErrors?.title?.[0]).toMatch(/обязательное/);
    expect(await db.opportunity.count()).toBe(0);
  });

  it("выигрыш блокируется без суммы и без контакта", async () => {
    const noAmount = await run(() => createOpportunity(undefined, dealForm({ stageId: "stage_won", contactId })));
    expect(noAmount.result?.fieldErrors?.amount).toBeTruthy();
    const noContact = await run(() => createOpportunity(undefined, dealForm({ stageId: "stage_won", amount: "1000" })));
    expect(noContact.result?.fieldErrors?.contactId).toBeTruthy();
    expect(await db.opportunity.count()).toBe(0);
  });

  it("контакт другой компании не принимается", async () => {
    const other = await db.account.create({ data: { name: "Другая" } });
    const foreign = await db.contact.create({ data: { firstName: "Пётр", lastName: "Чужой", accountId: other.id } });
    const r = await run(() => createOpportunity(undefined, dealForm({ contactId: foreign.id })));
    expect(r.result?.fieldErrors?.contactId?.[0]).toMatch(/другой компании/);
    expect(await db.opportunity.count()).toBe(0);
  });

  it("проигрыш требует причину из справочника, для «Другое» ещё и комментарий", async () => {
    const noReason = await run(() => createOpportunity(undefined, dealForm({ stageId: "stage_lost" })));
    expect(noReason.result?.fieldErrors?.lostReasonId).toBeTruthy();
    const noComment = await run(() => createOpportunity(undefined, dealForm({ stageId: "stage_lost", lostReasonId: "lr_other" })));
    expect(noComment.result?.fieldErrors?.lostReason).toBeTruthy();
    const ok = await run(() => createOpportunity(undefined, dealForm({ stageId: "stage_lost", lostReasonId: "lr_price" })));
    expect(ok.redirect).toMatch(/^\/opportunities\//);
    const deal = await db.opportunity.findFirstOrThrow();
    expect(deal.status).toBe("lost");
    expect(deal.closedAt).not.toBeNull();
    expect(deal.lostReasonId).toBe("lr_price");
  });
});

describe("смена стадии", () => {
  async function makeDeal(amount: number | null = 1_000_000, withContact = true) {
    return db.opportunity.create({
      data: { title: "Сделка", accountId, contactId: withContact ? contactId : null, stageId: "stage_new", amount, transitions: { create: { stageId: "stage_new", amount } } },
    });
  }

  it("открытая стадия: обновляет стадию, пишет переход и журнал стадий", async () => {
    const deal = await makeDeal();
    const r = await changeStage(deal.id, "stage_proposal", null, null);
    expect(r.ok).toBe(true);
    const after = await db.opportunity.findUniqueOrThrow({ where: { id: deal.id }, include: { transitions: true } });
    expect(after.stageId).toBe("stage_proposal");
    expect(after.status).toBe("open");
    expect(after.transitions).toHaveLength(2);
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: deal.id, action: "stage" } });
    expect(JSON.stringify(log.changes)).toContain("Смета / КП");
  });

  it("выигрыш блокируется без суммы или контакта и проходит при наличии обоих", async () => {
    const noAmount = await makeDeal(null);
    expect(await changeStage(noAmount.id, "stage_won", null, null)).toMatchObject({ ok: false, message: expect.stringContaining("сумму") });
    const noContact = await makeDeal(500_000, false);
    expect(await changeStage(noContact.id, "stage_won", null, null)).toMatchObject({ ok: false, message: expect.stringContaining("контакт") });
    const good = await makeDeal();
    expect((await changeStage(good.id, "stage_won", null, null)).ok).toBe(true);
    const won = await db.opportunity.findUniqueOrThrow({ where: { id: good.id } });
    expect(won.status).toBe("won");
    expect(won.closedAt).not.toBeNull();
    // заблокированные сделки не изменились
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: noAmount.id } })).stageId).toBe("stage_new");
  });

  it("проигрыш требует причину; возврат на открытую стадию очищает причину и дату закрытия", async () => {
    const deal = await makeDeal();
    expect((await changeStage(deal.id, "stage_lost", null, null)).ok).toBe(false);
    expect((await changeStage(deal.id, "stage_lost", "lr_other", "  ")).ok).toBe(false);
    expect((await changeStage(deal.id, "stage_lost", "lr_other", "клиент ушёл")).ok).toBe(true);
    let d = await db.opportunity.findUniqueOrThrow({ where: { id: deal.id } });
    expect(d).toMatchObject({ status: "lost", lostReasonId: "lr_other", lostReason: "клиент ушёл" });
    expect((await changeStage(deal.id, "stage_negotiation", null, null)).ok).toBe(true);
    d = await db.opportunity.findUniqueOrThrow({ where: { id: deal.id } });
    expect(d).toMatchObject({ status: "open", closedAt: null, lostReasonId: null, lostReason: null });
  });

  it("перенос на ту же стадию не создаёт лишних переходов", async () => {
    const deal = await makeDeal();
    await changeStage(deal.id, "stage_new", null, null);
    expect(await db.stageTransition.count({ where: { opportunityId: deal.id } })).toBe(1);
  });

  it("несуществующие сделка и стадия дают понятную ошибку", async () => {
    const deal = await makeDeal();
    expect(await changeStage("nope", "stage_new", null, null)).toMatchObject({ ok: false });
    expect(await changeStage(deal.id, "nope", null, null)).toMatchObject({ ok: false });
  });
});

describe("правка и удаление", () => {
  it("смена стадии формой пишет переход, правка только суммы не пишет", async () => {
    const deal = await db.opportunity.create({ data: { title: "С", accountId, stageId: "stage_new", amount: 100, transitions: { create: { stageId: "stage_new", amount: 100 } } } });
    await run(() => updateOpportunity(deal.id, undefined, dealForm({ title: "С", amount: "200" })));
    expect(await db.stageTransition.count({ where: { opportunityId: deal.id } })).toBe(1);
    await run(() => updateOpportunity(deal.id, undefined, dealForm({ title: "С", amount: "200", stageId: "stage_proposal" })));
    expect(await db.stageTransition.count({ where: { opportunityId: deal.id } })).toBe(2);
    const log = await db.auditLog.findMany({ where: { entityId: deal.id } });
    expect(log.some((l) => JSON.stringify(l.changes).includes('"amount"'))).toBe(true);
  });

  it("удаление сделки каскадно удаляет активности и историю стадий и пишет журнал", async () => {
    const deal = await db.opportunity.create({
      data: { title: "С", accountId, stageId: "stage_new", transitions: { create: { stageId: "stage_new" } }, activities: { create: { type: "note", body: "заметка" } } },
    });
    const r = await run(() => deleteOpportunity(deal.id, undefined, new FormData()));
    expect(r.redirect).toBe("/opportunities");
    expect(await db.opportunity.count()).toBe(0);
    expect(await db.activity.count()).toBe(0);
    expect(await db.stageTransition.count()).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: deal.id, action: "delete" } })).toBe(1);
  });
});
