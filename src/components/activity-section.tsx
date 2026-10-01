import type { ActivityTarget } from "@/lib/actions/activities";
import { getCurrentManagerId, getManagers } from "@/lib/current-manager";
import { ActivityList } from "./activity-list";
import { AddActivityForm } from "./add-activity-form";
import { Card } from "./ui";

type Item = Parameters<typeof ActivityList>[0]["items"][number];

/** Блок «Активности» карточки: форма быстрых действий и лента заметок и задач. */
export async function ActivitySection({ kind, id, items }: { kind: ActivityTarget; id: string; items: Item[] }) {
  const [managers, currentManagerId] = await Promise.all([getManagers(), getCurrentManagerId()]);
  return (
    <Card title="Активности" aside={`${items.length}`}>
      <AddActivityForm kind={kind} id={id} managers={managers} defaultAssigneeId={currentManagerId ?? undefined} />
      <ActivityList items={items} managers={managers} />
    </Card>
  );
}
