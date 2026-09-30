"use client";

import { useEffect, useRef, useState } from "react";
import { addActivity, type ActivityTarget } from "@/lib/actions/activities";
import { FormMessage, TextAreaField, TextField, fieldsOf, useServerForm } from "./form-fields";

/** Быстрые действия «Добавить заметку» и «Добавить задачу» для карточки любой сущности. */
export function AddActivityForm({ kind, id }: { kind: ActivityTarget; id: string }) {
  const { state, onSubmit, pending } = useServerForm(addActivity.bind(null, kind, id));
  const [type, setType] = useState<"note" | "task">("note");
  const formRef = useRef<HTMLFormElement>(null);
  const f = fieldsOf(state);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
      <div className="row" role="tablist" aria-label="Тип активности">
        {(["note", "task"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} className={`btn ${type === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setType(t)}>
            {t === "note" ? "Заметка" : "Задача"}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />
      <FormMessage state={state?.ok ? undefined : state} />
      <TextAreaField label={type === "note" ? "Текст заметки" : "Что нужно сделать"} required maxLength={2000} {...f("body")} />
      {type === "task" && <TextField label="Срок выполнения" type="date" required {...f("dueDate")} />}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : type === "note" ? "Добавить заметку" : "Добавить задачу"}
        </button>
        {state?.ok && !pending && <span className="hint" role="status">Добавлено</span>}
      </div>
    </form>
  );
}
