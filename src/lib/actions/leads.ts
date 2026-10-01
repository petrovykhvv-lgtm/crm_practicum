"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { findLeadDuplicates } from "@/lib/duplicates";
import { leadBaseSchema, leadSchema } from "@/lib/validation";
import { actionError, parseForm, rawValues, type FormState } from "./shared";

function revalidateLeads(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/");
  if (id) revalidatePath(`/leads/${id}`);
}

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(leadSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { disqualifyReason, ...data } = parsed.data;

  let id: string;
  try {
    // Поиск дублей: если найдены, форму нужно отправить повторно с подтверждением.
    if (formData.get("confirmDuplicate") !== "1") {
      const duplicates = await findLeadDuplicates({ email: data.email, company: data.company });
      if (duplicates.length > 0) {
        return {
          message: "Похоже, такой клиент уже есть в базе. Проверьте совпадения или создайте лида всё равно.",
          duplicates,
          values: rawValues(formData),
        };
      }
    }
    const lead = await db.lead.create({
      data: { ...data, disqualifyReason: data.status === "disqualified" ? disqualifyReason : null },
    });
    id = lead.id;
    await audit({ entityType: "lead", entityId: id, action: "create", summary: `Создан лид «${lead.name}»` });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateLeads();
  redirect(`/leads/${id}`);
}

export async function updateLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return { message: "Лид не найден: возможно, его уже удалили." };

    let data: Record<string, unknown>;
    if (existing.status === "converted") {
      // Статус конвертированного лида не меняется вручную.
      const parsed = parseForm(leadBaseSchema, formData);
      if (!parsed.ok) return parsed.state;
      data = parsed.data;
    } else {
      const parsed = parseForm(leadSchema, formData);
      if (!parsed.ok) return parsed.state;
      const { disqualifyReason, ...rest } = parsed.data;
      data = { ...rest, disqualifyReason: rest.status === "disqualified" ? disqualifyReason : null };
    }
    const updated = await db.lead.update({ where: { id }, data });
    const changes = diffFields("lead", existing, updated);
    if (changes.length) await audit({ entityType: "lead", entityId: id, action: "update", summary: "Изменены данные лида", changes });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateLeads(id);
  redirect(`/leads/${id}`);
}

export async function deleteLead(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const lead = await db.lead.findUnique({ where: { id }, select: { status: true, name: true } });
    if (!lead) return { message: "Лид уже удалён." };
    if (lead.status === "converted") {
      return { message: "Конвертированного лида нельзя удалить: он связан с созданными компанией, контактом и сделкой." };
    }
    await db.lead.delete({ where: { id } });
    await audit({ entityType: "lead", entityId: id, action: "delete", summary: `Удалён лид «${lead.name}»` });
  } catch (error) {
    return actionError(error);
  }
  revalidateLeads();
  redirect("/leads");
}
