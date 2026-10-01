import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoryCard } from "@/components/history-card";
import { ActivitySection } from "@/components/activity-section";
import { DeleteButton } from "@/components/delete-button";
import { Badge, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { deleteLead } from "@/lib/actions/leads";
import { db } from "@/lib/db";
import { formatDate, formatMoney, leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: x ? x.name : "Лид не найден" };
}

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      manager: { select: { name: true } },
      convertedAccount: true,
      convertedContact: true,
      opportunity: true,
      activities: { orderBy: { createdAt: "desc" }, include: { assignee: { select: { id: true, name: true } } } },
    },
  });
  if (!lead) notFound();

  const canConvert = lead.status !== "converted" && lead.status !== "disqualified";
  // Если в базе уже есть компания с таким названием, контакт будет привязан к ней.
  const matchingAccount =
    canConvert && lead.company
      ? await db.account.findFirst({ where: { name: { equals: lead.company, mode: "insensitive" } }, select: { id: true, name: true } })
      : null;

  return (
    <>
      <PageHeader
        title={lead.name}
        breadcrumb={{ href: "/leads", label: "Лиды" }}
        subtitle={<Badge color={leadStatusColors[lead.status]}>{leadStatusLabels[lead.status]}</Badge>}
        actions={
          <>
            <LinkButton href={`/leads/${lead.id}/edit`} ghost>Редактировать</LinkButton>
            <DeleteButton action={deleteLead.bind(null, lead.id)} confirmText={`Удалить лида «${lead.name}»?`} consequences="Лид и его активности (заметки и задачи) будут удалены без возможности восстановления." />
          </>
        }
      />
      <div className="detail-grid">
        <Card title="Данные лида">
          <DetailList
            items={[
              ["Компания", lead.company],
              ["Email", lead.email],
              ["Телефон", lead.phone],
              ["Источник", leadSourceLabels[lead.source]],
              ["Бюджет", formatMoney(lead.budget)],
              ["Площадка", lead.venue],
              ["Желаемый срок", formatDate(lead.deadline)],
              ["Формат работ", lead.workFormat],
              ["Ответственный", lead.manager?.name],
              ...(lead.status === "disqualified" ? ([["Причина отказа", lead.disqualifyReason]] as [string, string | null][]) : []),
              ["Создан", formatDate(lead.createdAt)],
            ]}
          />
        </Card>
        <div className="content">
          {lead.status !== "converted" && (
            <Card title="Конвертация">
              {canConvert ? (
                <div className="convert-note">
                  <p>Лид можно конвертировать. При конвертации будет создано:</p>
                  <ul className="convert-list">
                    <li>контакт «{lead.name}»;</li>
                    <li>
                      {matchingAccount ? (
                        <>
                          контакт привяжется к существующей компании <Link href={`/accounts/${matchingAccount.id}`}>«{matchingAccount.name}»</Link>;
                        </>
                      ) : (
                        <>новая компания «{lead.company ?? lead.name}»;</>
                      )}
                    </li>
                    <li>по желанию сделка на стадии «Новая»{lead.budget ? ` с суммой ${formatMoney(lead.budget)}` : ""}.</li>
                  </ul>
                  <div>
                    <LinkButton href={`/leads/${lead.id}/convert`}>Конвертировать</LinkButton>
                  </div>
                </div>
              ) : (
                <p className="muted">Конвертация недоступна: лид отклонён. Верните его в статус «В работе» через редактирование.</p>
              )}
            </Card>
          )}
          {lead.status === "converted" && (
            <Card title="Результат конвертации" aside={formatDate(lead.convertedAt)}>
              <DetailList
                items={[
                  ["Компания", lead.convertedAccount && <Link href={`/accounts/${lead.convertedAccount.id}`}>{lead.convertedAccount.name}</Link>],
                  ["Контакт", lead.convertedContact && <Link href={`/contacts/${lead.convertedContact.id}`}>{lead.convertedContact.firstName} {lead.convertedContact.lastName}</Link>],
                  ["Сделка", lead.opportunity && <Link href={`/opportunities/${lead.opportunity.id}`}>{lead.opportunity.title}</Link>],
                ]}
              />
            </Card>
          )}
          <ActivitySection kind="lead" id={lead.id} items={lead.activities} />
          <HistoryCard entityType="lead" entityId={lead.id} />
        </div>
      </div>
    </>
  );
}
