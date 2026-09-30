import Link from "next/link";
import { FilterBar, FilterSelect, ResultsSummary, SearchInput } from "@/components/filters";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { LEAD_SOURCES, LEAD_STATUSES, formatDate, formatMoney, leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/lib/labels";
import { leadSearch, pickEnum, pickParam, type SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = pickParam(sp, "q");
  const source = pickEnum(sp, "source", LEAD_SOURCES);
  const status = pickEnum(sp, "status", LEAD_STATUSES);
  const filtered = Boolean(q || source || status);

  const [leads, total] = await Promise.all([
    db.lead.findMany({
      where: { AND: [leadSearch(q), source ? { source } : {}, status ? { status } : {}] },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.count(),
  ]);
  return (
    <>
      <PageHeader
        title="Лиды"
        subtitle={<ResultsSummary shown={leads.length} total={total} filtered={filtered} />}
        actions={<LinkButton href="/leads/new">Создать лида</LinkButton>}
      />
      <Card>
        <FilterBar action="/leads">
          <SearchInput defaultValue={q} placeholder="Имя, компания, email, телефон" />
          <FilterSelect name="source" label="Источник" defaultValue={source} options={LEAD_SOURCES.map((v) => ({ value: v, label: leadSourceLabels[v] }))} />
          <FilterSelect name="status" label="Статус" defaultValue={status} options={LEAD_STATUSES.map((v) => ({ value: v, label: leadStatusLabels[v] }))} />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Лид</th>
                <th>Компания</th>
                <th>Источник</th>
                <th>Статус</th>
                <th className="num">Бюджет</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">{filtered ? "Ничего не найдено по заданным условиям." : "Лидов пока нет. Создайте первого."}</td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/leads/${l.id}`}>{l.name}</Link></td>
                  <td>{l.company ?? "—"}</td>
                  <td>{leadSourceLabels[l.source]}</td>
                  <td><Badge color={leadStatusColors[l.status]}>{leadStatusLabels[l.status]}</Badge></td>
                  <td className="num">{formatMoney(l.budget)}</td>
                  <td>{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
