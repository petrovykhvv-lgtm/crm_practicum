"use client";

import { useState, useTransition } from "react";
import { toggleTask } from "@/lib/actions/activities";

export function TaskToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        aria-label={done ? "Вернуть задачу в работу" : "Отметить задачу выполненной"}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            const result = await toggleTask(id, next);
            setError(result.ok ? null : result.message);
          });
        }}
      />
      {error && (
        <span className="hint-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
