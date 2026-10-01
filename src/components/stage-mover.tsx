"use client";

import { useState, useTransition } from "react";
import { changeStage } from "@/lib/actions/opportunities";
import { LostReasonDialog, type ReasonOption } from "./lost-reason-dialog";

type Props = {
  opportunityId: string;
  currentStageId: string;
  stages: { id: string; code: string; name: string }[];
  reasons: ReasonOption[];
  compact?: boolean;
};

/** Быстрое действие «Сменить стадию». Для стадии «Проиграна» открывает окно выбора причины отказа. */
export function StageMover({ opportunityId, currentStageId, stages, reasons, compact }: Props) {
  const [stageId, setStageId] = useState(currentStageId);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = stageId !== currentStageId;
  const toLost = changed && stages.find((s) => s.id === stageId)?.code === "lost";

  function run(reasonId: string | null, comment: string | null) {
    startTransition(async () => {
      const result = await changeStage(opportunityId, stageId, reasonId, comment);
      if (result.ok) {
        setError(null);
        setAsking(false);
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
            <button type="button" className="btn btn-primary" onClick={() => (toLost ? setAsking(true) : run(null, null))} disabled={pending}>
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
      {error && !asking && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {asking && <LostReasonDialog reasons={reasons} pending={pending} error={error} onConfirm={(reasonId, comment) => run(reasonId, comment)} onCancel={() => { setAsking(false); setError(null); }} />}
    </div>
  );
}
