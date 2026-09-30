import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";
import { Card, PageHeader } from "@/components/ui";
import { createAccount } from "@/lib/actions/accounts";

export const metadata: Metadata = { title: "Новая компания" };

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
