"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Дашборд" },
  { href: "/leads", label: "Лиды" },
  { href: "/accounts", label: "Компании" },
  { href: "/contacts", label: "Контакты" },
  { href: "/opportunities", label: "Сделки" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Основная навигация">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
