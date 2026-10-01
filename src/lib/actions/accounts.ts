"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { accountSchema } from "@/lib/validation";
import { actionError, parseForm, rawValues, type FormState } from "./shared";

function revalidateAccounts(id?: string) {
  revalidatePath("/accounts");
  revalidatePath("/");
  if (id) revalidatePath(`/accounts/${id}`);
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(accountSchema, formData);
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    const account = await db.account.create({ data: parsed.data });
    id = account.id;
    await audit({ entityType: "account", entityId: id, action: "create", summary: `Создана компания «${account.name}»` });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAccounts();
  redirect(`/accounts/${id}`);
}

export async function updateAccount(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(accountSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const existing = await db.account.findUnique({ where: { id } });
    if (!existing) return { message: "Компания не найдена: возможно, её уже удалили." };
    const updated = await db.account.update({ where: { id }, data: parsed.data });
    const changes = diffFields("account", existing, updated);
    if (changes.length) await audit({ entityType: "account", entityId: id, action: "update", summary: "Изменены данные компании", changes });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateAccounts(id);
  redirect(`/accounts/${id}`);
}

export async function deleteAccount(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const account = await db.account.findUnique({
      where: { id },
      select: { name: true, _count: { select: { contacts: true, opportunities: true, leads: true } } },
    });
    if (!account) return { message: "Компания уже удалена." };
    const { contacts, opportunities, leads } = account._count;
    if (contacts || opportunities || leads) {
      const parts = [
        contacts ? `контактов: ${contacts}` : null,
        opportunities ? `сделок: ${opportunities}` : null,
        leads ? `конвертированных лидов: ${leads}` : null,
      ].filter(Boolean);
      return { message: `Компанию нельзя удалить, пока к ней привязаны данные (${parts.join(", ")}). Сначала удалите или переназначьте их.` };
    }
    await db.account.delete({ where: { id } });
    await audit({ entityType: "account", entityId: id, action: "delete", summary: `Удалена компания «${account.name}»` });
  } catch (error) {
    return actionError(error);
  }
  revalidateAccounts();
  redirect("/accounts");
}
