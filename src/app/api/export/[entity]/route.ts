import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { formatDate, leadSourceLabels, leadStatusLabels, opportunityStatusLabels } from "@/lib/labels";
import { accountQuery, contactQuery, leadQuery, opportunityQuery } from "@/lib/queries";
import { formatYmd } from "@/lib/tz";

export const dynamic = "force-dynamic";

const LIMIT = 10_000;
const num = (v: { toString(): string } | null) => (v === null ? "" : String(Number(v.toString())));

/** Экспорт списка в CSV с теми же фильтрами и сортировкой, что и на странице. Excel: разделитель `;`, UTF-8 с BOM. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const sp: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => {
    sp[k] = v;
  });

  let header: string[];
  let rows: unknown[][];

  switch (entity) {
    case "leads": {
      const q = await leadQuery(sp);
      const items = await db.lead.findMany({ where: q.where, orderBy: q.orderBy, take: LIMIT, include: { manager: { select: { name: true } } } });
      header = ["ID", "Имя", "Компания", "Email", "Телефон", "Источник", "Статус", "Бюджет", "Площадка", "Срок", "Формат работ", "Ответственный", "Создан"];
      rows = items.map((l) => [l.id, l.name, l.company, l.email, l.phone, leadSourceLabels[l.source], leadStatusLabels[l.status], num(l.budget), l.venue, l.deadline ? formatDate(l.deadline) : "", l.workFormat, l.manager?.name, formatDate(l.createdAt)]);
      break;
    }
    case "opportunities": {
      const q = await opportunityQuery(sp);
      const items = await db.opportunity.findMany({
        where: q.where,
        orderBy: q.orderBy,
        take: LIMIT,
        include: { account: true, contact: true, stage: true, manager: { select: { name: true } }, lostReasonRef: true },
      });
      header = ["ID", "Название", "Компания", "Контакт", "Стадия", "Статус", "Сумма", "Площадка", "Мероприятие", "Ответственный", "Причина отказа", "Комментарий к отказу", "Создана", "Закрыта"];
      rows = items.map((o) => [
        o.id,
        o.title,
        o.account.name,
        o.contact ? `${o.contact.lastName} ${o.contact.firstName}` : "",
        o.stage.name,
        opportunityStatusLabels[o.status],
        num(o.amount),
        o.venue,
        o.eventDate ? formatDate(o.eventDate) : "",
        o.manager?.name,
        o.lostReasonRef?.name,
        o.lostReason,
        formatDate(o.createdAt),
        o.closedAt ? formatDate(o.closedAt) : "",
      ]);
      break;
    }
    case "accounts": {
      const q = accountQuery(sp);
      const items = await db.account.findMany({ where: q.where, orderBy: q.orderBy, take: LIMIT, include: { _count: { select: { contacts: true, opportunities: true } } } });
      header = ["ID", "Название", "Отрасль", "Город", "Телефон", "Сайт", "Контактов", "Сделок", "Создана"];
      rows = items.map((a) => [a.id, a.name, a.industry, a.city, a.phone, a.website, a._count.contacts, a._count.opportunities, formatDate(a.createdAt)]);
      break;
    }
    case "contacts": {
      const q = contactQuery(sp);
      const items = await db.contact.findMany({ where: q.where, orderBy: q.orderBy, take: LIMIT, include: { account: true } });
      header = ["ID", "Фамилия", "Имя", "Должность", "Компания", "Email", "Телефон", "Создан"];
      rows = items.map((c) => [c.id, c.lastName, c.firstName, c.position, c.account.name, c.email, c.phone, formatDate(c.createdAt)]);
      break;
    }
    case "leads-template":
      header = ["Имя", "Компания", "Email", "Телефон", "Источник", "Бюджет", "Площадка", "Формат работ", "Ответственный"];
      rows = [["Иван Петров", "ООО Пример", "ivan@example.com", "+7 900 000-00-00", "Сайт", "1500000", "Крокус Экспо", "Стенд под ключ", ""]];
      break;
    default:
      return new Response("Неизвестный тип экспорта", { status: 404 });
  }

  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-${formatYmd(new Date())}.csv"`,
    },
  });
}
