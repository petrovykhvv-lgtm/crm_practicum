import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { Card, PageHeader } from "@/components/ui";
import { updateLead } from "@/lib/actions/leads";
import { getManagers } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { toAmountInput, toDateInput } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: x ? `Редактирование: ${x.name}` : "Лид не найден" };
}

export const dynamic = "force-dynamic";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, managers] = await Promise.all([db.lead.findUnique({ where: { id } }), getManagers()]);
  if (!lead) notFound();

  return (
    <>
      <PageHeader title={`Редактирование: ${lead.name}`} breadcrumb={{ href: `/leads/${lead.id}`, label: "К карточке лида" }} />
      <Card>
        <LeadForm
          action={updateLead.bind(null, lead.id)}
          managers={managers}
          statusLocked={lead.status === "converted"}
          submitLabel="Сохранить"
          cancelHref={`/leads/${lead.id}`}
          initial={{
            name: lead.name,
            company: lead.company ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            source: lead.source,
            status: lead.status,
            budget: toAmountInput(lead.budget),
            venue: lead.venue ?? "",
            deadline: toDateInput(lead.deadline),
            workFormat: lead.workFormat ?? "",
            disqualifyReason: lead.disqualifyReason ?? "",
            managerId: lead.managerId ?? "",
          }}
        />
      </Card>
    </>
  );
}
