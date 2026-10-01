import Link from "next/link";
import type { SearchParams } from "@/lib/search";
import type { SortDir } from "@/lib/queries";

/** Плоские строковые параметры адреса (первое значение каждого ключа). */
export function flatParams(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first) out[k] = first;
  }
  return out;
}

export function hrefWith(base: string, params: Record<string, string>, patch: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Заголовок столбца с сортировкой: клик переключает направление, сортировка сбрасывает страницу. */
export function SortTh({ label, field, base, params, sort, className }: { label: string; field: string; base: string; params: Record<string, string>; sort: { key: string; dir: SortDir }; className?: string }) {
  const active = sort.key === field;
  const nextDir: SortDir = active && sort.dir === "asc" ? "desc" : "asc";
  return (
    <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={hrefWith(base, params, { sort: field, dir: nextDir, page: undefined })} className="sort-link">
        {label}
        <span aria-hidden className="sort-mark">{active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</span>
      </Link>
    </th>
  );
}

export function Pagination({ page, total, pageSize, base, params }: { page: number; total: number; pageSize: number; base: string; params: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const go = (n: number) => hrefWith(base, params, { page: n === 1 ? undefined : String(n) });
  return (
    <nav className="pagination" aria-label="Страницы списка">
      {current > 1 ? (
        <Link href={go(current - 1)} className="btn btn-ghost" rel="prev">
          ← Назад
        </Link>
      ) : (
        <span />
      )}
      <span className="muted">
        Страница {current} из {pages} · записей {total}
      </span>
      {current < pages ? (
        <Link href={go(current + 1)} className="btn btn-ghost" rel="next">
          Вперёд →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Ссылка «Экспорт CSV» с текущими фильтрами и сортировкой. */
export function ExportLink({ entity, params }: { entity: string; params: Record<string, string> }) {
  const { page: _page, ...rest } = params;
  void _page;
  return (
    <Link href={hrefWith(`/api/export/${entity}`, rest, {})} className="btn btn-ghost" prefetch={false}>
      Экспорт CSV
    </Link>
  );
}
