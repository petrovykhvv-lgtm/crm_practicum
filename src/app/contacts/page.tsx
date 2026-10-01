import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, ResultsSummary, SearchInput } from "@/components/filters";
import { ExportLink, Pagination, SortTh, flatParams } from "@/components/list-controls";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { PAGE_SIZE, contactQuery } from "@/lib/queries";
import type { SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Контакты" };
export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = contactQuery(sp);
  const params = flatParams(sp);
  const page = query.page;
  const [contacts, matched, total] = await Promise.all([
    db.contact.findMany({ where: query.where, orderBy: query.orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { account: true } }),
    db.contact.count({ where: query.where }),
    db.contact.count(),
  ]);
  const th = { base: "/contacts", params, sort: query.sort };

  return (
    <>
      <PageHeader
        title="Контакты"
        subtitle={<ResultsSummary shown={matched} total={total} filtered={query.filtered} />}
        actions={
          <>
            <ExportLink entity="contacts" params={params} />
            <LinkButton href="/contacts/new">Создать контакт</LinkButton>
          </>
        }
      />
      <Card>
        <FilterBar action="/contacts">
          <SearchInput defaultValue={query.q} placeholder="Имя, фамилия, компания, email, должность" />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Контакт" field="lastName" {...th} />
                <SortTh label="Должность" field="position" className="hide-sm" {...th} />
                <th>Компания</th>
                <th className="hide-sm">Email</th>
                <th className="hide-sm">Телефон</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">{query.filtered ? "Ничего не найдено по заданным условиям." : "Контактов пока нет."}</td>
                </tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/contacts/${c.id}`} className="row-link">{c.lastName} {c.firstName}</Link></td>
                  <td className="hide-sm">{c.position ?? "—"}</td>
                  <td><Link href={`/accounts/${c.accountId}`}>{c.account.name}</Link></td>
                  <td className="hide-sm">{c.email ?? "—"}</td>
                  <td className="hide-sm">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={matched} pageSize={PAGE_SIZE} base="/contacts" params={params} />
      </Card>
    </>
  );
}
