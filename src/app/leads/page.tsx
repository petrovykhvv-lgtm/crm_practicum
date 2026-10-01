import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterSelect, ResultsSummary, SearchInput } from "@/components/filters";
import { ExportLink, Pagination, SortTh, flatParams } from "@/components/list-controls";
import { ManagerFilter } from "@/components/manager-filter";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { getCurrentManagerId, getManagers } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { LEAD_SOURCES, LEAD_STATUSES, formatDate, formatMoney, leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/lib/labels";
import { PAGE_SIZE, leadQuery } from "@/lib/queries";
import type { SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Лиды" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = await leadQuery(sp);
  const params = flatParams(sp);
  const [managers, currentManagerId] = await Promise.all([getManagers(), getCurrentManagerId()]);

  const page = query.page;
  const [leads, matched, total] = await Promise.all([
    db.lead.findMany({ where: query.where, orderBy: query.orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { manager: { select: { name: true } } } }),
    db.lead.count({ where: query.where }),
    db.lead.count(),
  ]);
  const th = { base: "/leads", params, sort: query.sort };

  return (
    <>
      <PageHeader
        title="Лиды"
        subtitle={<ResultsSummary shown={matched} total={total} filtered={query.filtered} />}
        actions={
          <>
            <ExportLink entity="leads" params={params} />
            <LinkButton href="/leads/import" ghost>Импорт CSV</LinkButton>
            <LinkButton href="/leads/new">Создать лида</LinkButton>
          </>
        }
      />
      <Card>
        <FilterBar action="/leads">
          <SearchInput defaultValue={query.q} placeholder="Имя, компания, email, телефон" />
          <FilterSelect name="source" label="Источник" defaultValue={query.source} options={LEAD_SOURCES.map((v) => ({ value: v, label: leadSourceLabels[v] }))} />
          <FilterSelect name="status" label="Статус" defaultValue={query.status} options={LEAD_STATUSES.map((v) => ({ value: v, label: leadStatusLabels[v] }))} />
          <ManagerFilter value={params.manager} managers={managers} hasCurrent={!!currentManagerId} />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Лид" field="name" {...th} />
                <th className="hide-sm">Компания</th>
                <SortTh label="Источник" field="source" className="hide-sm" {...th} />
                <SortTh label="Статус" field="status" {...th} />
                <th className="hide-sm">Ответственный</th>
                <SortTh label="Бюджет" field="budget" className="num" {...th} />
                <SortTh label="Создан" field="createdAt" className="hide-sm" {...th} />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">{query.filtered ? "Ничего не найдено по заданным условиям." : "Лидов пока нет. Создайте первого или импортируйте CSV."}</td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/leads/${l.id}`} className="row-link">{l.name}</Link></td>
                  <td className="hide-sm">{l.company ?? "—"}</td>
                  <td className="hide-sm">{leadSourceLabels[l.source]}</td>
                  <td><Badge color={leadStatusColors[l.status]}>{leadStatusLabels[l.status]}</Badge></td>
                  <td className="hide-sm">{l.manager?.name ?? "—"}</td>
                  <td className="num">{formatMoney(l.budget)}</td>
                  <td className="hide-sm">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={matched} pageSize={PAGE_SIZE} base="/leads" params={params} />
      </Card>
    </>
  );
}
