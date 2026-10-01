import { db } from "@/lib/db";

export type DuplicateHit = { kind: "lead" | "contact" | "account"; label: string; href: string };

/**
 * Возможные дубли при создании лида: лид или контакт с тем же email, компания с тем же названием.
 * Сравнение без учёта регистра. Возвращает до 5 совпадений.
 */
export async function findLeadDuplicates(input: { email: string | null; company: string | null }, excludeLeadId?: string): Promise<DuplicateHit[]> {
  const hits: DuplicateHit[] = [];
  const email = input.email?.trim();
  const company = input.company?.trim();

  if (email) {
    const [leads, contacts] = await Promise.all([
      db.lead.findMany({ where: { email: { equals: email, mode: "insensitive" }, ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}) }, select: { id: true, name: true }, take: 3 }),
      db.contact.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, firstName: true, lastName: true }, take: 3 }),
    ]);
    hits.push(...leads.map((l) => ({ kind: "lead" as const, label: `Лид «${l.name}» с тем же email`, href: `/leads/${l.id}` })));
    hits.push(...contacts.map((c) => ({ kind: "contact" as const, label: `Контакт «${c.firstName} ${c.lastName}» с тем же email`, href: `/contacts/${c.id}` })));
  }
  if (company) {
    const accounts = await db.account.findMany({ where: { name: { equals: company, mode: "insensitive" } }, select: { id: true, name: true }, take: 2 });
    hits.push(...accounts.map((a) => ({ kind: "account" as const, label: `Компания «${a.name}» уже есть в базе`, href: `/accounts/${a.id}` })));
  }
  return hits.slice(0, 5);
}
