import Link from "next/link";

export function FilterBar({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form action={action} method="get" className="filters">
      {children}
      <button type="submit" className="btn btn-primary">
        Применить
      </button>
      <Link href={action} className="btn btn-ghost">
        Сбросить
      </Link>
    </form>
  );
}

export function SearchInput({ defaultValue, placeholder }: { defaultValue?: string; placeholder: string }) {
  return (
    <label className="field" style={{ flex: "1 1 240px" }}>
      <span>Поиск</span>
      <input className="input" type="search" name="q" defaultValue={defaultValue} placeholder={placeholder} />
    </label>
  );
}

export function FilterSelect({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">Все</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResultsSummary({ shown, total, filtered }: { shown: number; total: number; filtered: boolean }) {
  return filtered ? `Найдено: ${shown} из ${total}` : `Всего: ${total}`;
}
