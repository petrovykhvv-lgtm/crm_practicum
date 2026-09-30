"use client";

import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { NEW_ACCOUNT } from "@/lib/labels";
import { FormActions, FormMessage, SelectField, TextField, fieldsOf, useServerForm } from "./form-fields";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: Record<string, string>;
  accounts: { id: string; name: string }[];
  cancelHref: string;
};

export function ConvertLeadForm({ action, initial, accounts, cancelHref }: Props) {
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, initial);
  const [choice, setChoice] = useState(initial.accountChoice ?? NEW_ACCOUNT);
  const [createDeal, setCreateDeal] = useState(initial.createDeal !== "off");

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>

      <h3 className="wide" style={{ gridColumn: "1 / -1", fontSize: 20 }}>1. Контакт</h3>
      <TextField label="Имя" required maxLength={100} {...f("firstName")} />
      <TextField label="Фамилия" required maxLength={100} {...f("lastName")} />
      <TextField label="Должность" maxLength={200} {...f("position")} />
      <TextField label="Email" type="email" maxLength={200} {...f("email")} />
      <TextField label="Телефон" type="tel" maxLength={40} inputMode="tel" {...f("phone")} />

      <h3 className="wide" style={{ gridColumn: "1 / -1", fontSize: 20 }}>2. Компания</h3>
      <SelectField
        label="Компания"
        required
        options={[{ value: NEW_ACCOUNT, label: "+ Создать новую компанию" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        {...f("accountChoice")}
        value={choice}
        onChange={setChoice}
      />
      {choice === NEW_ACCOUNT && <TextField label="Название новой компании" required maxLength={200} {...f("accountName")} />}

      <h3 className="wide" style={{ gridColumn: "1 / -1", fontSize: 20 }}>3. Сделка</h3>
      <label className="row" style={{ gridColumn: "1 / -1", gap: 8 }}>
        <input type="checkbox" name="createDeal" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} />
        <span>Создать сделку на стадии «Новая»</span>
      </label>
      {createDeal && (
        <>
          <TextField label="Название сделки" required wide maxLength={200} {...f("dealTitle")} />
          <TextField label="Сумма, ₽" inputMode="decimal" {...f("amount")} />
          <TextField label="Площадка" maxLength={200} {...f("venue")} />
          <TextField label="Дата мероприятия" type="date" {...f("eventDate")} />
        </>
      )}

      <FormActions submitLabel="Конвертировать лида" cancelHref={cancelHref} pending={pending} />
    </form>
  );
}
