"use client";

import { useState, useTransition } from "react";
import { changeStage } from "@/lib/actions/opportunities";

type Props = {
  opportunityId: string;
  currentStageId: string;
  stages: { id: string; code: string; name: string }[];
  compact?: boolean;
};

/** Быстрое действие «Сменить стадию». Для стадии «Проиграна» запрашивает причину отказа. */
export function StageMover({ opportunityId, currentStageId, stages, compact }: Props) {
  const [stageId, setStageId] = useState(currentStageId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = stageId !== currentStageId;
  const needReason = changed && stages.find((s) => s.id === stageId)?.code === "lost";

  function submit() {
    startTransition(async () => {
      const result = await changeStage(opportunityId, stageId, needReason ? reason : null);
      if (result.ok) {
        setError(null);
        setReason("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ gap: 8, flexWrap: compact ? "wrap" : "nowrap" }}>
        <select className="input" aria-label="Стадия сделки" value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={pending} style={{ flex: 1, minWidth: 0 }}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {changed && (
          <>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
              {pending ? "…" : "Перевести"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStageId(currentStageId);
                setError(null);
              }}
              disabled={pending}
            >
              Отмена
            </button>
          </>
        )}
      </div>
      {needReason && (
        <textarea className="input" placeholder="Причина отказа (обязательно)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-label="Причина отказа" />
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
