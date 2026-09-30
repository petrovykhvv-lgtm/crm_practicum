import Link from "next/link";
import { FilterBar, ResultsSummary, SearchInput } from "@/components/filters";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { accountSearch, pickParam, type SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = pickParam(await searchParams, "q");
  const [accounts, total] = await Promise.all([
    db.account.findMany({
      where: accountSearch(q),
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true, opportunities: true } } },
    }),
    db.account.count(),
  ]);
  return (
    <>
      <PageHeader
        title="Компании"
        subtitle={<ResultsSummary shown={accounts.length} total={total} filtered={Boolean(q)} />}
        actions={<LinkButton href="/accounts/new">Создать компанию</LinkButton>}
      />
      <Card>
        <FilterBar action="/accounts">
          <SearchInput defaultValue={q} placeholder="Название, город, отрасль" />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Отрасль</th>
                <th>Город</th>
                <th className="num">Контактов</th>
                <th className="num">Сделок</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">{q ? "Ничего не найдено по заданным условиям." : "Компаний пока нет."}</td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/accounts/${a.id}`}>{a.name}</Link></td>
                  <td>{a.industry ?? "—"}</td>
                  <td>{a.city ?? "—"}</td>
                  <td className="num">{a._count.contacts}</td>
                  <td className="num">{a._count.opportunities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
