import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/activity-list";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { deleteAccount } from "@/lib/actions/accounts";
import { db } from "@/lib/db";
import { formatMoney, stageColors } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await db.account.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { lastName: "asc" } },
      leads: true,
      opportunities: { orderBy: { createdAt: "desc" }, include: { stage: true } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) notFound();

  return (
    <>
      <PageHeader
        title={account.name}
        breadcrumb={{ href: "/accounts", label: "Компании" }}
        subtitle={[account.industry, account.city].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <LinkButton href={`/accounts/${account.id}/edit`} ghost>Редактировать</LinkButton>
            <DeleteButton action={deleteAccount.bind(null, account.id)} confirmText={`Удалить компанию «${account.name}»?`} />
          </>
        }
      />
      <div className="detail-grid">
        <Card title="Данные компании">
          <DetailList
            items={[
              ["Отрасль", account.industry],
              ["Город", account.city],
              ["Телефон", account.phone],
              ["Сайт", account.website && <a href={account.website} target="_blank" rel="noreferrer">{account.website}</a>],
              ["Исходные лиды", account.leads.length ? <span key="l">{account.leads.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={`/leads/${l.id}`}>{l.name}</Link></span>)}</span> : null],
            ]}
          />
        </Card>
        <Card title="Контакты" aside={<Link href={`/contacts/new?accountId=${account.id}`}>+ добавить</Link>}>
          {account.contacts.length === 0 ? (
            <p className="muted">Контактов пока нет.</p>
          ) : (
            <div className="list">
              {account.contacts.map((c) => (
                <div className="list-item" key={c.id}>
                  <Link href={`/contacts/${c.id}`}>{c.lastName} {c.firstName}</Link>
                  <span className="muted">{c.position ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card title="Сделки" aside={<Link href={`/opportunities/new?accountId=${account.id}`}>+ добавить</Link>}>
        {account.opportunities.length === 0 ? (
          <p className="muted">Сделок пока нет.</p>
        ) : (
          <div className="list">
            {account.opportunities.map((o) => (
              <div className="list-item" key={o.id}>
                <Link href={`/opportunities/${o.id}`}>{o.title}</Link>
                <span className="row">
                  <Badge color={stageColors[o.stage.code] ?? "var(--teal)"}>{o.stage.name}</Badge>
                  <span>{formatMoney(o.amount)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    <Card title="Активности" aside={`${account.activities.length}`}>
        <ActivityList items={account.activities} />
      </Card>
    </>
  );
}
