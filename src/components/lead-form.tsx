"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { EDITABLE_LEAD_STATUSES, LEAD_SOURCES, leadSourceLabels, leadStatusLabels } from "@/lib/labels";
import { FormActions, FormMessage, SelectField, TextAreaField, TextField, fieldsOf, useServerForm } from "./form-fields";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  managers: { id: string; name: string }[];
  /** Конвертированный лид: статус менять нельзя. */
  statusLocked?: boolean;
  /** Создание: статус всегда «Новый», поле скрыто. */
  hideStatus?: boolean;
  submitLabel: string;
  cancelHref: string;
};

export function LeadForm({ action, initial, managers, statusLocked, hideStatus, submitLabel, cancelHref }: Props) {
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, initial);
  const [status, setStatus] = useState(initial?.status ?? "new");

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div className="wide" style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state} />
      </div>
      <TextField label="Имя контактного лица" required maxLength={120} {...f("name")} />
      <TextField label="Компания" maxLength={200} {...f("company")} />
      <TextField label="Email" type="email" maxLength={200} {...f("email")} />
      <TextField label="Телефон" type="tel" maxLength={40} inputMode="tel" {...f("phone")} />
      <SelectField label="Источник" required placeholder="Выберите источник" options={LEAD_SOURCES.map((s) => ({ value: s, label: leadSourceLabels[s] }))} {...f("source")} />
      {hideStatus ? (
        <input type="hidden" name="status" value="new" />
      ) : statusLocked ? (
        <SelectField label="Статус" name="status" disabled defaultValue="converted" hint="Лид конвертирован, статус изменить нельзя" options={[{ value: "converted", label: "Конвертирован" }]} />
      ) : (
        <SelectField
          label="Статус"
          required
          options={EDITABLE_LEAD_STATUSES.map((s) => ({ value: s, label: leadStatusLabels[s] }))}
          {...f("status")}
          value={status}
          onChange={setStatus}
        />
      )}
      <TextField label="Бюджет, ₽" inputMode="decimal" placeholder="1500000" {...f("budget")} />
      <TextField label="Площадка" maxLength={200} {...f("venue")} />
      <TextField label="Желаемый срок" type="date" {...f("deadline")} />
      <TextField label="Формат работ" maxLength={200} placeholder="Стенд под ключ, аренда, бренд-зона…" {...f("workFormat")} />
      <SelectField label="Ответственный" placeholder="Не назначен" options={managers.map((m) => ({ value: m.id, label: m.name }))} {...f("managerId")} />
      {!statusLocked && status === "disqualified" && (
        <TextAreaField label="Причина отказа" required wide maxLength={500} {...f("disqualifyReason")} />
      )}
      {state?.duplicates && state.duplicates.length > 0 && (
        <div className="alert warn" role="alert" style={{ gridColumn: "1 / -1" }}>
          <strong>Возможные дубли:</strong>
          <ul className="error-list">
            {state.duplicates.map((d) => (
              <li key={d.href}>
                <Link href={d.href} target="_blank">
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
          <button type="submit" name="confirmDuplicate" value="1" className="btn btn-primary" style={{ marginTop: 8 }} disabled={pending}>
            Создать всё равно
          </button>
        </div>
      )}
      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} pending={pending} />
    </form>
  );
}
