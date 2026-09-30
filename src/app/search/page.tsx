import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { formatMoney, leadStatusColors, leadStatusLabels, stageColors } from "@/lib/labels";
import { accountSearch, contactSearch, leadSearch, opportunitySearch, pickParam, type SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = pickParam(await searchParams, "q");
  const LIMIT = 20;

  const [contacts, accounts, deals, leads] = q
    ? await Promise.all([
        db.contact.findMany({ where: contactSearch(q), include: { account: true }, orderBy: { lastName: "asc" }, take: LIMIT }),
        db.account.findMany({ where: accountSearch(q), orderBy: { name: "asc" }, take: LIMIT }),
        db.opportunity.findMany({ where: opportunitySearch(q), include: { account: true, stage: true }, orderBy: { createdAt: "desc" }, take: LIMIT }),
        db.lead.findMany({ where: leadSearch(q), orderBy: { createdAt: "desc" }, take: LIMIT }),
      ])
    : [[], [], [], []];
  const found = contacts.length + accounts.length + deals.length + leads.length;

  return (
    <>
      <PageHeader
        title="Поиск"
        subtitle={q ? `По запросу «${q}» найдено: ${found}` : "Введите имя контакта, название компании или сделки в поле слева."}
      />
      {q && found === 0 && (
        <Card>
          <p className="muted">Ничего не найдено. Попробуйте часть названия или другое написание.</p>
        </Card>
      )}
      {contacts.length > 0 && (
        <Card title="Контакты" aside={String(contacts.length)}>
          <div className="list">
            {contacts.map((c) => (
              <div className="list-item" key={c.id}>
                <Link href={`/contacts/${c.id}`}>{c.lastName} {c.firstName}</Link>
                <span className="muted">{c.account.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {accounts.length > 0 && (
        <Card title="Компании" aside={String(accounts.length)}>
          <div className="list">
            {accounts.map((a) => (
              <div className="list-item" key={a.id}>
                <Link href={`/accounts/${a.id}`}>{a.name}</Link>
                <span className="muted">{a.city ?? ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {deals.length > 0 && (
        <Card title="Сделки" aside={String(deals.length)}>
          <div className="list">
            {deals.map((o) => (
              <div className="list-item" key={o.id}>
                <span>
                  <Link href={`/opportunities/${o.id}`}>{o.title}</Link> <span className="muted">· {o.account.name}</span>
                </span>
                <span className="row">
                  <Badge color={stageColors[o.stage.code] ?? "var(--teal)"}>{o.stage.name}</Badge>
                  <span>{formatMoney(o.amount)}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {leads.length > 0 && (
        <Card title="Лиды" aside={String(leads.length)}>
          <div className="list">
            {leads.map((l) => (
              <div className="list-item" key={l.id}>
                <span>
                  <Link href={`/leads/${l.id}`}>{l.name}</Link> <span className="muted">· {l.company ?? "без компании"}</span>
                </span>
                <Badge color={leadStatusColors[l.status]}>{leadStatusLabels[l.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
