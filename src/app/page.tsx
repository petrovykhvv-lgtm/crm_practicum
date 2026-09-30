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
    ["Лиды", leads],
    ["Компании", accounts],
    ["Контакты", contacts],
    ["Сделки", opportunities],
    ["Активности", activities],
  ] as const;

  return (
    <main className="page">
      <header>
        <span className="badge" style={{ ["--c" as string]: "var(--green)" }}>База данных подключена</span>
        <h1 style={{ fontSize: 44, marginTop: 12 }}>CRM-lite</h1>
        <p style={{ color: "var(--text-muted)" }}>Проект запущен локально. Ниже — данные, найденные в базе.</p>
      </header>
      <section className="glass">
        <div className="grid">
          {items.map(([label, value]) => (
            <div className="kpi" key={label}>
              <div className="v">{value}</div>
              <div className="l">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
