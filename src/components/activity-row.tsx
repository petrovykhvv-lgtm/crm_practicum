"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { deleteActivity, updateActivity } from "@/lib/actions/activities";
import { ConfirmDialog } from "./confirm-dialog";
import { FormMessage, SelectField, TextAreaField, TextField, fieldsOf, useServerForm } from "./form-fields";
import { TaskToggle } from "./task-toggle";

export type ActivityRowData = {
  id: string;
  type: "note" | "task";
  body: string;
  done: boolean;
  /** Подготовленные сервером строки: клиент ничего не форматирует сам. */
  dueLabel: string | null;
  dueInput: string;
  createdLabel: string;
  overdue: boolean;
  today: boolean;
  assigneeId: string;
  assigneeName: string | null;
  /** Сущность, к которой относится активность (для общего списка задач). */
  target?: { href: string; label: string } | null;
};

function EditForm({ row, managers, onDone }: { row: ActivityRowData; managers: { id: string; name: string }[]; onDone: () => void }) {
  const { state, onSubmit, pending } = useServerForm(updateActivity.bind(null, row.id));
  const f = fieldsOf(state, { body: row.body, dueDate: row.dueInput, assigneeId: row.assigneeId });
  const [handled, setHandled] = useState<typeof state>(undefined);
  if (state?.ok && state !== handled) {
    setHandled(state);
    onDone();
  }
  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <FormMessage state={state?.ok ? undefined : state} />
      <TextAreaField label={row.type === "note" ? "Текст заметки" : "Что нужно сделать"} required maxLength={2000} {...f("body")} />
      {row.type === "task" && <TextField label="Срок выполнения" type="date" required {...f("dueDate")} />}
      {row.type === "task" && <SelectField label="Исполнитель" placeholder="Не назначен" options={managers.map((m) => ({ value: m.id, label: m.name }))} {...f("assigneeId")} />}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onDone} disabled={pending}>
          Отмена
        </button>
      </div>
    </form>
  );
}

/** Строка ленты активностей: отметка выполнения, правка и удаление. */
export function ActivityRow({ row, managers }: { row: ActivityRowData; managers: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delState, runDelete] = useActionState(deleteActivity.bind(null, row.id), undefined);
  const [delPending, startDelete] = useTransition();
  const isTask = row.type === "task";

  return (
    <div className={`activity${row.done ? " done" : ""}`} style={{ gridTemplateColumns: isTask ? "auto 1fr auto" : "1fr auto", columnGap: 12 }}>
      {isTask && <TaskToggle id={row.id} done={row.done} />}
      <div style={{ minWidth: 0, gridColumn: editing ? "2 / -1" : undefined }}>
        {editing ? (
          <EditForm row={row} managers={managers} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="body">{row.body}</div>
            <div className="muted">
              {row.type === "note" ? "Заметка" : row.done ? "Задача выполнена" : "Задача"} ·{" "}
              {isTask ? (
                <span className={row.overdue ? "overdue" : undefined}>
                  срок {row.dueLabel}
                  {row.overdue ? " (просрочена)" : row.today ? " (сегодня)" : ""}
                </span>
              ) : (
                row.createdLabel
              )}
              {isTask && row.assigneeName && <> · {row.assigneeName}</>}
              {row.target && (
                <>
                  {" "}
                  · <Link href={row.target.href}>{row.target.label}</Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div className="activity-actions">
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Изменить
          </button>
          <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
            Удалить
          </button>
        </div>
      )}
      {confirming && !delState?.ok && (
        <ConfirmDialog
          title={isTask ? "Удалить задачу?" : "Удалить заметку?"}
          confirmLabel="Удалить"
          pending={delPending}
          error={delState?.message ?? null}
          onConfirm={() => startDelete(() => runDelete(new FormData()))}
          onCancel={() => setConfirming(false)}
        >
          «{row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body}» будет удалена без возможности восстановления.
        </ConfirmDialog>
      )}
    </div>
  );
}
