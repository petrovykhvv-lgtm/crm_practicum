import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterSelect, ResultsSummary, SearchInput } from "@/components/filters";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, formatMoney, opportunityStatusColors, opportunityStatusLabels, stageColors } from "@/lib/labels";
import { opportunitySearch, pickEnum, pickParam, type SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Сделки" };

export const dynamic = "force-dynamic";

const STATUSES = ["open", "won", "lost"] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const stages = await db.stage.findMany({ orderBy: { position: "asc" } });
  const q = pickParam(sp, "q");
  const stageCode = pickEnum(sp, "stage", stages.map((s) => s.code));
  const status = pickEnum(sp, "status", STATUSES);
  const filtered = Boolean(q || stageCode || status);

  const [deals, total] = await Promise.all([
    db.opportunity.findMany({
      where: { AND: [opportunitySearch(q), stageCode ? { stage: { code: stageCode } } : {}, status ? { status } : {}] },
      orderBy: [{ stage: { position: "asc" } }, { createdAt: "desc" }],
      include: { account: true, stage: true },
    }),
    db.opportunity.count(),
  ]);
  return (
    <>
      <PageHeader
        title="Сделки"
        subtitle={<ResultsSummary shown={deals.length} total={total} filtered={filtered} />}
        actions={<LinkButton href="/opportunities/new">Создать сделку</LinkButton>}
      />
      <Card>
        <FilterBar action="/opportunities">
          <SearchInput defaultValue={q} placeholder="Название сделки, компания, контакт" />
          <FilterSelect name="stage" label="Стадия" defaultValue={stageCode} options={stages.map((s) => ({ value: s.code, label: s.name }))} />
          <FilterSelect name="status" label="Статус" defaultValue={status} options={STATUSES.map((v) => ({ value: v, label: opportunityStatusLabels[v] }))} />
        </FilterBar>
      </Card>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Сделка</th>
                <th className="hide-sm">Компания</th>
                <th>Стадия</th>
                <th className="hide-sm">Статус</th>
                <th className="num">Сумма</th>
                <th className="hide-sm">Мероприятие</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">{filtered ? "Ничего не найдено по заданным условиям." : "Сделок пока нет."}</td>
                </tr>
              )}
              {deals.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/opportunities/${o.id}`}>{o.title}</Link></td>
                  <td className="hide-sm"><Link href={`/accounts/${o.accountId}`}>{o.account.name}</Link></td>
                  <td><Badge color={stageColors[o.stage.code] ?? "var(--teal)"}>{o.stage.name}</Badge></td>
                  <td className="hide-sm"><Badge color={opportunityStatusColors[o.status]}>{opportunityStatusLabels[o.status]}</Badge></td>
                  <td className="num">{formatMoney(o.amount)}</td>
                  <td className="hide-sm">{formatDate(o.eventDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
