import type { Metadata } from "next";
import { createLead } from "@/lib/actions/leads";
import { getCurrentManagerId, getManagers } from "@/lib/current-manager";
import { LeadForm } from "@/components/lead-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Новый лид" };

export default async function NewLeadPage() {
  const [managers, currentManagerId] = await Promise.all([getManagers(), getCurrentManagerId()]);
  return (
    <>
      <PageHeader title="Новый лид" breadcrumb={{ href: "/leads", label: "Лиды" }} />
      <Card>
        <LeadForm action={createLead} hideStatus submitLabel="Создать лида" cancelHref="/leads" managers={managers} initial={{ status: "new", managerId: currentManagerId ?? "" }} />
      </Card>
    </>
  );
}
