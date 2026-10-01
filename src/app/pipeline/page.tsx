import type { Metadata } from "next";
import { FilterBar } from "@/components/filters";
import { ManagerFilter } from "@/components/manager-filter";
import { PipelineBoard, type BoardColumn } from "@/components/pipeline-board";
import { QuickDealForm } from "@/components/quick-deal-form";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentManagerId, getManagers, resolveManagerFilter } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { formatDate, formatMoney, stageColors } from "@/lib/labels";
import { pickParam, type SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Воронка" };
export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const managerParam = pickParam(sp, "manager");
  const [managers, currentManagerId, managerFilter] = await Promise.all([getManagers(), getCurrentManagerId(), resolveManagerFilter(managerParam)]);
  const managerWhere = managerFilter ? { managerId: managerFilter.value } : {};

  const [stages, accounts, reasons] = await Promise.all([
    db.stage.findMany({
      orderBy: { position: "asc" },
      include: {
        opportunities: { where: managerWhere, orderBy: { createdAt: "desc" }, include: { account: true, contact: true, manager: { select: { name: true } } } },
      },
    }),
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.lostReason.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, requiresComment: true } }),
  ]);
  const stageOptions = stages.map((s) => ({ id: s.id, code: s.code, name: s.name }));
  const sumOf = (s: (typeof stages)[number]) => s.opportunities.reduce((x, o) => x + Number(o.amount ?? 0), 0);
  const totalOpen = stages.filter((s) => !s.isClosed).reduce((sum, s) => sum + sumOf(s), 0);
  const forecast = stages.filter((s) => !s.isClosed).reduce((sum, s) => sum + (sumOf(s) * s.probability) / 100, 0);

  // Только простые данные: клиентский компонент получает готовую структуру.
  const columns: BoardColumn[] = stages.map((stage) => ({
    id: stage.id,
    code: stage.code,
    name: stage.name,
    color: stageColors[stage.code] ?? "var(--teal)",
    probability: stage.probability,
    deals: stage.opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      account: o.account.name,
      contact: o.contact ? `${o.contact.lastName} ${o.contact.firstName}` : null,
      manager: o.manager?.name ?? null,
      amount: o.amount === null ? null : Number(o.amount.toString()),
      status: o.status,
      eventLabel: o.eventDate ? formatDate(o.eventDate) : null,
    })),
  }));
  const dealsCount = stages.reduce((n, s) => n + s.opportunities.length, 0);

  return (
    <>
      <PageHeader
        title="Воронка"
        subtitle={`Сделок: ${dealsCount} · в работе на сумму ${formatMoney(totalOpen)} · прогноз с учётом вероятностей ${formatMoney(forecast)}${managerFilter ? ` · ${managerFilter.label}` : ""}`}
      />
      <Card>
        <FilterBar action="/pipeline">
          <ManagerFilter value={managerParam} managers={managers} hasCurrent={!!currentManagerId} />
        </FilterBar>
      </Card>
      <Card title="Быстрое создание сделки">
        <details>
          <summary className="btn btn-primary" style={{ listStyle: "none", cursor: "pointer" }}>
            + Новая сделка
          </summary>
          <div style={{ marginTop: 16 }}>
            {stages[0] ? <QuickDealForm accounts={accounts} firstStageId={stages[0].id} managerId={currentManagerId ?? undefined} /> : <p className="muted">В воронке нет стадий.</p>}
          </div>
        </details>
      </Card>
      <PipelineBoard columns={columns} stages={stageOptions} reasons={reasons} />
    </>
  );
}
