import Link from "next/link";
import { FunnelChart, TrendChart } from "@/components/dashboard-charts";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PeriodControls } from "@/components/period-controls";
import { STUCK_DAYS, getDashboardData } from "@/lib/dashboard";
import { STEP_LABELS, resolvePeriod } from "@/lib/period";
import { pickParam, type SearchParams } from "@/lib/search";
import { formatDate, formatMoney, leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Kpi = { label: string; value: string; hint?: string; color: string; icon: string; alert?: boolean; href?: string };

function KpiCard({ kpi }: { kpi: Kpi }) {
  const body = (
    <>
      <div className="ico" style={{ ["--c" as string]: kpi.color }} aria-hidden>
        {kpi.icon}
      </div>
      <div className="v" style={kpi.alert ? { color: "var(--danger)" } : undefined}>
        {kpi.value}
      </div>
      <div className="l">{kpi.label}</div>
      {kpi.hint && <div className="hint">{kpi.hint}</div>}
    </>
  );
  return kpi.href ? (
    <Link href={kpi.href} className="glass kpi kpi-card">
      {body}
    </Link>
  ) : (
    <div className="glass kpi kpi-card">{body}</div>
  );
}

function Share({ label, count, total, color, sum }: { label: React.ReactNode; count: number; total: number; color: string; sum: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="share">
      <div className="share-row">
        <span>{label}</span>
        <span>
          <b>{count}</b> <span className="muted">· {pct}%</span>
        </span>
      </div>
      <div className="share-bar" aria-hidden>
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="share-sum">{sum > 0 ? `бюджет ${formatMoney(sum)}` : "бюджет не указан"}</div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const requestedStep = pickParam(sp, "step") ?? "";
  const d = await getDashboardData(period);
  const { kpi } = d;

  const main: Kpi[] = [
    { label: "Всего лидов", value: String(kpi.totalLeads), hint: `за период: ${kpi.newLeadsPeriod}`, color: "var(--teal)", icon: "Л", href: "/leads" },
    { label: "Открытых сделок", value: String(kpi.openDeals), color: "var(--orange)", icon: "С", href: "/opportunities?status=open" },
    { label: "Сумма открытых сделок", value: formatMoney(kpi.openDealsSum), color: "var(--green)", icon: "₽", href: "/pipeline" },
    { label: "Просроченных задач", value: String(kpi.overdueTasks), hint: `на сегодня: ${kpi.todayTasks}`, color: "var(--danger)", icon: "!", alert: kpi.overdueTasks > 0 },
  ];
  const secondary: Kpi[] = [
    { label: "Конверсия лидов", value: `${kpi.conversionPct}%`, hint: "лиды периода", color: "var(--forest)", icon: "%" },
    { label: "Выиграно за период", value: formatMoney(kpi.wonSum), hint: `сделок: ${kpi.wonCount}`, color: "var(--green)", icon: "✓" },
    { label: "Win rate", value: kpi.winRatePct === null ? "—" : `${kpi.winRatePct}%`, hint: "закрыто за период", color: "var(--bronze-2)", icon: "★" },
  ];

  const totalStatus = d.leadStatuses.reduce((n, s) => n + s.count, 0);
  const totalSource = d.leadSources.reduce((n, s) => n + s.count, 0);

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle={`Данные из базы на ${d.generatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" })}. Обновляются при каждом открытии страницы.`}
      />

      <PeriodControls period={period} requestedStep={requestedStep} />

      <section className="kpi-row" aria-label="Ключевые показатели">
        {[...main, ...secondary].map((k) => (
          <KpiCard key={k.label} kpi={k} />
        ))}
      </section>

      <div className="funnel-layout">
        <Card title="Воронка продаж" aside="сейчас: объём денег, дошедший до этапа и дальше" className="card-fill">
          <FunnelChart
            labels={d.funnel.map((f) => f.name)}
            sums={d.funnel.map((f) => f.sum)}
            counts={d.funnel.map((f) => f.count)}
            colors={d.funnel.map((f) => f.color)}
            refusals={d.refusals}
          />
        </Card>
        <Card title="Динамика объёма по этапам" aside={`деньги, попавшие на этап · ${period.label} · ${STEP_LABELS[period.step]}${period.stepAuto ? " (авто)" : ""}`}>
          <div className="trend-grid">
            {d.trends.map((t) => (
              <TrendChart key={t.code} stepLabel={STEP_LABELS[period.step]} title={t.name} labels={d.trendLabels} values={t.values} counts={t.counts} color={t.color === "#E7C9A0" ? "#C99A52" : t.color === "#A9BFAF" ? "#7E9C88" : t.color} />
            ))}
          </div>
        </Card>
      </div>

      <div className="dash-row">
        <Card title="Сводка по статусам лидов" aside={`всего ${totalStatus} · ${formatMoney(d.leadStatuses.reduce((n, x) => n + x.budget, 0))}`} className="dash-card">
          <div className="card-scroll shares">
            {d.leadStatuses.map((s) => (
              <Share key={s.status} label={<Badge color={leadStatusColors[s.status]}>{leadStatusLabels[s.status]}</Badge>} count={s.count} total={totalStatus} color={s.color} sum={s.budget} />
            ))}
          </div>
        </Card>
        <Card title="Сводка по источникам лидов" aside={`всего ${totalSource} · ${formatMoney(d.leadSources.reduce((n, x) => n + x.budget, 0))}`} className="dash-card">
          <div className="card-scroll shares">
            {d.leadSources.map((s) => (
              <Share key={s.source} label={<span>{leadSourceLabels[s.source]} <span className="muted">({s.source})</span></span>} count={s.count} total={totalSource} color="var(--bronze-1)" sum={s.budget} />
            ))}
          </div>
        </Card>

        <Card title="Recent Leads · новые лиды" aside={<Link href="/leads">все лиды</Link>} className="dash-card">
          {d.recentLeads.length === 0 ? (
            <p className="muted card-scroll">Лидов пока нет.</p>
          ) : (
            <div className="list card-scroll">
              {d.recentLeads.map((l) => (
                <div className="list-item attention" key={l.id}>
                  <span className="attention-head">
                    <Link href={`/leads/${l.id}`}>{l.name}</Link>
                    <b className="attention-sum">{l.budget ? formatMoney(l.budget) : "без бюджета"}</b>
                  </span>
                  <span className="muted">{leadSourceLabels[l.source]} · {formatDate(l.createdAt)}</span>
                  <Badge color={leadStatusColors[l.status]}>{leadStatusLabels[l.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Сделки, требующие внимания" aside={`всего ${d.attentionCount} · по убыванию суммы`} className="dash-card">
          {d.attention.length === 0 ? (
            <p className="muted card-scroll">Все открытые сделки в порядке: просроченных задач нет, сделки менялись в последние {STUCK_DAYS} дней.</p>
          ) : (
            <div className="list card-scroll">
              {d.attention.map((o) => (
                <div className="list-item attention" key={o.id}>
                  <span className="attention-head">
                    <Link href={`/opportunities/${o.id}`}>{o.title}</Link>
                    <b className="attention-sum">{o.amount > 0 ? formatMoney(o.amount) : "без суммы"}</b>
                  </span>
                  <span className="muted">{o.account} · {o.stage}</span>
                  {o.overdueTasks.map((t) => (
                    <span key={t.id} className="overdue reason">
                      Просрочена задача: {t.body} ({formatDate(t.dueDate)})
                    </span>
                  ))}
                  {o.stuckDays !== null && <span className="muted reason">Без изменений {o.stuckDays} дн.</span>}
                </div>
              ))}
              {d.attentionCount > d.attention.length && <span className="muted">Показаны первые {d.attention.length} из {d.attentionCount}</span>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
