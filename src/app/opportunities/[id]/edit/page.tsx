import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityForm } from "@/components/opportunity-form";
import { Card, PageHeader } from "@/components/ui";
import { updateOpportunity } from "@/lib/actions/opportunities";
import { getManagers } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { toAmountInput, toDateInput } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.opportunity.findUnique({ where: { id }, select: { title: true } });
  return { title: x ? `Редактирование: ${x.title}` : "Сделка не найден" };
}

export const dynamic = "force-dynamic";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, accounts, contacts, stages, managers, reasons] = await Promise.all([
    db.opportunity.findUnique({ where: { id } }),
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contact.findMany({ orderBy: { lastName: "asc" } }),
    db.stage.findMany({ orderBy: { position: "asc" } }),
    getManagers(),
    db.lostReason.findMany({ orderBy: { position: "asc" } }),
  ]);
  if (!deal) notFound();

  return (
    <>
      <PageHeader title={`Редактирование: ${deal.title}`} breadcrumb={{ href: `/opportunities/${deal.id}`, label: "К карточке сделки" }} />
      <Card>
        <OpportunityForm
          action={updateOpportunity.bind(null, deal.id)}
          accounts={accounts}
          contacts={contacts.map((c) => ({ id: c.id, accountId: c.accountId, name: `${c.lastName} ${c.firstName}` }))}
          stages={stages.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
          managers={managers}
          reasons={reasons}
          submitLabel="Сохранить"
          cancelHref={`/opportunities/${deal.id}`}
          initial={{
            title: deal.title,
            accountId: deal.accountId,
            contactId: deal.contactId ?? "",
            stageId: deal.stageId,
            amount: toAmountInput(deal.amount),
            venue: deal.venue ?? "",
            eventDate: toDateInput(deal.eventDate),
            lostReason: deal.lostReason ?? "",
            lostReasonId: deal.lostReasonId ?? "",
            managerId: deal.managerId ?? "",
          }}
        />
      </Card>
    </>
  );
}
