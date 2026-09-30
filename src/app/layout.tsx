import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
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
      <body>{children}</body>
    </html>
  );
}
