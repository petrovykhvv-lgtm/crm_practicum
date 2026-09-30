import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivitySection } from "@/components/activity-section";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { deleteContact } from "@/lib/actions/contacts";
import { db } from "@/lib/db";
import { formatMoney, stageColors } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.contact.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: x ? `${x.firstName} ${x.lastName}` : "Контакт не найден" };
}

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      account: true,
      leads: true,
      opportunities: { orderBy: { createdAt: "desc" }, include: { stage: true } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) notFound();
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <>
      <PageHeader
        title={fullName}
        breadcrumb={{ href: "/contacts", label: "Контакты" }}
        subtitle={contact.position ?? undefined}
        actions={
          <>
            <LinkButton href={`/contacts/${contact.id}/edit`} ghost>Редактировать</LinkButton>
            <DeleteButton action={deleteContact.bind(null, contact.id)} confirmText={`Удалить контакт «${fullName}»?`} />
          </>
        }
      />
      <div className="detail-grid">
        <Card title="Данные контакта">
          <DetailList
            items={[
              ["Компания", <Link key="a" href={`/accounts/${contact.account.id}`}>{contact.account.name}</Link>],
              ["Должность", contact.position],
              ["Email", contact.email],
              ["Телефон", contact.phone],
              ["Исходный лид", contact.leads.length ? <span key="l">{contact.leads.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={`/leads/${l.id}`}>{l.name}</Link></span>)}</span> : null],
            ]}
          />
        </Card>
        <Card title="Сделки" aside={<Link href={`/opportunities/new?accountId=${contact.accountId}&contactId=${contact.id}`}>+ добавить</Link>}>
          {contact.opportunities.length === 0 ? (
            <p className="muted">Сделок пока нет.</p>
          ) : (
            <div className="list">
              {contact.opportunities.map((o) => (
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
      </div>
      <ActivitySection kind="contact" id={contact.id} items={contact.activities} />
    </>
  );
}
