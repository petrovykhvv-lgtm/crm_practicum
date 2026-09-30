import { formatDate } from "@/lib/labels";

type Item = { id: string; type: "note" | "task"; body: string; dueDate: Date | null; done: boolean; createdAt: Date };

export function ActivityList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="muted">Активностей пока нет.</p>;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return (
    <div>
      {items.map((a) => {
        const overdue = a.type === "task" && !a.done && a.dueDate !== null && a.dueDate < startOfToday;
        return (
          <div key={a.id} className={`activity${a.done ? " done" : ""}`}>
            <div className="body">{a.body}</div>
            <div className="muted">
              {a.type === "note" ? "Заметка" : a.done ? "Задача выполнена" : "Задача"} ·{" "}
              {a.type === "task" ? (
                <span className={overdue ? "overdue" : undefined}>срок {formatDate(a.dueDate)}{overdue ? " (просрочена)" : ""}</span>
              ) : (
                formatDate(a.createdAt)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
