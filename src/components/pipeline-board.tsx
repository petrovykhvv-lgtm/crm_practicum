"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { changeStage } from "@/lib/actions/opportunities";
import { formatMoney } from "@/lib/labels";
import { statusForStage, type OpportunityStatusValue } from "@/lib/opportunity-rules";
import { LostReasonDialog, type ReasonOption } from "./lost-reason-dialog";
import { StageMover } from "./stage-mover";

export type BoardDeal = {
  id: string;
  title: string;
  account: string;
  contact: string | null;
  manager: string | null;
  amount: number | null;
  status: OpportunityStatusValue;
  /** Дата мероприятия, отформатированная сервером. */
  eventLabel: string | null;
};
export type BoardColumn = { id: string; code: string; name: string; color: string; probability: number; deals: BoardDeal[] };
type StageOption = { id: string; code: string; name: string };
type Undo = { dealId: string; fromStageId: string; title: string; toName: string };

/** Воронка с перетаскиванием сделок между стадиями (HTML5 Drag and Drop). Правила won/lost проверяет сервер. */
export function PipelineBoard({ columns: initial, stages, reasons }: { columns: BoardColumn[]; stages: StageOption[]; reasons: ReasonOption[] }) {
  const [columns, setColumns] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lostAsk, setLostAsk] = useState<{ dealId: string; stageId: string } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [pending, startTransition] = useTransition();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // После обновления данных с сервера берём их как источник истины (обновление состояния при рендере).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setColumns(initial);
  }

  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

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

  function showUndo(entry: Undo | null) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(entry);
    if (entry) undoTimer.current = setTimeout(() => setUndo(null), 10000);
  }

  function move(dealId: string, stageId: string, reasonId: string | null, comment: string | null, offerUndo = true) {
    const before = columns;
    const found = find(before, dealId);
    const target = before.find((c) => c.id === stageId);
    if (!found || !target || found.column.id === stageId) return;
    setError(null);
    showUndo(null);
    setColumns(applyMove(before, dealId, stageId)); // сразу показываем результат
    startTransition(async () => {
      const result = await changeStage(dealId, stageId, reasonId, comment);
      if (!result.ok) {
        setColumns(before); // откат: сервер отказал
        setError(`«${found.deal.title}»: ${result.message}`);
      } else if (offerUndo && found.column.code !== "lost") {
        // Возврат из «Проиграна» потребовал бы заново выбрать причину, поэтому «Отменить» там не предлагаем.
        showUndo({ dealId, fromStageId: found.column.id, title: found.deal.title, toName: target.name });
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
      setLostAsk({ dealId: id, stageId });
      return;
    }
    move(id, stageId, null, null);
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
        Перетащите карточку в другую колонку или нажмите «Сменить стадию» в карточке.{pending ? " Сохранение…" : ""}
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
                {stage.code !== "won" && stage.code !== "lost" && stage.probability > 0 && (
                  <span className="muted">
                    вероятность {stage.probability}% · прогноз {formatMoney((sum * stage.probability) / 100)}
                  </span>
                )}
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
                  <span className="muted">
                    {o.account}
                    {o.contact ? ` · ${o.contact}` : ""}
                  </span>
                  <span className="deal-sum">{formatMoney(o.amount)}</span>
                  {(o.eventLabel || o.manager) && (
                    <span className="muted">
                      {o.eventLabel}
                      {o.eventLabel && o.manager ? " · " : ""}
                      {o.manager}
                    </span>
                  )}
                  <details className="deal-stage">
                    <summary>Сменить стадию</summary>
                    <StageMover key={stage.id} opportunityId={o.id} currentStageId={stage.id} stages={stages} reasons={reasons} compact />
                  </details>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {lostAsk && (
        <LostReasonDialog
          reasons={reasons}
          onCancel={() => setLostAsk(null)}
          onConfirm={(reasonId, comment) => {
            const ask = lostAsk;
            setLostAsk(null);
            move(ask.dealId, ask.stageId, reasonId, comment);
          }}
        />
      )}

      {undo && (
        <div className="toast" role="status">
          <span>
            «{undo.title}» перенесена в «{undo.toName}»
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const u = undo;
              showUndo(null);
              move(u.dealId, u.fromStageId, null, null, false);
            }}
          >
            Отменить
          </button>
        </div>
      )}
    </>
  );
}
