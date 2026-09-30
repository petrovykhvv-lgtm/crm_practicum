"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Что произойдёт при подтверждении (последствия). */
  children?: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  /** Ошибка бэкенда: окно остаётся открытым и показывает причину. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Модальное окно подтверждения вместо системного confirm: Esc и клик по фону отменяют, фокус на «Отмена». */
export function ConfirmDialog({ title, children, confirmLabel, pending, error, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="glass modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{title}</h2>
        {children && <div className="muted" style={{ marginBottom: 12, fontSize: 14 }}>{children}</div>}
        {error && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}
        <div className="row">
          <button type="button" className="btn btn-danger-solid" onClick={onConfirm} disabled={pending}>
            {pending ? "Удаление…" : confirmLabel}
          </button>
          <button type="button" className="btn btn-ghost" ref={cancelRef} onClick={onCancel} disabled={pending}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
