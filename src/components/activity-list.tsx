import { formatDate } from "@/lib/labels";
import { TaskToggle } from "./task-toggle";

type Item = { id: string; type: "note" | "task"; body: string; dueDate: Date | null; done: boolean; createdAt: Date };

export function ActivityList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="muted">Активностей пока нет.</p>;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  // Сначала невыполненные задачи по сроку, затем остальное от новых к старым.
  const openTasks = items.filter((a) => a.type === "task" && !a.done).sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const rest = items.filter((a) => !(a.type === "task" && !a.done)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div>
      {[...openTasks, ...rest].map((a) => {
        const overdue = a.type === "task" && !a.done && a.dueDate !== null && a.dueDate < startOfToday;
        const today = a.type === "task" && !a.done && a.dueDate !== null && a.dueDate >= startOfToday && a.dueDate < endOfToday;
        return (
          <div key={a.id} className={`activity${a.done ? " done" : ""}`} style={{ gridTemplateColumns: a.type === "task" ? "auto 1fr" : "1fr", columnGap: 12 }}>
            {a.type === "task" && <TaskToggle id={a.id} done={a.done} />}
            <div>
              <div className="body">{a.body}</div>
              <div className="muted">
                {a.type === "note" ? "Заметка" : a.done ? "Задача выполнена" : "Задача"} ·{" "}
                {a.type === "task" ? (
                  <span className={overdue ? "overdue" : undefined}>
                    срок {formatDate(a.dueDate)}
                    {overdue ? " (просрочена)" : today ? " (сегодня)" : ""}
                  </span>
                ) : (
                  formatDate(a.createdAt)
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
