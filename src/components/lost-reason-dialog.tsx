"use client";

import { useEffect, useRef, useState } from "react";

export type ReasonOption = { id: string; name: string; requiresComment: boolean };

/** Окно выбора причины отказа: причина из справочника обязательна, для «Другое» нужен ещё комментарий. */
export function LostReasonDialog({
  reasons,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  reasons: ReasonOption[];
  pending?: boolean;
  error?: string | null;
  onConfirm: (reasonId: string, comment: string) => void;
  onCancel: () => void;
}) {
  const [reasonId, setReasonId] = useState("");
  const [comment, setComment] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);
  const reason = reasons.find((r) => r.id === reasonId);
  const valid = !!reason && (!reason.requiresComment || comment.trim().length > 0);

  useEffect(() => {
    selectRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="glass modal" role="dialog" aria-modal="true" aria-label="Причина отказа" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">Почему сделка проиграна?</h2>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>
            Причина <span className="req">*</span>
          </span>
          <select ref={selectRef} className="input" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
            <option value="">Выберите причину</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Комментарий {reason?.requiresComment && <span className="req">*</span>}
          </span>
          <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder={reason?.requiresComment ? "Опишите причину" : "По желанию"} />
        </label>
        {error && (
          <div className="alert" role="alert" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" disabled={!valid || pending} onClick={() => onConfirm(reasonId, comment.trim())}>
            {pending ? "Сохранение…" : "Перевести в «Проиграна»"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
