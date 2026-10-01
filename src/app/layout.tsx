import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { CreateMenu, ManagerSwitcher, SettingsLink } from "@/components/header-tools";
import { Nav } from "@/components/nav";
import { getCurrentManagerId, getManagers } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { startOfDay } from "@/lib/tz";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600"], variable: "--font-display-loaded" });
const ui = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui-loaded" });

export const metadata: Metadata = {
  title: { default: "CRM-lite", template: "%s — CRM-lite" },
  description: "CRM для агентства выставочных стендов",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Счётчик просроченных задач в меню: считается при каждом запросе.
  const startOfToday = startOfDay();
  const [overdueTasks, managers, currentManagerId] = await Promise.all([
    db.activity.count({ where: { type: "task", done: false, dueDate: { lt: startOfToday } } }),
    getManagers(),
    getCurrentManagerId(),
  ]);
  return (
    <html lang="ru" className={`${display.variable} ${ui.variable}`}>
      <body>
        {/* Фиксированная шапка: сплошная полоса на всю ширину, контент под неё не просвечивает */}
        <header className="topbar-wrap">
          <div className="topbar glass">
            <Link href="/" className="brand-logo" aria-label="CRM-lite: выставочные стенды и бренд-зоны, на главную">
              <Image src="/logo.webp" alt="Выставочные стенды и бренд-зоны" width={1000} height={334} sizes="190px" priority />
            </Link>
            <Nav overdueTasks={overdueTasks} />
            <div className="header-tools">
              <CreateMenu />
              <form action="/search" method="get" className="search-box" role="search">
                <input className="input" type="search" name="q" placeholder="Поиск по CRM…" aria-label="Поиск по CRM" />
              </form>
              <Link href="/search" className="icon-link search-link" aria-label="Поиск">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </Link>
              <ManagerSwitcher managers={managers} currentId={currentManagerId ?? ""} />
              <SettingsLink />
            </div>
          </div>
        </header>
        <div className="shell">
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
