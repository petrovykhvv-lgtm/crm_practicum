import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, ResultsSummary, SearchInput } from "@/components/filters";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { contactSearch, pickParam, type SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Контакты" };

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = pickParam(await searchParams, "q");
  const [contacts, total] = await Promise.all([
    db.contact.findMany({ where: contactSearch(q), orderBy: [{ lastName: "asc" }, { firstName: "asc" }], include: { account: true } }),
    db.contact.count(),
  ]);
  return (
    <>
      <PageHeader
        title="Контакты"
        subtitle={<ResultsSummary shown={contacts.length} total={total} filtered={Boolean(q)} />}
        actions={<LinkButton href="/contacts/new">Создать контакт</LinkButton>}
      />
      <Card>
        <FilterBar action="/contacts">
          <SearchInput defaultValue={q} placeholder="Имя, фамилия, компания, email, должность" />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Контакт</th>
                <th className="hide-sm">Должность</th>
                <th>Компания</th>
                <th className="hide-sm">Email</th>
                <th className="hide-sm">Телефон</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">{q ? "Ничего не найдено по заданным условиям." : "Контактов пока нет."}</td>
                </tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/contacts/${c.id}`}>{c.lastName} {c.firstName}</Link></td>
                  <td className="hide-sm">{c.position ?? "—"}</td>
                  <td><Link href={`/accounts/${c.accountId}`}>{c.account.name}</Link></td>
                  <td className="hide-sm">{c.email ?? "—"}</td>
                  <td className="hide-sm">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
