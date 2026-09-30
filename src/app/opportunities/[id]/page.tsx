import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivitySection } from "@/components/activity-section";
import { StageMover } from "@/components/stage-mover";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { deleteOpportunity } from "@/lib/actions/opportunities";
import { db } from "@/lib/db";
import { formatDate, formatMoney, opportunityStatusColors, opportunityStatusLabels, stageColors } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.opportunity.findUnique({ where: { id }, select: { title: true } });
  return { title: x ? x.title : "Сделка не найден" };
}

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stages = await db.stage.findMany({ orderBy: { position: "asc" } });
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
            {/* у выигранной и проигранной сделки статус совпадает со стадией, второй бейдж не нужен */}
            {deal.status === "open" && <Badge color={opportunityStatusColors[deal.status]}>{opportunityStatusLabels[deal.status]}</Badge>}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/opportunities/${deal.id}/edit`} ghost>Редактировать</LinkButton>
            <DeleteButton action={deleteOpportunity.bind(null, deal.id)} confirmText={`Удалить сделку «${deal.title}»?`} consequences="Сделка, её активности и история стадий будут удалены без возможности восстановления." />
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
        <div className="content">
          <Card title="Стадия сделки">
            <StageMover opportunityId={deal.id} currentStageId={deal.stageId} stages={stages.map((s) => ({ id: s.id, code: s.code, name: s.name }))} />
            <p className="muted" style={{ marginTop: 8 }}>«Выиграна» требует сумму и контакт, «Проиграна» требует причину отказа.</p>
          </Card>
          <ActivitySection kind="opportunity" id={deal.id} items={deal.activities} />
        </div>
      </div>
    </>
  );
}
