"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";

export function DeleteButton({
  action,
  confirmText,
  label = "Удалить",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  confirmText: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: "grid", gap: 8 }}
    >
      <button className="btn btn-danger" type="submit" disabled={pending}>
        {pending ? "Удаление…" : label}
      </button>
      {state?.message && (
        <div className="alert" role="alert" style={{ maxWidth: 420 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
