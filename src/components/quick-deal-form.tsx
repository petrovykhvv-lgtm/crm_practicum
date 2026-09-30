"use client";

import { createOpportunity } from "@/lib/actions/opportunities";
import { FormMessage, SelectField, TextField, fieldsOf, useServerForm } from "./form-fields";

/** Быстрое создание сделки: название, компания и (по желанию) сумма. Сделка создаётся на первой стадии воронки. */
export function QuickDealForm({ accounts, firstStageId }: { accounts: { id: string; name: string }[]; firstStageId: string }) {
  const { state, onSubmit, pending } = useServerForm(createOpportunity);
  const f = fieldsOf(state);
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>
      <input type="hidden" name="stageId" value={firstStageId} />
      <TextField label="Название сделки" required maxLength={200} {...f("title")} />
      <SelectField label="Компания" required placeholder="Выберите компанию" options={accounts.map((a) => ({ value: a.id, label: a.name }))} {...f("accountId")} />
      <TextField label="Сумма, ₽" inputMode="decimal" {...f("amount")} />
      <div className="row" style={{ alignSelf: "end" }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Создание…" : "Создать сделку"}
        </button>
      </div>
    </form>
  );
}
