"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/lib/form-state";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Кнопка «Удалить» с собственным окном подтверждения. Если бэкенд отказывает (например, есть связанные записи),
 * окно остаётся открытым и показывает причину; при успехе Server Action сам перенаправляет на список.
 */
export function DeleteButton({
  action,
  confirmText,
  consequences,
  label = "Удалить",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Заголовок окна, например «Удалить лида «Иван»?». */
  confirmText: string;
  /** Пояснение последствий. */
  consequences?: string;
  label?: string;
}) {
  const [state, run] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(() => run(new FormData()));
  }

  return (
    <>
      <button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <ConfirmDialog title={confirmText} confirmLabel={label} pending={pending} error={state?.message ?? null} onConfirm={confirm} onCancel={() => setOpen(false)}>
          {consequences ?? "Действие нельзя отменить."}
        </ConfirmDialog>
      )}
    </>
  );
}
