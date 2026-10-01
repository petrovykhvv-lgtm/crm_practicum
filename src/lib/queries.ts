import type { Prisma } from "@prisma/client";
import { resolveManagerFilter } from "@/lib/current-manager";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/labels";
import { accountSearch, contactSearch, leadSearch, opportunitySearch, pickEnum, pickParam, type SearchParams } from "@/lib/search";
import { db } from "@/lib/db";

export const PAGE_SIZE = 25;
export type SortDir = "asc" | "desc";

export function pageOf(sp: SearchParams): number {
  const n = Number(pickParam(sp, "page"));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function sortOf<K extends string>(sp: SearchParams, allowed: readonly K[], defaultKey: K, defaultDir: SortDir): { key: K; dir: SortDir; isDefault: boolean } {
  const key = pickEnum(sp, "sort", allowed);
  const dirParam = pickEnum(sp, "dir", ["asc", "desc"] as const);
  return { key: key ?? defaultKey, dir: key ? (dirParam ?? "asc") : defaultDir, isDefault: !key };
}

/* ---------- Лиды ---------- */

export const LEAD_SORTS = ["name", "source", "status", "budget", "createdAt"] as const;

export async function leadQuery(sp: SearchParams) {
  const q = pickParam(sp, "q");
  const source = pickEnum(sp, "source", LEAD_SOURCES);
  const status = pickEnum(sp, "status", LEAD_STATUSES);
  const manager = await resolveManagerFilter(pickParam(sp, "manager"));
  const sort = sortOf(sp, LEAD_SORTS, "createdAt", "desc");
  const where: Prisma.LeadWhereInput = { AND: [leadSearch(q), source ? { source } : {}, status ? { status } : {}, manager ? { managerId: manager.value } : {}] };
  const orderBy: Prisma.LeadOrderByWithRelationInput = sort.key === "budget" ? { budget: { sort: sort.dir, nulls: "last" } } : { [sort.key]: sort.dir };
  return { where, orderBy, sort, filtered: Boolean(q || source || status || manager), q, source, status, manager, page: pageOf(sp) };
}

/* ---------- Сделки ---------- */

export const OPPORTUNITY_SORTS = ["title", "stage", "status", "amount", "eventDate", "createdAt"] as const;
const DEAL_STATUSES = ["open", "won", "lost"] as const;

export async function opportunityQuery(sp: SearchParams) {
  const stages = await db.stage.findMany({ orderBy: { position: "asc" } });
  const q = pickParam(sp, "q");
  const stageCode = pickEnum(sp, "stage", stages.map((s) => s.code));
  const status = pickEnum(sp, "status", DEAL_STATUSES);
  const manager = await resolveManagerFilter(pickParam(sp, "manager"));
  const sort = sortOf(sp, OPPORTUNITY_SORTS, "stage", "asc");
  const where: Prisma.OpportunityWhereInput = {
    AND: [opportunitySearch(q), stageCode ? { stage: { code: stageCode } } : {}, status ? { status } : {}, manager ? { managerId: manager.value } : {}],
  };
  const orderBy: Prisma.OpportunityOrderByWithRelationInput[] =
    sort.key === "stage"
      ? [{ stage: { position: sort.dir } }, { createdAt: "desc" }]
      : sort.key === "amount" || sort.key === "eventDate"
        ? [{ [sort.key]: { sort: sort.dir, nulls: "last" } }]
        : [{ [sort.key]: sort.dir }];
  return { where, orderBy, sort, stages, filtered: Boolean(q || stageCode || status || manager), q, stageCode, status, manager, page: pageOf(sp) };
}

/* ---------- Компании и контакты ---------- */

export const ACCOUNT_SORTS = ["name", "city", "createdAt"] as const;
export function accountQuery(sp: SearchParams) {
  const q = pickParam(sp, "q");
  const sort = sortOf(sp, ACCOUNT_SORTS, "name", "asc");
  return { where: accountSearch(q), orderBy: { [sort.key]: sort.dir } as Prisma.AccountOrderByWithRelationInput, sort, filtered: Boolean(q), q, page: pageOf(sp) };
}

export const CONTACT_SORTS = ["lastName", "position", "createdAt"] as const;
export function contactQuery(sp: SearchParams) {
  const q = pickParam(sp, "q");
  const sort = sortOf(sp, CONTACT_SORTS, "lastName", "asc");
  const orderBy: Prisma.ContactOrderByWithRelationInput[] = sort.key === "lastName" ? [{ lastName: sort.dir }, { firstName: sort.dir }] : [{ [sort.key]: sort.dir }];
  return { where: contactSearch(q), orderBy, sort, filtered: Boolean(q), q, page: pageOf(sp) };
}
