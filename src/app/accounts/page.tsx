import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, ResultsSummary, SearchInput } from "@/components/filters";
import { ExportLink, Pagination, SortTh, flatParams } from "@/components/list-controls";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { PAGE_SIZE, accountQuery } from "@/lib/queries";
import type { SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Компании" };
export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = accountQuery(sp);
  const params = flatParams(sp);
  const page = query.page;
  const [accounts, matched, total] = await Promise.all([
    db.account.findMany({ where: query.where, orderBy: query.orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { contacts: true, opportunities: true } } } }),
    db.account.count({ where: query.where }),
    db.account.count(),
  ]);
  const th = { base: "/accounts", params, sort: query.sort };

  return (
    <>
      <PageHeader
        title="Компании"
        subtitle={<ResultsSummary shown={matched} total={total} filtered={query.filtered} />}
        actions={
          <>
            <ExportLink entity="accounts" params={params} />
            <LinkButton href="/accounts/new">Создать компанию</LinkButton>
          </>
        }
      />
      <Card>
        <FilterBar action="/accounts">
          <SearchInput defaultValue={query.q} placeholder="Название, город, отрасль" />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Название" field="name" {...th} />
                <th className="hide-sm">Отрасль</th>
                <SortTh label="Город" field="city" className="hide-sm" {...th} />
                <th className="num">Контактов</th>
                <th className="num">Сделок</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">{query.filtered ? "Ничего не найдено по заданным условиям." : "Компаний пока нет."}</td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/accounts/${a.id}`} className="row-link">{a.name}</Link></td>
                  <td className="hide-sm">{a.industry ?? "—"}</td>
                  <td className="hide-sm">{a.city ?? "—"}</td>
                  <td className="num">{a._count.contacts}</td>
                  <td className="num">{a._count.opportunities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={matched} pageSize={PAGE_SIZE} base="/accounts" params={params} />
      </Card>
    </>
  );
}
