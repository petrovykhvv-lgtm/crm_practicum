import type { Metadata } from "next";
import Link from "next/link";
import { ActivityRow } from "@/components/activity-row";
import { toActivityRow } from "@/components/activity-list";
import { FilterBar, SearchInput } from "@/components/filters";
import { Card, PageHeader } from "@/components/ui";
import { ManagerFilter } from "@/components/manager-filter";
import { getCurrentManagerId, getManagers, resolveManagerFilter } from "@/lib/current-manager";
import { db } from "@/lib/db";
import { addDays, startOfDay } from "@/lib/tz";
import { pickEnum, pickParam, type SearchParams } from "@/lib/search";

export const metadata: Metadata = { title: "Задачи" };
export const dynamic = "force-dynamic";

const VIEWS = ["open", "overdue", "today", "upcoming", "done", "all"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = {
  open: "Невыполненные",
  overdue: "Просрочено",
  today: "Сегодня",
  upcoming: "Предстоящие",
  done: "Выполненные",
  all: "Все",
};
const EMPTY: Record<View, string> = {
  open: "Невыполненных задач нет.",
  overdue: "Просроченных задач нет. Отлично!",
  today: "На сегодня задач нет.",
  upcoming: "Предстоящих задач нет.",
  done: "Выполненных задач пока нет.",
  all: "Задач пока нет.",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const view: View = pickEnum(sp, "view", VIEWS) ?? "open";
  const q = pickParam(sp, "q");
  const managerParam = pickParam(sp, "manager");
  const [managers, currentManagerId, managerFilter] = await Promise.all([getManagers(), getCurrentManagerId(), resolveManagerFilter(managerParam)]);
  const assigneeWhere = managerFilter ? { assigneeId: managerFilter.value } : {};

  const startOfToday = startOfDay();
  const endOfToday = addDays(startOfToday, 1);
  const task = { type: "task" } as const;
  const open = { ...task, done: false } as const;

  const where = {
    open,
    overdue: { ...open, dueDate: { lt: startOfToday } },
    today: { ...open, dueDate: { gte: startOfToday, lt: endOfToday } },
    upcoming: { ...open, dueDate: { gte: endOfToday } },
    done: { ...task, done: true },
    all: task,
  } as const;

  const words = q ? q.split(/\s+/).filter(Boolean).slice(0, 6) : [];
  const textFilter = { AND: [...words.map((w) => ({ body: { contains: w, mode: "insensitive" as const } })), assigneeWhere] };

  const [counts, rows] = await Promise.all([
    Promise.all(VIEWS.map((v) => db.activity.count({ where: { AND: [where[v], textFilter] } }))),
    db.activity.findMany({
      where: { AND: [where[view], textFilter] },
      orderBy: view === "done" ? { completedAt: "desc" } : [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        opportunity: { select: { id: true, title: true } },
        lead: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ]);
  const countOf = Object.fromEntries(VIEWS.map((v, i) => [v, counts[i]])) as Record<View, number>;

  const href = (v: View) => {
    const p = new URLSearchParams();
    if (v !== "open") p.set("view", v);
    if (q) p.set("q", q);
    if (managerParam) p.set("manager", managerParam);
    const qs = p.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };

  return (
    <>
      <PageHeader title="Задачи" subtitle="Все задачи по сделкам, лидам, контактам и компаниям в одном списке." />
      <Card>
        <nav className="tabs" aria-label="Фильтр задач">
          {VIEWS.map((v) => (
            <Link key={v} href={href(v)} aria-current={v === view ? "page" : undefined} className={`tab${v === view ? " active" : ""}${v === "overdue" && countOf[v] > 0 ? " alert-tab" : ""}`}>
              {VIEW_LABELS[v]} <span className="tab-count">{countOf[v]}</span>
            </Link>
          ))}
        </nav>
        <FilterBar action="/tasks">
          <input type="hidden" name="view" value={view} />
          <SearchInput defaultValue={q} placeholder="Текст задачи" />
          <ManagerFilter value={managerParam} managers={managers} hasCurrent={!!currentManagerId} label="Исполнитель" />
        </FilterBar>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <p className="muted">{q ? "Ничего не найдено по заданным условиям." : EMPTY[view]}</p>
        ) : (
          rows.map((a) => {
            const target = a.opportunity
              ? { href: `/opportunities/${a.opportunity.id}`, label: a.opportunity.title }
              : a.lead
                ? { href: `/leads/${a.lead.id}`, label: a.lead.name }
                : a.contact
                  ? { href: `/contacts/${a.contact.id}`, label: `${a.contact.lastName} ${a.contact.firstName}` }
                  : a.account
                    ? { href: `/accounts/${a.account.id}`, label: a.account.name }
                    : null;
            return <ActivityRow key={a.id} row={toActivityRow(a, target)} managers={managers} />;
          })
        )}
        {rows.length === 200 && <p className="muted">Показаны первые 200 задач. Уточните поиск.</p>}
      </Card>
    </>
  );
}
