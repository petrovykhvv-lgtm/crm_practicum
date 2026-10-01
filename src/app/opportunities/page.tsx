import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterSelect, ResultsSummary, SearchInput } from "@/components/filters";
import { ExportLink, Pagination, SortTh, flatParams } from "@/components/list-controls";
import { ManagerFilter } from "@/components/manager-filter";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { getCurrentManagerId, getManagers } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { formatDate, formatMoney, opportunityStatusColors, opportunityStatusLabels, stageColors } from "@/lib/labels";
import { PAGE_SIZE, opportunityQuery } from "@/lib/queries";
import type { SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Сделки" };
export const dynamic = "force-dynamic";

const STATUSES = ["open", "won", "lost"] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = await opportunityQuery(sp);
  const params = flatParams(sp);
  const [managers, currentManagerId] = await Promise.all([getManagers(), getCurrentManagerId()]);

  const page = query.page;
  const [deals, matched, total] = await Promise.all([
    db.opportunity.findMany({
      where: query.where,
      orderBy: query.orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { account: true, stage: true, manager: { select: { name: true } } },
    }),
    db.opportunity.count({ where: query.where }),
    db.opportunity.count(),
  ]);
  const th = { base: "/opportunities", params, sort: query.sort };

  return (
    <>
      <PageHeader
        title="Сделки"
        subtitle={<ResultsSummary shown={matched} total={total} filtered={query.filtered} />}
        actions={
          <>
            <ExportLink entity="opportunities" params={params} />
            <LinkButton href="/opportunities/new">Создать сделку</LinkButton>
          </>
        }
      />
      <Card>
        <FilterBar action="/opportunities">
          <SearchInput defaultValue={query.q} placeholder="Название сделки, компания, контакт" />
          <FilterSelect name="stage" label="Стадия" defaultValue={query.stageCode} options={query.stages.map((s) => ({ value: s.code, label: s.name }))} />
          <FilterSelect name="status" label="Статус" defaultValue={query.status} options={STATUSES.map((v) => ({ value: v, label: opportunityStatusLabels[v] }))} />
          <ManagerFilter value={params.manager} managers={managers} hasCurrent={!!currentManagerId} />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Сделка" field="title" {...th} />
                <th className="hide-sm">Компания</th>
                <SortTh label="Стадия" field="stage" {...th} />
                <SortTh label="Статус" field="status" className="hide-sm" {...th} />
                <th className="hide-sm">Ответственный</th>
                <SortTh label="Сумма" field="amount" className="num" {...th} />
                <SortTh label="Мероприятие" field="eventDate" className="hide-sm" {...th} />
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">{query.filtered ? "Ничего не найдено по заданным условиям." : "Сделок пока нет."}</td>
                </tr>
              )}
              {deals.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/opportunities/${o.id}`} className="row-link">{o.title}</Link></td>
                  <td className="hide-sm"><Link href={`/accounts/${o.accountId}`}>{o.account.name}</Link></td>
                  <td><Badge color={stageColors[o.stage.code] ?? "var(--teal)"}>{o.stage.name}</Badge></td>
                  <td className="hide-sm"><Badge color={opportunityStatusColors[o.status]}>{opportunityStatusLabels[o.status]}</Badge></td>
                  <td className="hide-sm">{o.manager?.name ?? "—"}</td>
                  <td className="num">{formatMoney(o.amount)}</td>
                  <td className="hide-sm">{formatDate(o.eventDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={matched} pageSize={PAGE_SIZE} base="/opportunities" params={params} />
      </Card>
    </>
  );
}
