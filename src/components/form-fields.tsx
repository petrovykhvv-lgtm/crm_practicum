"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

/**
 * Подключает Server Action к форме через onSubmit. В отличие от <form action>, React не сбрасывает
 * поля после отправки, поэтому при ошибке валидации пользователь не теряет введённое.
 */
export function useServerForm(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // submitter нужен, чтобы в данные попала нажатая кнопка (например, «Создать всё равно»).
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };
  // После неудачной отправки переводим фокус на первое поле с ошибкой.
  useEffect(() => {
    if (state?.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);
  return { state, onSubmit, pending };
}

/** Возвращает функцию, которая для имени поля отдаёт значение по умолчанию и ошибку. */
export function fieldsOf(state: FormState, initial: Record<string, string> = {}) {
  return (name: string) => ({
    name,
    defaultValue: state?.values?.[name] ?? initial[name] ?? "",
    error: state?.fieldErrors?.[name]?.[0],
  });
}

type Common = { label: string; name: string; defaultValue?: string; error?: string; required?: boolean; hint?: string; wide?: boolean };

function Wrapper({ label, required, error, hint, wide, children, errId }: Common & { children: ReactNode; errId: string }) {
  return (
    <label className={`field${wide ? " wide" : ""}`}>
      <span>
        {label}
        {required && <span className="req"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="hint-error" id={errId}>
          {error}
        </span>
      )}
    </label>
  );
}

export function TextField(props: Common & { type?: string; maxLength?: number; placeholder?: string; inputMode?: "decimal" | "tel" | "email" }) {
  const { name, defaultValue, error, required, type = "text", maxLength, placeholder, inputMode } = props;
  const errId = `${useId()}-err`;
  return (
    <Wrapper {...props} errId={errId}>
      <input
        className={`input${error ? " error" : ""}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
    </Wrapper>
  );
}

export function TextAreaField(props: Common & { maxLength?: number }) {
  const { name, defaultValue, error, required, maxLength } = props;
  const errId = `${useId()}-err`;
  return (
    <Wrapper {...props} errId={errId}>
      <textarea className={`input${error ? " error" : ""}`} name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} />
    </Wrapper>
  );
}

export type Option = { value: string; label: string };

export function SelectField(
  props: Common & {
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    value?: string;
    onChange?: (value: string) => void;
  },
) {
  const { name, defaultValue, error, required, options, placeholder, disabled, value, onChange } = props;
  const controlled = value !== undefined ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) } : { defaultValue };
  const errId = `${useId()}-err`;
  return (
    <Wrapper {...props} errId={errId}>
      <select className={`input${error ? " error" : ""}`} name={name} required={required} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} {...controlled}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/**
 * Сообщение формы. Если есть ошибки полей, показывает их списком со ссылками: клик переводит фокус на поле.
 * Ошибка без привязки к полю (нет связи с БД, правило бизнес-логики) выводится одной строкой.
 */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  const items = Object.entries(state.fieldErrors ?? {}).flatMap(([name, errors]) => (errors ?? []).slice(0, 1).map((text) => ({ name, text })));
  const focusField = (e: React.MouseEvent<HTMLAnchorElement>, name: string) => {
    e.preventDefault();
    const el = e.currentTarget.closest("form")?.querySelector<HTMLElement>(`[name="${name}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <div className="alert" role="alert">
      <div>{state.message}</div>
      {items.length > 0 && (
        <ul className="error-list">
          {items.map((i) => (
            <li key={i.name}>
              <a href={`#${i.name}`} onClick={(e) => focusField(e, i.name)}>
                {i.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Сохранение…" : label}
    </button>
  );
}

export function FormActions({ cancelHref, submitLabel, pending }: { cancelHref: string; submitLabel: string; pending: boolean }) {
  return (
    <div className="row wide" style={{ gridColumn: "1 / -1" }}>
      <Submit label={submitLabel} pending={pending} />
      <Link href={cancelHref} className="btn btn-ghost">
        Отмена
      </Link>
    </div>
  );
}
