"use client";

import type { FormState } from "@/lib/form-state";
import { FormActions, FormMessage, TextField, fieldsOf, useServerForm } from "./form-fields";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
};

export function AccountForm({ action, initial, submitLabel, cancelHref }: Props) {
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, initial);
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>
      <TextField label="Название" required maxLength={200} {...f("name")} />
      <TextField label="Отрасль" maxLength={200} {...f("industry")} />
      <TextField label="Город" maxLength={100} {...f("city")} />
      <TextField label="Телефон" type="tel" maxLength={40} inputMode="tel" {...f("phone")} />
      <TextField label="Сайт" type="url" maxLength={200} placeholder="https://example.com" {...f("website")} />
      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} pending={pending} />
    </form>
  );
}
