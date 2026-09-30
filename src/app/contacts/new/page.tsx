import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";
import { createContact } from "@/lib/actions/contacts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const { accountId } = await searchParams;
  const accounts = await db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Новый контакт" breadcrumb={{ href: "/contacts", label: "Контакты" }} />
      <Card>
        <ContactForm action={createContact} accounts={accounts} submitLabel="Создать контакт" cancelHref="/contacts" initial={{ accountId: accountId ?? "" }} />
      </Card>
    </>
  );
}
