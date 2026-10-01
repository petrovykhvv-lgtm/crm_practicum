"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { stageRuleError, statusForStage } from "@/lib/opportunity-rules";
import { opportunitySchema } from "@/lib/validation";
import { actionError, fieldError, parseForm, rawValues, type FormState } from "./shared";

function revalidateOpportunities(id?: string) {
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/opportunities/${id}`);
}

type Parsed = ReturnType<typeof opportunitySchema.parse>;

/**
 * Проверяет связи и правила стадий, возвращает данные для записи в БД.
 * won: нужны сумма больше 0 и контакт. lost: нужна причина из справочника, для «Другое» ещё и комментарий.
 */
async function buildData(data: Parsed, values: Record<string, string>, closedAtBefore: Date | null) {
  const [stage, account, contact, reason] = await Promise.all([
    db.stage.findUnique({ where: { id: data.stageId } }),
    db.account.findUnique({ where: { id: data.accountId }, select: { id: true } }),
    data.contactId ? db.contact.findUnique({ where: { id: data.contactId }, select: { accountId: true } }) : null,
    data.lostReasonId ? db.lostReason.findUnique({ where: { id: data.lostReasonId } }) : null,
  ]);
  if (!stage) return { error: fieldError(values, "stageId", "Стадия не найдена") };
  if (!account) return { error: fieldError(values, "accountId", "Компания не найдена") };
  if (data.contactId && !contact) return { error: fieldError(values, "contactId", "Контакт не найден") };
  if (contact && contact.accountId !== data.accountId) {
    return { error: fieldError(values, "contactId", "Контакт принадлежит другой компании") };
  }
  if (data.lostReasonId && !reason) return { error: fieldError(values, "lostReasonId", "Причина отказа не найдена") };

  const ruleError = stageRuleError(stage.code, {
    amount: data.amount,
    contactId: data.contactId,
    lostReasonId: data.lostReasonId,
    lostReasonRequiresComment: reason?.requiresComment,
    lostComment: data.lostReason,
  });
  if (ruleError) return { error: fieldError(values, ruleError.field, ruleError.message) };

  const status = statusForStage(stage.code);
  return {
    data: {
      ...data,
      status,
      closedAt: status === "open" ? null : (closedAtBefore ?? new Date()),
      lostReasonId: status === "lost" ? data.lostReasonId : null,
      lostReason: status === "lost" ? data.lostReason : null,
    } as const,
  };
}

export async function createOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(opportunitySchema, formData);
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    const built = await buildData(parsed.data, rawValues(formData), null);
    if (built.error) return built.error;
    const created = await db.opportunity.create({
      data: { ...built.data, transitions: { create: { stageId: built.data.stageId, amount: built.data.amount } } },
    });
    id = created.id;
    await audit({ entityType: "opportunity", entityId: id, action: "create", summary: `Создана сделка «${created.title}»` });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateOpportunities();
  redirect(`/opportunities/${id}`);
}

export async function updateOpportunity(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(opportunitySchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) return { message: "Сделка не найдена: возможно, её уже удалили." };
    const built = await buildData(parsed.data, rawValues(formData), existing.closedAt);
    if (built.error) return built.error;
    const updated = await db.opportunity.update({
      where: { id },
      data: {
        ...built.data,
        // Переход на новую стадию фиксируется в истории для динамики на дашборде.
        ...(built.data.stageId !== existing.stageId ? { transitions: { create: { stageId: built.data.stageId, amount: built.data.amount } } } : {}),
      },
    });
    const changes = diffFields("opportunity", existing, updated);
    if (changes.length) await audit({ entityType: "opportunity", entityId: id, action: built.data.stageId !== existing.stageId ? "stage" : "update", summary: "Изменены данные сделки", changes });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateOpportunities(id);
  redirect(`/opportunities/${id}`);
}

export type ChangeStageResult = { ok: true } | { ok: false; message: string };

/**
 * Перевод сделки на другую стадию воронки с теми же правилами won и lost, что и в форме сделки.
 * Для «Проиграна» передаётся причина из справочника и комментарий (для «Другое» комментарий обязателен).
 */
export async function changeStage(opportunityId: string, stageId: string, lostReasonId: string | null, lostComment: string | null): Promise<ChangeStageResult> {
  try {
    const [deal, stage] = await Promise.all([
      db.opportunity.findUnique({ where: { id: opportunityId } }),
      db.stage.findUnique({ where: { id: stageId } }),
    ]);
    if (!deal) return { ok: false, message: "Сделка не найдена: возможно, её уже удалили." };
    if (!stage) return { ok: false, message: "Стадия не найдена." };

    const reasonId = lostReasonId || deal.lostReasonId;
    const comment = lostComment?.trim() || deal.lostReason;
    const reason = reasonId ? await db.lostReason.findUnique({ where: { id: reasonId } }) : null;
    const ruleError = stageRuleError(stage.code, {
      amount: deal.amount,
      contactId: deal.contactId,
      lostReasonId: reason?.id ?? null,
      lostReasonRequiresComment: reason?.requiresComment,
      lostComment: comment,
    });
    if (ruleError) return { ok: false, message: ruleError.message };

    const status = statusForStage(stage.code);
    const updated = await db.opportunity.update({
      where: { id: opportunityId },
      data: {
        stageId: stage.id,
        status,
        closedAt: status === "open" ? null : (deal.closedAt ?? new Date()),
        lostReasonId: status === "lost" ? reason?.id : null,
        lostReason: status === "lost" ? comment : null,
        ...(stage.id !== deal.stageId ? { transitions: { create: { stageId: stage.id, amount: deal.amount } } } : {}),
      },
    });
    const changes = diffFields("opportunity", deal, updated);
    if (changes.length) await audit({ entityType: "opportunity", entityId: opportunityId, action: "stage", summary: `Стадия: ${stage.name}`, changes });
  } catch (error) {
    return { ok: false, message: actionError(error).message ?? "Не удалось сменить стадию." };
  }
  revalidateOpportunities(opportunityId);
  return { ok: true };
}

export async function deleteOpportunity(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const found = await db.opportunity.findUnique({ where: { id }, select: { title: true } });
    if (!found) return { message: "Сделка уже удалена." };
    await db.opportunity.delete({ where: { id } });
    await audit({ entityType: "opportunity", entityId: id, action: "delete", summary: `Удалена сделка «${found.title}»` });
  } catch (error) {
    return actionError(error);
  }
  revalidateOpportunities();
  redirect("/opportunities");
}
