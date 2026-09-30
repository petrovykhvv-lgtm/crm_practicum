import type { Metadata } from "next";
import { OpportunityForm } from "@/components/opportunity-form";
import { Card, PageHeader } from "@/components/ui";
import { createOpportunity } from "@/lib/actions/opportunities";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Новая сделка" };

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ accountId?: string; contactId?: string }> }) {
  const { accountId, contactId } = await searchParams;
  const [accounts, contacts, stages] = await Promise.all([
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contact.findMany({ orderBy: { lastName: "asc" } }),
    db.stage.findMany({ orderBy: { position: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Новая сделка" breadcrumb={{ href: "/opportunities", label: "Сделки" }} />
      <Card>
        <OpportunityForm
          action={createOpportunity}
          accounts={accounts}
          contacts={contacts.map((c) => ({ id: c.id, accountId: c.accountId, name: `${c.lastName} ${c.firstName}` }))}
          stages={stages.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
          submitLabel="Создать сделку"
          cancelHref="/opportunities"
          initial={{ accountId: accountId ?? "", contactId: contactId ?? "", stageId: stages[0]?.id ?? "" }}
        />
      </Card>
    </>
  );
}
