import { Prisma } from "@prisma/client";

export type SearchParams = Record<string, string | string[] | undefined>;

export function pickParam(sp: SearchParams, key: string): string | undefined {
  const raw = sp[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

/** Возвращает значение параметра, только если оно входит в список допустимых. */
export function pickEnum<T extends string>(sp: SearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = pickParam(sp, key);
  return allowed.find((a) => a === value);
}

/** Слова запроса: «иван орлов» → ["иван", "орлов"]. Каждое слово должно совпасть хотя бы с одним полем. */
function tokens(q?: string): string[] {
  return q ? q.split(/\s+/).filter(Boolean).slice(0, 6) : [];
}

const has = (term: string) => ({ contains: term, mode: Prisma.QueryMode.insensitive });

export function leadSearch(q?: string): Prisma.LeadWhereInput {
  return {
    AND: tokens(q).map((t) => ({ OR: [{ name: has(t) }, { company: has(t) }, { email: has(t) }, { phone: has(t) }] })),
  };
}

export function accountSearch(q?: string): Prisma.AccountWhereInput {
  return {
    AND: tokens(q).map((t) => ({ OR: [{ name: has(t) }, { city: has(t) }, { industry: has(t) }] })),
  };
}

export function contactSearch(q?: string): Prisma.ContactWhereInput {
  return {
    AND: tokens(q).map((t) => ({
      OR: [{ firstName: has(t) }, { lastName: has(t) }, { email: has(t) }, { position: has(t) }, { account: { name: has(t) } }],
    })),
  };
}

export function opportunitySearch(q?: string): Prisma.OpportunityWhereInput {
  return {
    AND: tokens(q).map((t) => ({
      OR: [
        { title: has(t) },
        { account: { name: has(t) } },
        { contact: { firstName: has(t) } },
        { contact: { lastName: has(t) } },
      ],
    })),
  };
}
