"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { statusForStage, stageRuleError } from "@/lib/opportunity-rules";
import { opportunitySchema } from "@/lib/validation";
import { actionError, rawValues, fieldError, parseForm, type FormState } from "./shared";

function revalidateOpportunities(id?: string) {
  revalidatePath("/opportunities");
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/opportunities/${id}`);
}

type Parsed = ReturnType<typeof opportunitySchema.parse>;

/**
 * Проверяет связи и правила стадий, возвращает данные для записи в БД.
 * won: нужны сумма больше 0 и контакт. lost: нужна причина отказа.
 */
async function buildData(data: Parsed, values: Record<string, string>, closedAtBefore: Date | null) {
  const [stage, account, contact] = await Promise.all([
    db.stage.findUnique({ where: { id: data.stageId } }),
    db.account.findUnique({ where: { id: data.accountId }, select: { id: true } }),
    data.contactId ? db.contact.findUnique({ where: { id: data.contactId }, select: { accountId: true } }) : null,
  ]);
  if (!stage) return { error: fieldError(values, "stageId", "Стадия не найдена") };
  if (!account) return { error: fieldError(values, "accountId", "Компания не найдена") };
  if (data.contactId && !contact) return { error: fieldError(values, "contactId", "Контакт не найден") };
  if (contact && contact.accountId !== data.accountId) {
    return { error: fieldError(values, "contactId", "Контакт принадлежит другой компании") };
  }

  const ruleError = stageRuleError(stage.code, data);
  if (ruleError) return { error: fieldError(values, ruleError.field, ruleError.message) };

  const status = statusForStage(stage.code);
  return {
    data: {
      ...data,
      status,
      closedAt: status === "open" ? null : (closedAtBefore ?? new Date()),
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
    id = (
      await db.opportunity.create({
        data: { ...built.data, transitions: { create: { stageId: built.data.stageId, amount: built.data.amount } } },
      })
    ).id;
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
    const existing = await db.opportunity.findUnique({ where: { id }, select: { closedAt: true, stageId: true } });
    if (!existing) return { message: "Сделка не найдена: возможно, её уже удалили." };
    const built = await buildData(parsed.data, rawValues(formData), existing.closedAt);
    if (built.error) return built.error;
    await db.opportunity.update({
      where: { id },
      data: {
        ...built.data,
        // Переход на новую стадию фиксируется в истории для динамики на дашборде.
        ...(built.data.stageId !== existing.stageId ? { transitions: { create: { stageId: built.data.stageId, amount: built.data.amount } } } : {}),
      },
    });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateOpportunities(id);
  redirect(`/opportunities/${id}`);
}

export type ChangeStageResult = { ok: true } | { ok: false; message: string };

/** Перевод сделки на другую стадию воронки с теми же правилами won/lost, что и в форме сделки. */
export async function changeStage(opportunityId: string, stageId: string, lostReason: string | null): Promise<ChangeStageResult> {
  try {
    const [deal, stage] = await Promise.all([
      db.opportunity.findUnique({ where: { id: opportunityId }, select: { amount: true, contactId: true, closedAt: true, lostReason: true, stageId: true } }),
      db.stage.findUnique({ where: { id: stageId } }),
    ]);
    if (!deal) return { ok: false, message: "Сделка не найдена: возможно, её уже удалили." };
    if (!stage) return { ok: false, message: "Стадия не найдена." };

    const reason = lostReason?.trim() || deal.lostReason;
    const ruleError = stageRuleError(stage.code, { amount: deal.amount, contactId: deal.contactId, lostReason: reason });
    if (ruleError) return { ok: false, message: ruleError.message };

    const status = statusForStage(stage.code);
    await db.opportunity.update({
      where: { id: opportunityId },
      data: {
        stageId: stage.id,
        status,
        closedAt: status === "open" ? null : (deal.closedAt ?? new Date()),
        lostReason: status === "lost" ? reason : null,
        ...(stage.id !== deal.stageId ? { transitions: { create: { stageId: stage.id, amount: deal.amount } } } : {}),
      },
    });
  } catch (error) {
    return { ok: false, message: actionError(error).message ?? "Не удалось сменить стадию." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteOpportunity(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const found = await db.opportunity.findUnique({ where: { id }, select: { id: true } });
    if (!found) return { message: "Сделка уже удалена." };
    await db.opportunity.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidateOpportunities();
  redirect("/opportunities");
}
