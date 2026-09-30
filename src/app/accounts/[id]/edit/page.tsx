import { notFound } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { Card, PageHeader } from "@/components/ui";
import { updateAccount } from "@/lib/actions/accounts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await db.account.findUnique({ where: { id } });
  if (!account) notFound();

  return (
    <>
      <PageHeader title={`Редактирование: ${account.name}`} breadcrumb={{ href: `/accounts/${account.id}`, label: "К карточке компании" }} />
      <Card>
        <AccountForm
          action={updateAccount.bind(null, account.id)}
          submitLabel="Сохранить"
          cancelHref={`/accounts/${account.id}`}
          initial={{
            name: account.name,
            industry: account.industry ?? "",
            city: account.city ?? "",
            phone: account.phone ?? "",
            website: account.website ?? "",
          }}
        />
      </Card>
    </>
  );
}
