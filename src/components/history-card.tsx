import { db } from "@/lib/db";
import { FIELD_LABELS, type EntityType, type FieldChange } from "@/lib/audit";
import { formatDateTimeRu } from "@/lib/tz";
import { Card } from "./ui";

/** Журнал изменений карточки: кто, когда и что изменил. Записи переживают удаление связанных данных. */
export async function HistoryCard({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const logs = await db.auditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <Card title="История изменений" aside={`${logs.length}`}>
      {logs.length === 0 ? (
        <p className="muted">Изменений пока не записано.</p>
      ) : (
        <div className="history">
          {logs.map((l) => {
            const changes = (l.changes as FieldChange[] | null) ?? [];
            return (
              <div key={l.id} className="history-item">
                <div>{l.summary}</div>
                {changes.length > 0 && (
                  <ul className="history-changes">
                    {changes.map((c) => (
                      <li key={c.field}>
                        <span className="muted">{FIELD_LABELS[entityType][c.field] ?? c.field}:</span> {c.from ?? "—"} → <b>{c.to ?? "—"}</b>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="muted">
                  {formatDateTimeRu(l.createdAt)}
                  {l.actorName ? ` · ${l.actorName}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
