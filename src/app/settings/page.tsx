import type { Metadata } from "next";
import { ManagersPanel, ProbabilityForm, ReasonsPanel } from "@/components/settings-panels";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [managers, reasons, stages, usage] = await Promise.all([
    db.manager.findMany({ orderBy: { name: "asc" } }),
    db.lostReason.findMany({ orderBy: { position: "asc" } }),
    db.stage.findMany({ orderBy: { position: "asc" } }),
    db.opportunity.groupBy({ by: ["lostReasonId"], where: { lostReasonId: { not: null } }, _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.lostReasonId, u._count._all]));

  return (
    <>
      <PageHeader title="Настройки" subtitle="Справочники CRM: менеджеры, причины отказа и вероятности стадий воронки." />
      <Card title="Менеджеры" aside="ответственные за лиды, сделки и задачи">
        <ManagersPanel managers={managers.map((m) => ({ id: m.id, name: m.name, email: m.email, active: m.active }))} />
      </Card>
      <Card title="Причины отказа" aside="обязательны при переводе сделки в «Проиграна»">
        <ReasonsPanel reasons={reasons.map((r) => ({ id: r.id, name: r.name, requiresComment: r.requiresComment, used: used.get(r.id) ?? 0 }))} />
      </Card>
      <Card title="Вероятности стадий" aside="для прогноза выручки: сумма сделок × вероятность">
        <ProbabilityForm stages={stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability }))} />
      </Card>
    </>
  );
}
