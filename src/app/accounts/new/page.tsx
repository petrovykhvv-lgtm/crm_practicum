import { AccountForm } from "@/components/account-form";
import { Card, PageHeader } from "@/components/ui";
import { createAccount } from "@/lib/actions/accounts";

export default function NewAccountPage() {
  return (
    <>
      <PageHeader title="Новая компания" breadcrumb={{ href: "/accounts", label: "Компании" }} />
      <Card>
        <AccountForm action={createAccount} submitLabel="Создать компанию" cancelHref="/accounts" />
      </Card>
    </>
  );
}
