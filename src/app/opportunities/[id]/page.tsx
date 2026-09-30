import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/activity-list";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { deleteOpportunity } from "@/lib/actions/opportunities";
import { db } from "@/lib/db";
import { formatDate, formatMoney, opportunityStatusColors, opportunityStatusLabels, stageColors } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await db.opportunity.findUnique({
    where: { id },
    include: { account: true, contact: true, stage: true, lead: true, activities: { orderBy: { createdAt: "desc" } } },
  });
  if (!deal) notFound();

  return (
    <>
      <PageHeader
        title={deal.title}
        breadcrumb={{ href: "/opportunities", label: "Сделки" }}
        subtitle={
          <span className="row">
            <Badge color={stageColors[deal.stage.code] ?? "var(--teal)"}>{deal.stage.name}</Badge>
            <Badge color={opportunityStatusColors[deal.status]}>{opportunityStatusLabels[deal.status]}</Badge>
          </span>
        }
        actions={
          <>
            <LinkButton href={`/opportunities/${deal.id}/edit`} ghost>Редактировать</LinkButton>
            <DeleteButton action={deleteOpportunity.bind(null, deal.id)} confirmText={`Удалить сделку «${deal.title}»? Её активности тоже будут удалены.`} />
          </>
        }
      />
      <div className="detail-grid">
        <Card title="Данные сделки">
          <DetailList
            items={[
              ["Компания", <Link key="a" href={`/accounts/${deal.account.id}`}>{deal.account.name}</Link>],
              ["Контакт", deal.contact ? <Link href={`/contacts/${deal.contact.id}`}>{deal.contact.firstName} {deal.contact.lastName}</Link> : null],
              ["Сумма", formatMoney(deal.amount)],
              ["Площадка", deal.venue],
              ["Мероприятие", formatDate(deal.eventDate)],
              ...(deal.status !== "open" ? ([["Закрыта", formatDate(deal.closedAt)]] as [string, string][]) : []),
              ...(deal.status === "lost" ? ([["Причина отказа", deal.lostReason]] as [string, string | null][]) : []),
              ["Исходный лид", deal.lead ? <Link href={`/leads/${deal.lead.id}`}>{deal.lead.name}</Link> : null],
              ["Создана", formatDate(deal.createdAt)],
            ]}
          />
        </Card>
        <Card title="Активности" aside={`${deal.activities.length}`}>
          <ActivityList items={deal.activities} />
        </Card>
      </div>
    </>
  );
}
