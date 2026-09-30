"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NEW_ACCOUNT } from "@/lib/labels";
import { convertLeadSchema } from "@/lib/validation";
import { actionError, parseForm, rawValues, type FormState } from "./shared";

/** Ошибка бизнес-правил конвертации: откатывает транзакцию и показывается пользователю как есть. */
class ConvertError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export async function convertLead(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(convertLeadSchema, formData);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true, status: true } });
      if (!lead) throw new ConvertError("Лид не найден: возможно, его уже удалили.");

      // Атомарная защита от повторной конвертации: статус меняется только если он ещё «конвертируемый».
      const claimed = await tx.lead.updateMany({
        where: { id: leadId, status: { in: ["new", "in_progress", "qualified"] } },
        data: { status: "converted", convertedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConvertError(
          lead.status === "converted"
            ? "Этот лид уже конвертирован, повторная конвертация невозможна."
            : "Отклонённого лида нельзя конвертировать. Сначала верните его в работу.",
        );
      }

      let accountId: string;
      if (d.accountChoice === NEW_ACCOUNT) {
        accountId = (await tx.account.create({ data: { name: d.accountName! } })).id;
      } else {
        const account = await tx.account.findUnique({ where: { id: d.accountChoice }, select: { id: true } });
        if (!account) throw new ConvertError("Выбранная компания не найдена.", "accountChoice");
        accountId = account.id;
      }

      const contact = await tx.contact.create({
        data: { firstName: d.firstName, lastName: d.lastName, position: d.position, email: d.email, phone: d.phone, accountId },
      });

      if (d.createDeal) {
        const stage = await tx.stage.findFirst({ where: { isClosed: false }, orderBy: { position: "asc" } });
        if (!stage) throw new ConvertError("В воронке нет открытых стадий: сделку создать нельзя.");
        await tx.opportunity.create({
          data: {
            title: d.dealTitle!,
            amount: d.amount,
            venue: d.venue,
            eventDate: d.eventDate,
            status: "open",
            stageId: stage.id,
            accountId,
            contactId: contact.id,
            leadId,
            transitions: { create: { stageId: stage.id, amount: d.amount } },
          },
        });
      }

      await tx.lead.update({ where: { id: leadId }, data: { convertedAccountId: accountId, convertedContactId: contact.id } });
    });
  } catch (error) {
    if (error instanceof ConvertError) {
      return {
        message: error.message,
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
        values: rawValues(formData),
      };
    }
    return actionError(error, rawValues(formData));
  }

  revalidatePath("/leads", "layout");
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/opportunities", "layout");
  revalidatePath("/");
  redirect(`/leads/${leadId}`);
}
