import { formatDate, toDateInput } from "@/lib/labels";
import { ActivityRow, type ActivityRowData } from "./activity-row";

type Item = { id: string; type: "note" | "task"; body: string; dueDate: Date | null; done: boolean; createdAt: Date };

/** Подготавливает данные строки: все даты и признаки считаются на сервере. */
export function toActivityRow(a: Item, target?: ActivityRowData["target"]): ActivityRowData {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const open = a.type === "task" && !a.done && a.dueDate !== null;
  return {
    id: a.id,
    type: a.type,
    body: a.body,
    done: a.done,
    dueLabel: a.dueDate ? formatDate(a.dueDate) : null,
    dueInput: toDateInput(a.dueDate),
    createdLabel: formatDate(a.createdAt),
    overdue: open && a.dueDate! < startOfToday,
    today: open && a.dueDate! >= startOfToday && a.dueDate! < endOfToday,
    target: target ?? null,
  };
}

export function ActivityList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="muted">Активностей пока нет.</p>;

  // Сначала невыполненные задачи по сроку, затем остальное от новых к старым.
  const openTasks = items.filter((a) => a.type === "task" && !a.done).sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const rest = items.filter((a) => !(a.type === "task" && !a.done)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div>
      {[...openTasks, ...rest].map((a) => (
        <ActivityRow key={a.id} row={toActivityRow(a)} />
      ))}
    </div>
  );
}
