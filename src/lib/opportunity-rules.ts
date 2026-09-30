export type StageRuleInput = {
  amount: { toString(): string } | number | null | undefined;
  contactId: string | null | undefined;
  lostReason: string | null | undefined;
};

export type OpportunityStatusValue = "open" | "won" | "lost";

export function statusForStage(stageCode: string): OpportunityStatusValue {
  return stageCode === "won" ? "won" : stageCode === "lost" ? "lost" : "open";
}

/**
 * Правила закрытия сделки, общие для формы сделки и перевода по воронке.
 * won: нужны сумма больше 0 и контакт. lost: нужна причина отказа.
 */
export function stageRuleError(stageCode: string, input: StageRuleInput): { field: string; message: string } | null {
  if (stageCode === "won") {
    const amount = input.amount === null || input.amount === undefined ? 0 : Number(input.amount.toString());
    if (!(amount > 0)) return { field: "amount", message: "Для стадии «Выиграна» укажите сумму больше 0" };
    if (!input.contactId) return { field: "contactId", message: "Для стадии «Выиграна» выберите контакт" };
  }
  if (stageCode === "lost" && !input.lostReason?.trim()) {
    return { field: "lostReason", message: "Для стадии «Проиграна» укажите причину отказа" };
  }
  return null;
}
