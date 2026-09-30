import { createLead } from "@/lib/actions/leads";
import { LeadForm } from "@/components/lead-form";
import { Card, PageHeader } from "@/components/ui";

export default function NewLeadPage() {
  return (
    <>
      <PageHeader title="Новый лид" breadcrumb={{ href: "/leads", label: "Лиды" }} />
      <Card>
        <LeadForm action={createLead} submitLabel="Создать лида" cancelHref="/leads" initial={{ status: "new" }} />
      </Card>
    </>
  );
}
