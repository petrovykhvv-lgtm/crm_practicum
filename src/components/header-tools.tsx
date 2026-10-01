"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setCurrentManager } from "@/lib/actions/settings";

const CREATE_LINKS = [
  { href: "/leads/new", label: "Лид" },
  { href: "/opportunities/new", label: "Сделка" },
  { href: "/accounts/new", label: "Компания" },
  { href: "/contacts/new", label: "Контакт" },
];

/** Меню «+ Создать»: быстрый переход к формам создания из любого места. */
export function CreateMenu() {
  const close = (el: HTMLElement) => el.closest("details")?.removeAttribute("open");
  return (
    <details
      className="create-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") close(e.currentTarget);
      }}
    >
      <summary className="btn btn-primary">+ Создать</summary>
      <div className="create-pop" role="menu">
        {CREATE_LINKS.map((l) => (
          <Link key={l.href} href={l.href} role="menuitem" onClick={(e) => close(e.currentTarget)}>
            {l.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

/** Выбор текущего менеджера («работаю как»). Определяет ответственного по умолчанию и фильтр «Мои». */
export function ManagerSwitcher({ managers, currentId }: { managers: { id: string; name: string }[]; currentId: string }) {
  const [pending, start] = useTransition();
  if (managers.length === 0) return null;
  return (
    <label className="as-user" title="Работаю как">
      <span className="sr-only">Работаю как</span>
      <select className="input" value={currentId} disabled={pending} onChange={(e) => start(() => setCurrentManager(e.target.value))} aria-label="Работаю как">
        <option value="">Менеджер не выбран</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsLink() {
  return (
    <Link href="/settings" className="icon-link" aria-label="Настройки" title="Настройки">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );
}
