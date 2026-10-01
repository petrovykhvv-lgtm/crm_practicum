export type StageRuleInput = {
  amount: { toString(): string } | number | null | undefined;
  contactId: string | null | undefined;
  /** Выбранная причина отказа из справочника. */
  lostReasonId: string | null | undefined;
  /** Для выбранной причины комментарий обязателен («Другое»). */
  lostReasonRequiresComment?: boolean;
  lostComment: string | null | undefined;
};

export type OpportunityStatusValue = "open" | "won" | "lost";

export function statusForStage(stageCode: string): OpportunityStatusValue {
  return stageCode === "won" ? "won" : stageCode === "lost" ? "lost" : "open";
}

/**
 * Правила закрытия сделки, общие для формы сделки, перевода по воронке и перетаскивания.
 * won: нужны сумма больше 0 и контакт. lost: нужна причина из справочника, для «Другое» ещё и комментарий.
 */
export function stageRuleError(stageCode: string, input: StageRuleInput): { field: string; message: string } | null {
  if (stageCode === "won") {
    const amount = input.amount === null || input.amount === undefined ? 0 : Number(input.amount.toString());
    if (!(amount > 0)) return { field: "amount", message: "Для стадии «Выиграна» укажите сумму больше 0" };
    if (!input.contactId) return { field: "contactId", message: "Для стадии «Выиграна» выберите контакт" };
  }
  if (stageCode === "lost") {
    if (!input.lostReasonId) return { field: "lostReasonId", message: "Для стадии «Проиграна» выберите причину отказа" };
    if (input.lostReasonRequiresComment && !input.lostComment?.trim()) return { field: "lostReason", message: "Для причины «Другое» напишите комментарий" };
  }
  return null;
}
