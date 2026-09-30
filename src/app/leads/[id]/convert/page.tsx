import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConvertLeadForm } from "@/components/convert-lead-form";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { convertLead } from "@/lib/actions/convert";
import { db } from "@/lib/db";
import { NEW_ACCOUNT, toAmountInput, toDateInput } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await db.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: x ? `Конвертация: ${x.name}` : "Лид не найден" };
}

export const dynamic = "force-dynamic";

export default async function ConvertLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) notFound();

  const header = <PageHeader title={`Конвертация: ${lead.name}`} breadcrumb={{ href: `/leads/${lead.id}`, label: "К карточке лида" }} />;

  if (lead.status === "converted" || lead.status === "disqualified") {
    return (
      <>
        {header}
        <Card>
          <p>
            {lead.status === "converted"
              ? "Этот лид уже конвертирован, повторная конвертация невозможна."
              : "Отклонённого лида нельзя конвертировать. Сначала верните его в статус «В работе»."}
          </p>
          <div style={{ marginTop: 16 }}>
            <LinkButton href={`/leads/${lead.id}`} ghost>
              Вернуться к карточке
            </LinkButton>
          </div>
          {lead.status === "converted" && (
            <p className="muted" style={{ marginTop: 12 }}>
              Созданные записи доступны в <Link href={`/leads/${lead.id}`}>карточке лида</Link>.
            </p>
          )}
        </Card>
      </>
    );
  }

  const [accounts, matching] = await Promise.all([
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    lead.company ? db.account.findFirst({ where: { name: { equals: lead.company, mode: "insensitive" } }, select: { id: true } }) : null,
  ]);

  // Имя лида «Имя Фамилия»: первое слово — имя, остальное — фамилия. Если слово одно, фамилию нужно ввести вручную.
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const companyLabel = lead.company ?? lead.name;

  return (
    <>
      {header}
      <Card>
        <ConvertLeadForm
          action={convertLead.bind(null, lead.id)}
          accounts={accounts}
          cancelHref={`/leads/${lead.id}`}
          initial={{
            firstName: firstName ?? "",
            lastName: rest.join(" "),
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            accountChoice: matching?.id ?? NEW_ACCOUNT,
            accountName: lead.company ?? "",
            dealTitle: lead.workFormat ? `${companyLabel} — ${lead.workFormat}` : companyLabel,
            amount: toAmountInput(lead.budget),
            venue: lead.venue ?? "",
            eventDate: toDateInput(lead.deadline),
          }}
        />
      </Card>
    </>
  );
}
