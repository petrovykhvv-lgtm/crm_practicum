"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validation";
import { actionError, rawValues, fieldError, parseForm, type FormState } from "./shared";

function revalidateContacts(id?: string) {
  revalidatePath("/contacts");
  revalidatePath("/accounts", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/contacts/${id}`);
}

export async function createContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    const account = await db.account.findUnique({ where: { id: parsed.data.accountId }, select: { id: true } });
    if (!account) return fieldError(rawValues(formData), "accountId", "Компания не найдена");
    id = (await db.contact.create({ data: parsed.data })).id;
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateContacts();
  redirect(`/contacts/${id}`);
}

export async function updateContact(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const existing = await db.contact.findUnique({
      where: { id },
      select: { accountId: true, _count: { select: { opportunities: true } } },
    });
    if (!existing) return { message: "Контакт не найден: возможно, его уже удалили." };
    if (existing.accountId !== parsed.data.accountId && existing._count.opportunities > 0) {
      return fieldError(
        rawValues(formData),
        "accountId",
        `Нельзя сменить компанию: у контакта есть сделки (${existing._count.opportunities}). Сначала измените сделки.`,
      );
    }
    await db.contact.update({ where: { id }, data: parsed.data });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateContacts(id);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const contact = await db.contact.findUnique({
      where: { id },
      select: { _count: { select: { opportunities: true, leads: true } } },
    });
    if (!contact) return { message: "Контакт уже удалён." };
    const { opportunities, leads } = contact._count;
    if (opportunities || leads) {
      return { message: `Контакт нельзя удалить: он связан со сделками (${opportunities}) или конвертированными лидами (${leads}).` };
    }
    await db.contact.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidateContacts();
  redirect("/contacts");
}
