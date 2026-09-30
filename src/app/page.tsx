import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leads, accounts, contacts, opportunities, activities] = await Promise.all([
    db.lead.count(),
    db.account.count(),
    db.contact.count(),
    db.opportunity.count(),
    db.activity.count(),
  ]);

  const items = [
    ["Лиды", leads, "/leads"],
    ["Компании", accounts, "/accounts"],
    ["Контакты", contacts, "/contacts"],
    ["Сделки", opportunities, "/opportunities"],
    ["Активности", activities, null],
  ] as const;

  return (
    <>
      <PageHeader title="Дашборд" subtitle="Полноценный дашборд появится на одном из следующих шагов. Пока здесь количество записей в базе." />
      <Card>
        <div className="kpi-grid">
          {items.map(([label, value, href]) => (
            <div className="kpi" key={label}>
              <div className="v">{value}</div>
              <div className="l">{href ? <Link href={href}>{label}</Link> : label}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
