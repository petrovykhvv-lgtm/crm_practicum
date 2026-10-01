"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createLostReason,
  createManager,
  deleteLostReason,
  deleteManager,
  setManagerActive,
  updateLostReason,
  updateManager,
  updateStageProbabilities,
} from "@/lib/actions/settings";
import type { FormState } from "@/lib/form-state";
import { ConfirmDialog } from "./confirm-dialog";
import { FormMessage, TextField, fieldsOf, useServerForm } from "./form-fields";

/** Кнопка удаления с окном подтверждения для действий вида (prev, formData). */
function RemoveButton({ action, title, text }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; title: string; text: string }) {
  const [state, run] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        Удалить
      </button>
      {open && !state?.ok && (
        <ConfirmDialog title={title} confirmLabel="Удалить" pending={pending} error={state?.message ?? null} onConfirm={() => start(() => run(new FormData()))} onCancel={() => setOpen(false)}>
          {text}
        </ConfirmDialog>
      )}
    </>
  );
}

/* ---------- Менеджеры ---------- */

type ManagerRow = { id: string; name: string; email: string | null; active: boolean };

function ManagerForm({ row, onDone }: { row?: ManagerRow; onDone?: () => void }) {
  const action = row ? updateManager.bind(null, row.id) : createManager;
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, { name: row?.name ?? "", email: row?.email ?? "" });
  const [handled, setHandled] = useState<typeof state>(undefined);
  const [resetKey, setResetKey] = useState(0);
  if (state?.ok && state !== handled) {
    setHandled(state);
    setResetKey((k) => k + 1); // очищает поля после добавления
    onDone?.();
  }
  return (
    <form key={resetKey} onSubmit={onSubmit} className="form-grid" style={{ alignItems: "end" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state?.ok ? undefined : state} />
      </div>
      <TextField label="Имя" required maxLength={100} {...f("name")} />
      <TextField label="Email" type="email" maxLength={200} {...f("email")} />
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {row ? "Сохранить" : "Добавить менеджера"}
        </button>
        {row && (
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}

export function ManagersPanel({ managers }: { managers: ManagerRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ManagerForm />
      <div className="list">
        {managers.length === 0 && <p className="muted">Менеджеров пока нет. Добавьте первого, чтобы назначать ответственных.</p>}
        {managers.map((m) =>
          editing === m.id ? (
            <div key={m.id} className="list-item" style={{ display: "block" }}>
              <ManagerForm row={m} onDone={() => setEditing(null)} />
            </div>
          ) : (
            <div key={m.id} className="list-item">
              <span>
                <b>{m.name}</b> <span className="muted">{m.email ?? ""}</span> {!m.active && <span className="badge" style={{ ["--c" as string]: "var(--stage-lost)" }}>отключён</span>}
              </span>
              <span className="row" style={{ gap: 12 }}>
                <button type="button" className="link-btn" onClick={() => setEditing(m.id)}>
                  Изменить
                </button>
                <button type="button" className="link-btn" onClick={() => start(() => setManagerActive(m.id, !m.active))}>
                  {m.active ? "Отключить" : "Включить"}
                </button>
                <RemoveButton action={deleteManager.bind(null, m.id)} title={`Удалить менеджера «${m.name}»?`} text="Лиды, сделки и задачи этого менеджера станут «без ответственного». Чтобы сохранить связи, лучше отключить менеджера." />
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Причины отказа ---------- */

type ReasonRow = { id: string; name: string; requiresComment: boolean; used: number };

function ReasonForm({ row, onDone }: { row?: ReasonRow; onDone?: () => void }) {
  const action = row ? updateLostReason.bind(null, row.id) : createLostReason;
  const { state, onSubmit, pending } = useServerForm(action);
  const f = fieldsOf(state, { name: row?.name ?? "" });
  const [handled, setHandled] = useState<typeof state>(undefined);
  const [resetKey, setResetKey] = useState(0);
  if (state?.ok && state !== handled) {
    setHandled(state);
    setResetKey((k) => k + 1);
    onDone?.();
  }
  return (
    <form key={resetKey} onSubmit={onSubmit} className="form-grid" style={{ alignItems: "end" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state?.ok ? undefined : state} />
      </div>
      <TextField label="Причина" required maxLength={100} {...f("name")} />
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" name="requiresComment" defaultChecked={row?.requiresComment} />
        <span>Комментарий обязателен</span>
      </label>
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {row ? "Сохранить" : "Добавить причину"}
        </button>
        {row && (
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}

export function ReasonsPanel({ reasons }: { reasons: ReasonRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ReasonForm />
      <div className="list">
        {reasons.map((r) =>
          editing === r.id ? (
            <div key={r.id} className="list-item" style={{ display: "block" }}>
              <ReasonForm row={r} onDone={() => setEditing(null)} />
            </div>
          ) : (
            <div key={r.id} className="list-item">
              <span>
                <b>{r.name}</b> <span className="muted">{r.requiresComment ? "комментарий обязателен · " : ""}в сделках: {r.used}</span>
              </span>
              <span className="row" style={{ gap: 12 }}>
                <button type="button" className="link-btn" onClick={() => setEditing(r.id)}>
                  Изменить
                </button>
                <RemoveButton action={deleteLostReason.bind(null, r.id)} title={`Удалить причину «${r.name}»?`} text={r.used > 0 ? "Причина используется в сделках, удалить её не получится: переименуйте её." : "Причина будет удалена из справочника."} />
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Вероятности стадий ---------- */

export function ProbabilityForm({ stages }: { stages: { id: string; name: string; probability: number }[] }) {
  const { state, onSubmit, pending } = useServerForm(updateStageProbabilities);
  const f = fieldsOf(state, Object.fromEntries(stages.map((s) => [`p_${s.id}`, String(s.probability)])));
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <div style={{ gridColumn: "1 / -1" }}>
        <FormMessage state={state?.ok ? undefined : state} />
      </div>
      {stages.map((s) => (
        <TextField key={s.id} label={`${s.name}, %`} inputMode="decimal" {...f(`p_${s.id}`)} />
      ))}
      <div className="row" style={{ gridColumn: "1 / -1" }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Сохранить вероятности
        </button>
        {state?.ok && !pending && <span className="hint" role="status">Сохранено</span>}
      </div>
    </form>
  );
}
