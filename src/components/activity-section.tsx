import type { ActivityTarget } from "@/lib/actions/activities";
import { ActivityList } from "./activity-list";
import { AddActivityForm } from "./add-activity-form";
import { Card } from "./ui";

type Item = Parameters<typeof ActivityList>[0]["items"][number];

/** Блок «Активности» карточки: форма быстрых действий и лента заметок и задач. */
export function ActivitySection({ kind, id, items }: { kind: ActivityTarget; id: string; items: Item[] }) {
  return (
    <Card title="Активности" aside={`${items.length}`}>
      <AddActivityForm kind={kind} id={id} />
      <ActivityList items={items} />
    </Card>
  );
}
