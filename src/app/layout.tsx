import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { db } from "@/lib/db";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600"], variable: "--font-display-loaded" });
const ui = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui-loaded" });

export const metadata: Metadata = {
  title: { default: "CRM-lite", template: "%s — CRM-lite" },
  description: "CRM для агентства выставочных стендов",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Счётчик просроченных задач в меню: считается при каждом запросе.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdueTasks = await db.activity.count({ where: { type: "task", done: false, dueDate: { lt: startOfToday } } });
  return (
    <html lang="ru" className={`${display.variable} ${ui.variable}`}>
      <body>
        <div className="shell">
          <header className="topbar glass">
            <div className="brand">
              CRM-lite
              <small>Выставочные стенды и бренд-зоны</small>
            </div>
            <Nav overdueTasks={overdueTasks} />
            <form action="/search" method="get" className="search-box" role="search">
              <input className="input" type="search" name="q" placeholder="Поиск по CRM…" aria-label="Поиск по CRM" />
            </form>
          </header>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
