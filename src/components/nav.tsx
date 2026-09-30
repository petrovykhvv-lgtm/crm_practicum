"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Дашборд" },
  { href: "/leads", label: "Лиды" },
  { href: "/pipeline", label: "Воронка" },
  { href: "/tasks", label: "Задачи" },
  { href: "/accounts", label: "Компании" },
  { href: "/contacts", label: "Контакты" },
  { href: "/opportunities", label: "Сделки" },
];

export function Nav({ overdueTasks = 0 }: { overdueTasks?: number }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Основная навигация">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {item.label}
            {item.href === "/tasks" && overdueTasks > 0 && (
              <span className="nav-badge" aria-label={`просроченных задач: ${overdueTasks}`}>
                {overdueTasks}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
