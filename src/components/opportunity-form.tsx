"use client";

import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { FormActions, FormMessage, SelectField, TextAreaField, TextField, fieldsOf, useServerForm } from "./form-fields";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  accounts: { id: string; name: string }[];
  contacts: { id: string; accountId: string; name: string }[];
  stages: { id: string; code: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
};

export function OpportunityForm({ action, initial, accounts, contacts, stages, submitLabel, cancelHref }: Props) {
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, initial);
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [stageId, setStageId] = useState(initial?.stageId ?? stages[0]?.id ?? "");
  const stageCode = stages.find((s) => s.id === stageId)?.code;
  const accountContacts = contacts.filter((c) => c.accountId === accountId);

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>
      <TextField label="Название сделки" required wide maxLength={200} {...f("title")} />
      <SelectField
        label="Компания"
        required
        placeholder="Выберите компанию"
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        {...f("accountId")}
        value={accountId}
        onChange={setAccountId}
      />
      {/* key сбрасывает выбранный контакт при смене компании */}
      <SelectField
        key={accountId}
        label="Контактное лицо"
        placeholder={accountId ? "Не выбран" : "Сначала выберите компанию"}
        hint={stageCode === "won" ? "Для выигранной сделки контакт обязателен" : undefined}
        options={accountContacts.map((c) => ({ value: c.id, label: c.name }))}
        {...f("contactId")}
      />
      <SelectField
        label="Стадия"
        required
        options={stages.map((s) => ({ value: s.id, label: s.name }))}
        {...f("stageId")}
        value={stageId}
        onChange={setStageId}
      />
      <TextField label="Сумма, ₽" inputMode="decimal" placeholder="1200000" hint={stageCode === "won" ? "Для выигранной сделки сумма должна быть больше 0" : undefined} {...f("amount")} />
      <TextField label="Площадка" maxLength={200} {...f("venue")} />
      <TextField label="Дата мероприятия" type="date" {...f("eventDate")} />
      {stageCode === "lost" && <TextAreaField label="Причина отказа" required wide maxLength={500} {...f("lostReason")} />}
      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} pending={pending} />
    </form>
  );
}
