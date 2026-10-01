"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { importLeads, type ImportResult } from "@/lib/actions/import";

export function ImportLeadsForm() {
  const [result, run] = useActionState<ImportResult | undefined, FormData>(importLeads, undefined);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(() => run(fd));
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <label className="field">
          <span>
            CSV-файл <span className="req">*</span>
          </span>
          <input className="input" type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" name="dryRun" defaultChecked />
          <span>Только проверить файл, ничего не записывать</span>
        </label>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Обработка…" : "Загрузить"}
          </button>
          <Link href="/api/export/leads-template" className="btn btn-ghost" prefetch={false}>
            Скачать шаблон
          </Link>
        </div>
      </form>

      {result && !result.ok && (
        <div className="alert" role="alert">
          {result.message}
        </div>
      )}
      {result?.ok && (
        <div role="status" style={{ display: "grid", gap: 8 }}>
          <div className={result.skipped && result.skipped.length > 0 ? "alert warn" : "alert"} style={result.skipped?.length ? undefined : { background: "rgba(47,138,99,.12)", borderColor: "rgba(47,138,99,.4)", color: "var(--text)" }}>
            {result.dryRun ? "Проверка: " : "Готово: "}
            строк в файле {result.total}, {result.dryRun ? "будет импортировано" : "импортировано"} {result.imported}, пропущено {result.skipped?.length ?? 0}.
            {result.dryRun && result.imported ? " Снимите флажок «Только проверить» и загрузите файл ещё раз, чтобы записать лиды." : ""}
          </div>
          {result.skipped && result.skipped.length > 0 && (
            <ul className="error-list">
              {result.skipped.slice(0, 50).map((s) => (
                <li key={s.row}>
                  Строка {s.row}: {s.reason}
                </li>
              ))}
              {result.skipped.length > 50 && <li>…и ещё {result.skipped.length - 50}</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
