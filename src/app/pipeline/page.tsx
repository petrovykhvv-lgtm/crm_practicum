import Link from "next/link";
import { QuickDealForm } from "@/components/quick-deal-form";
import { StageMover } from "@/components/stage-mover";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, formatMoney, opportunityStatusColors, opportunityStatusLabels, stageColors } from "@/lib/labels";

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
      <div className="kanban-board">
        {stages.map((stage) => {
          const sum = stage.opportunities.reduce((x, o) => x + Number(o.amount ?? 0), 0);
          return (
            <section key={stage.id} className="kanban-col" aria-label={stage.name}>
              <header className="kanban-head" style={{ ["--c" as string]: stageColors[stage.code] ?? "var(--teal)" }}>
                <span className="kanban-title">{stage.name}</span>
                <span className="muted">
                  {stage.opportunities.length} · {formatMoney(sum)}
                </span>
              </header>
              {stage.opportunities.length === 0 && <p className="muted" style={{ padding: "8px 4px" }}>Нет сделок</p>}
              {stage.opportunities.map((o) => (
                <article key={o.id} className="deal" style={{ ["--c" as string]: stageColors[stage.code] ?? "var(--teal)" }}>
                  <Link href={`/opportunities/${o.id}`} className="deal-title">
                    {o.title}
                  </Link>
                  <span className="muted">{o.account.name}</span>
                  {o.contact && <span className="muted">{o.contact.lastName} {o.contact.firstName}</span>}
                  <span className="deal-sum">{formatMoney(o.amount)}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <Badge color={opportunityStatusColors[o.status]}>{opportunityStatusLabels[o.status]}</Badge>
                    {o.eventDate && <span className="muted">{formatDate(o.eventDate)}</span>}
                  </span>
                  <StageMover opportunityId={o.id} currentStageId={stage.id} stages={stageOptions} compact />
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
