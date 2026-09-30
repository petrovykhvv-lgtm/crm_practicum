import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600"], variable: "--font-display-loaded" });
const ui = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui-loaded" });

export const metadata: Metadata = {
  title: "CRM-lite",
  description: "CRM для агентства выставочных стендов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${ui.variable}`}>
      <body>
        <div className="shell">
          <aside className="sidebar glass">
            <div className="brand">
              CRM-lite
              <small>Выставочные стенды и бренд-зоны</small>
            </div>
            <form action="/search" method="get" className="search-box" role="search">
              <input className="input" type="search" name="q" placeholder="Поиск по CRM…" aria-label="Поиск по CRM" />
            </form>
            <Nav />
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
