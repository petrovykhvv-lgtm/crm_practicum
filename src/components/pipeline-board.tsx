"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { changeStage } from "@/lib/actions/opportunities";
import { formatMoney, opportunityStatusColors, opportunityStatusLabels } from "@/lib/labels";
import { statusForStage, type OpportunityStatusValue } from "@/lib/opportunity-rules";
import { StageMover } from "./stage-mover";

export type BoardDeal = {
  id: string;
  title: string;
  account: string;
  contact: string | null;
  amount: number | null;
  status: OpportunityStatusValue;
  eventDate: string | null;
};
export type BoardColumn = { id: string; code: string; name: string; color: string; deals: BoardDeal[] };
type StageOption = { id: string; code: string; name: string };

/** Воронка с перетаскиванием сделок между стадиями (HTML5 Drag and Drop). Правила won/lost проверяет сервер. */
export function PipelineBoard({ columns: initial, stages }: { columns: BoardColumn[]; stages: StageOption[] }) {
  const [columns, setColumns] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lostAsk, setLostAsk] = useState<{ dealId: string; stageId: string } | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // После обновления данных с сервера берём их как источник истины (обновление состояния при рендере).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setColumns(initial);
  }

  useEffect(() => {
    if (!lostAsk) return;
    reasonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelLost();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lostAsk]);

  const find = (cols: BoardColumn[], dealId: string) => {
    for (const c of cols) {
      const deal = c.deals.find((d) => d.id === dealId);
      if (deal) return { column: c, deal };
    }
    return null;
  };

  function applyMove(cols: BoardColumn[], dealId: string, stageId: string): BoardColumn[] {
    const found = find(cols, dealId);
    const target = cols.find((c) => c.id === stageId);
    if (!found || !target) return cols;
    const moved: BoardDeal = { ...found.deal, status: statusForStage(target.code) };
    return cols.map((c) => {
      if (c.id === found.column.id) return { ...c, deals: c.deals.filter((d) => d.id !== dealId) };
      if (c.id === stageId) return { ...c, deals: [moved, ...c.deals] };
      return c;
    });
  }

  function move(dealId: string, stageId: string, lostReason: string | null) {
    const before = columns;
    const found = find(before, dealId);
    if (!found || found.column.id === stageId) return;
    setError(null);
    setColumns(applyMove(before, dealId, stageId)); // сразу показываем результат
    startTransition(async () => {
      const result = await changeStage(dealId, stageId, lostReason);
      if (!result.ok) {
        setColumns(before); // откат: сервер отказал
        setError(`«${found.deal.title}»: ${result.message}`);
      }
    });
  }

  function drop(stageId: string) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const found = find(columns, id);
    const target = columns.find((c) => c.id === stageId);
    if (!found || !target || found.column.id === stageId) return;
    if (target.code === "lost") {
      setReason("");
      setLostAsk({ dealId: id, stageId });
      return;
    }
    move(id, stageId, null);
  }

  function cancelLost() {
    setLostAsk(null);
    setReason("");
  }

  function confirmLost() {
    if (!lostAsk) return;
    if (!reason.trim()) return;
    const { dealId, stageId } = lostAsk;
    cancelLost();
    move(dealId, stageId, reason.trim());
  }

  return (
    <>
      {error && (
        <div className="alert" role="alert" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: "2px 12px" }} onClick={() => setError(null)}>
            Закрыть
          </button>
        </div>
      )}
      <p className="muted" style={{ margin: 0 }}>
        Перетащите карточку в другую колонку или выберите стадию в списке внутри карточки.{pending ? " Сохранение…" : ""}
      </p>
      <div className="kanban-board">
        {columns.map((stage) => {
          const sum = stage.deals.reduce((x, o) => x + (o.amount ?? 0), 0);
          return (
            <section
              key={stage.id}
              className={`kanban-col${overStage === stage.id && dragId ? " drop-target" : ""}`}
              aria-label={stage.name}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStage !== stage.id) setOverStage(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage((s) => (s === stage.id ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage.id);
              }}
            >
              <header className="kanban-head" style={{ ["--c" as string]: stage.color }}>
                <span className="kanban-title">{stage.name}</span>
                <span className="muted">
                  {stage.deals.length} · {formatMoney(sum)}
                </span>
              </header>
              {stage.deals.length === 0 && <p className="muted" style={{ padding: "8px 4px" }}>Нет сделок. Перетащите сюда карточку.</p>}
              {stage.deals.map((o) => (
                <article
                  key={o.id}
                  className={`deal${dragId === o.id ? " dragging" : ""}`}
                  style={{ ["--c" as string]: stage.color }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", o.id);
                    setDragId(o.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                >
                  <Link href={`/opportunities/${o.id}`} className="deal-title" draggable={false}>
                    {o.title}
                  </Link>
                  <span className="muted">{o.account}</span>
                  {o.contact && <span className="muted">{o.contact}</span>}
                  <span className="deal-sum">{formatMoney(o.amount)}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="badge" style={{ ["--c" as string]: opportunityStatusColors[o.status] }}>
                      {opportunityStatusLabels[o.status]}
                    </span>
                    {o.eventDate && <span className="muted">{new Date(o.eventDate).toLocaleDateString("ru-RU")}</span>}
                  </span>
                  <StageMover key={stage.id} opportunityId={o.id} currentStageId={stage.id} stages={stages} compact />
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {lostAsk && (
        <div className="modal-backdrop" onClick={cancelLost}>
          <div className="glass modal" role="dialog" aria-modal="true" aria-label="Причина отказа" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Причина отказа</h2>
            <p className="muted" style={{ marginBottom: 10 }}>
              Для стадии «Проиграна» нужно указать причину.
            </p>
            <textarea ref={reasonRef} className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-label="Причина отказа" placeholder="Например: выбрали другого подрядчика" />
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-primary" onClick={confirmLost} disabled={!reason.trim()}>
                Перевести в «Проиграна»
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelLost}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
