import { PipelineBoard, type BoardColumn } from "@/components/pipeline-board";
import { QuickDealForm } from "@/components/quick-deal-form";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { formatMoney, stageColors } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [stages, accounts] = await Promise.all([
    db.stage.findMany({
      orderBy: { position: "asc" },
      include: {
        opportunities: { orderBy: { createdAt: "desc" }, include: { account: true, contact: true } },
      },
    }),
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const stageOptions = stages.map((s) => ({ id: s.id, code: s.code, name: s.name }));
  const totalOpen = stages.filter((s) => !s.isClosed).reduce((sum, s) => sum + s.opportunities.reduce((x, o) => x + Number(o.amount ?? 0), 0), 0);
  // Только простые данные: клиентский компонент получает готовую структуру.
  const columns: BoardColumn[] = stages.map((stage) => ({
    id: stage.id,
    code: stage.code,
    name: stage.name,
    color: stageColors[stage.code] ?? "var(--teal)",
    deals: stage.opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      account: o.account.name,
      contact: o.contact ? `${o.contact.lastName} ${o.contact.firstName}` : null,
      amount: o.amount === null ? null : Number(o.amount.toString()),
      status: o.status,
      eventDate: o.eventDate ? o.eventDate.toISOString() : null,
    })),
  }));
  const dealsCount = stages.reduce((n, s) => n + s.opportunities.length, 0);

  return (
    <>
      <PageHeader title="Воронка" subtitle={`Сделок: ${dealsCount} · в работе на сумму ${formatMoney(totalOpen)}`} />
      <Card title="Быстрое создание сделки">
        <details>
          <summary className="btn btn-primary" style={{ listStyle: "none", cursor: "pointer" }}>
            + Новая сделка
          </summary>
          <div style={{ marginTop: 16 }}>
            {stages[0] ? <QuickDealForm accounts={accounts} firstStageId={stages[0].id} /> : <p className="muted">В воронке нет стадий.</p>}
          </div>
        </details>
      </Card>
      <PipelineBoard columns={columns} stages={stageOptions} />
    </>
  );
}
