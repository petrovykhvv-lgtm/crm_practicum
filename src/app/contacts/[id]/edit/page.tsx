import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";
import { updateContact } from "@/lib/actions/contacts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, accounts] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!contact) notFound();

  return (
    <>
      <PageHeader title={`Редактирование: ${contact.firstName} ${contact.lastName}`} breadcrumb={{ href: `/contacts/${contact.id}`, label: "К карточке контакта" }} />
      <Card>
        <ContactForm
          action={updateContact.bind(null, contact.id)}
          accounts={accounts}
          submitLabel="Сохранить"
          cancelHref={`/contacts/${contact.id}`}
          initial={{
            firstName: contact.firstName,
            lastName: contact.lastName,
            position: contact.position ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            accountId: contact.accountId,
          }}
        />
      </Card>
    </>
  );
}
