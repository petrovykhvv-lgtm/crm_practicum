import Link from "next/link";
import { PERIOD_PRESETS, STEP_LABELS, type Period } from "@/lib/period";

/**
 * Выбор периода и шага динамики. Обычная GET-форма: значения попадают в адресную строку,
 * поэтому выбор можно сохранить в закладку или отправить ссылкой.
 */
export function PeriodControls({ period, requestedStep }: { period: Period; requestedStep: string }) {
  return (
    <form action="/" method="get" className="glass period-controls" aria-label="Период и шаг графиков">
      <label className="field">
        <span>Период</span>
        <select className="input" name="period" defaultValue={period.key === "custom" ? "custom" : period.key}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="custom" disabled>
            Свой период (даты справа)
          </option>
        </select>
      </label>
      <label className="field">
        <span>С даты</span>
        <input className="input" type="date" name="from" defaultValue={period.fromInput} />
      </label>
      <label className="field">
        <span>По дату</span>
        <input className="input" type="date" name="to" defaultValue={period.toInput} />
      </label>
      <label className="field">
        <span>Динамика графиков</span>
        <select className="input" name="step" defaultValue={requestedStep}>
          <option value="">Авто</option>
          {(Object.keys(STEP_LABELS) as (keyof typeof STEP_LABELS)[]).map((k) => (
            <option key={k} value={k}>
              {STEP_LABELS[k][0].toUpperCase() + STEP_LABELS[k].slice(1)}
            </option>
          ))}
        </select>
      </label>
      <div className="row" style={{ alignSelf: "end" }}>
        <button type="submit" className="btn btn-primary">
          Применить
        </button>
        <Link href="/" className="btn btn-ghost">
          Сбросить
        </Link>
      </div>
      <p className="hint period-hint">
        Если указаны обе даты, они важнее выбора периода. Период влияет на графики динамики и показатели «за период»; воронка и списки показывают текущее состояние.
      </p>
    </form>
  );
}
