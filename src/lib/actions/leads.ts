"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leadBaseSchema, leadSchema } from "@/lib/validation";
import { actionError, rawValues, parseForm, type FormState } from "./shared";


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
    const lead = await db.lead.create({
      data: { ...data, disqualifyReason: data.status === "disqualified" ? disqualifyReason : null },
    });
    id = lead.id;
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateLeads();
  redirect(`/leads/${id}`);
}

export async function updateLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let existing;
  try {
    existing = await db.lead.findUnique({ where: { id }, select: { status: true } });
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  if (!existing) return { message: "Лид не найден: возможно, его уже удалили." };

  try {
    if (existing.status === "converted") {
      // Статус конвертированного лида не меняется вручную.
      const parsed = parseForm(leadBaseSchema, formData);
      if (!parsed.ok) return parsed.state;
      await db.lead.update({ where: { id }, data: parsed.data });
    } else {
      const parsed = parseForm(leadSchema, formData);
      if (!parsed.ok) return parsed.state;
      const { disqualifyReason, ...data } = parsed.data;
      await db.lead.update({
        where: { id },
        data: { ...data, disqualifyReason: data.status === "disqualified" ? disqualifyReason : null },
      });
    }
  } catch (error) {
    return actionError(error, rawValues(formData));
  }
  revalidateLeads(id);
  redirect(`/leads/${id}`);
}

export async function deleteLead(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  try {
    const lead = await db.lead.findUnique({ where: { id }, select: { status: true } });
    if (!lead) return { message: "Лид уже удалён." };
    if (lead.status === "converted") {
      return { message: "Конвертированного лида нельзя удалить: он связан с созданными компанией, контактом и сделкой." };
    }
    await db.lead.delete({ where: { id } });
  } catch (error) {
    return actionError(error);
  }
  revalidateLeads();
  redirect("/leads");
}
