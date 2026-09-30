"use client";

import type { FormState } from "@/lib/form-state";
import { FormActions, FormMessage, SelectField, TextField, fieldsOf, useServerForm } from "./form-fields";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  accounts: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
};

export function ContactForm({ action, initial, accounts, submitLabel, cancelHref }: Props) {
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, initial);
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>
      <TextField label="Имя" required maxLength={100} {...f("firstName")} />
      <TextField label="Фамилия" required maxLength={100} {...f("lastName")} />
      <TextField label="Должность" maxLength={200} {...f("position")} />
      <SelectField label="Компания" required placeholder="Выберите компанию" options={accounts.map((a) => ({ value: a.id, label: a.name }))} {...f("accountId")} />
      <TextField label="Email" type="email" maxLength={200} {...f("email")} />
      <TextField label="Телефон" type="tel" maxLength={40} inputMode="tel" {...f("phone")} />
      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} pending={pending} />
    </form>
  );
}
