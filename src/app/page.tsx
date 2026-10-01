import type { Metadata } from "next";
import Link from "next/link";
import { FunnelChart, TrendChart } from "@/components/dashboard-charts";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PeriodControls } from "@/components/period-controls";
import { getCurrentManagerId, getManagers, resolveManagerFilter } from "@/lib/current-manager";
import { STUCK_DAYS, getDashboardData } from "@/lib/dashboard";
import { STEP_LABELS, resolvePeriod } from "@/lib/period";
import { pickParam, type SearchParams } from "@/lib/search";
import { formatDate, formatMoney, leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/lib/labels";

export const metadata: Metadata = { title: { absolute: "Дашборд — CRM-lite" } };

export const dynamic = "force-dynamic";

type Kpi = { label: string; value: string; hint?: string; color: string; icon: IconName; alert?: boolean; href?: string };

type IconName = "users" | "briefcase" | "ruble" | "alert" | "percent" | "check" | "target";

const ICONS: Record<IconName, React.ReactNode> = {
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  ruble: (
    <>
      <path d="M8 21V4h6a4.5 4.5 0 0 1 0 9H6" />
      <path d="M6 17h8" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  const body = (
    <>
      <div className="ico" style={{ ["--c" as string]: kpi.color }} aria-hidden>
        <svg viewBox="0 0 24 24">{ICONS[kpi.icon]}</svg>
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
  const managerParam = pickParam(sp, "manager");
  const [managers, currentManagerId, managerFilter] = await Promise.all([getManagers(), getCurrentManagerId(), resolveManagerFilter(managerParam)]);
  const d = await getDashboardData(period, managerFilter ? { value: managerFilter.value } : null);
  const { kpi } = d;

  const main: Kpi[] = [
    { label: "Всего лидов", value: String(kpi.totalLeads), hint: `за период: ${kpi.newLeadsPeriod}`, color: "var(--teal)", icon: "users", href: "/leads" },
    { label: "Открытых сделок", value: String(kpi.openDeals), color: "var(--orange)", icon: "briefcase", href: "/opportunities?status=open" },
    { label: "Сумма открытых сделок", value: formatMoney(kpi.openDealsSum), hint: `прогноз: ${formatMoney(kpi.forecast)}`, color: "var(--green)", icon: "ruble", href: "/pipeline" },
    { label: "Просроченных задач", value: String(kpi.overdueTasks), hint: `на сегодня: ${kpi.todayTasks}`, color: "var(--danger)", icon: "alert", alert: kpi.overdueTasks > 0, href: "/tasks?view=overdue" },
  ];
  const secondary: Kpi[] = [
    { label: "Конверсия лидов", value: `${kpi.conversionPct}%`, hint: "лиды периода", color: "var(--forest)", icon: "percent" },
    { label: "Выиграно за период", value: formatMoney(kpi.wonSum), hint: `сделок: ${kpi.wonCount}`, color: "var(--green)", icon: "check" },
    { label: "Доля выигранных", value: kpi.winRatePct === null ? "—" : `${kpi.winRatePct}%`, hint: "закрыто за период", color: "var(--bronze-2)", icon: "target" },
  ];

  const totalStatus = d.leadStatuses.reduce((n, s) => n + s.count, 0);
  const totalSource = d.leadSources.reduce((n, s) => n + s.count, 0);

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle={`${managerFilter ? `Ответственный: ${managerFilter.label}. ` : ""}Данные из базы на ${d.generatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" })}. Обновляются при каждом открытии страницы.`}
      />

      <PeriodControls period={period} requestedStep={requestedStep} managers={managers} hasCurrent={!!currentManagerId} manager={managerParam} />

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

        <Card title="Новые лиды" aside={<Link href="/leads">все лиды</Link>} className="dash-card">
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

      <Card title="Почему теряем сделки" aside={`проигранные ${period.label}`}>
        {d.lostByReason.length === 0 ? (
          <p className="muted">За выбранный период проигранных сделок нет.</p>
        ) : (
          <div className="shares">
            {d.lostByReason.map((r) => {
              const max = Math.max(...d.lostByReason.map((x) => x.sum), 1);
              return (
                <div className="share" key={r.name}>
                  <div className="share-row">
                    <span>{r.name}</span>
                    <span>
                      <b>{r.sum > 0 ? formatMoney(r.sum) : "без суммы"}</b> <span className="muted">· сделок: {r.count}</span>
                    </span>
                  </div>
                  <div className="share-bar" aria-hidden>
                    <span style={{ width: `${Math.round((r.sum / max) * 100)}%`, background: "var(--stage-lost)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
