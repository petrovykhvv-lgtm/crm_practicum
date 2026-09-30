import { z } from "zod";
import { EDITABLE_LEAD_STATUSES, LEAD_SOURCES, NEW_ACCOUNT } from "@/lib/labels";

const required = (label: string, max = 200) =>
  z
    .string({ error: `${label}: обязательное поле` })
    .trim()
    .min(1, `${label}: обязательное поле`)
    .max(max, `${label}: не более ${max} символов`);

const optional = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .max(max, `${label}: не более ${max} символов`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalEmail = optional("Email").refine((v) => v === null || z.email().safeParse(v).success, "Введите корректный email");

const optionalPhone = optional("Телефон", 40).refine(
  (v) => v === null || /^\+?[\d\s()\-]{6,}$/.test(v),
  "Введите корректный телефон, например +7 900 000-00-00",
);

const optionalUrl = optional("Сайт").refine((v) => {
  if (v === null) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}, "Введите адрес сайта с http:// или https://");

const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 99_999_999_999) {
        ctx.addIssue({ code: "custom", message: `${label}: введите неотрицательное число до 99 999 999 999` });
        return z.NEVER;
      }
      return n;
    });

const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : null;
      if (!d || Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: `${label}: введите корректную дату` });
        return z.NEVER;
      }
      return d;
    });

const requiredId = (label: string) => z.string({ error: `${label}: выберите значение` }).trim().min(1, `${label}: выберите значение`);
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

/* ---------- Лид ---------- */

/** Поля, доступные для редактирования у любого лида, включая конвертированного. */
export const leadBaseSchema = z.object({
  name: required("Имя", 120),
  company: optional("Компания", 200),
  email: optionalEmail,
  phone: optionalPhone,
  source: z.enum(LEAD_SOURCES, { error: "Источник: выберите значение" }),
  budget: optionalMoney("Бюджет"),
  venue: optional("Площадка"),
  deadline: optionalDate("Срок"),
  workFormat: optional("Формат работ"),
});

export const leadSchema = leadBaseSchema
  .extend({
    status: z.enum(EDITABLE_LEAD_STATUSES, { error: "Статус: выберите значение" }),
    disqualifyReason: optional("Причина отказа", 500),
  })
  .superRefine((lead, ctx) => {
    if (lead.status === "disqualified" && !lead.disqualifyReason) {
      ctx.addIssue({ code: "custom", path: ["disqualifyReason"], message: "Укажите причину отказа" });
    }
  });

/* ---------- Компания ---------- */

export const accountSchema = z.object({
  name: required("Название", 200),
  industry: optional("Отрасль"),
  website: optionalUrl,
  phone: optionalPhone,
  city: optional("Город", 100),
});

/* ---------- Контакт ---------- */

export const contactSchema = z.object({
  firstName: required("Имя", 100),
  lastName: required("Фамилия", 100),
  position: optional("Должность"),
  email: optionalEmail,
  phone: optionalPhone,
  accountId: requiredId("Компания"),
});

/* ---------- Сделка ---------- */

export const opportunitySchema = z.object({
  title: required("Название", 200),
  accountId: requiredId("Компания"),
  contactId: optionalId,
  stageId: requiredId("Стадия"),
  amount: optionalMoney("Сумма"),
  venue: optional("Площадка"),
  eventDate: optionalDate("Дата мероприятия"),
  lostReason: optional("Причина отказа", 500),
});

/* ---------- Конвертация лида ---------- */

export const convertLeadSchema = z
  .object({
    firstName: required("Имя", 100),
    lastName: required("Фамилия", 100),
    position: optional("Должность"),
    email: optionalEmail,
    phone: optionalPhone,
    /** "new" — создать компанию, иначе id существующей компании. */
    accountChoice: requiredId("Компания"),
    accountName: optional("Название компании", 200),
    createDeal: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    dealTitle: optional("Название сделки", 200),
    amount: optionalMoney("Сумма"),
    venue: optional("Площадка"),
    eventDate: optionalDate("Дата мероприятия"),
  })
  .superRefine((data, ctx) => {
    if (data.accountChoice === NEW_ACCOUNT && !data.accountName) {
      ctx.addIssue({ code: "custom", path: ["accountName"], message: "Название компании: обязательное поле" });
    }
    if (data.createDeal && !data.dealTitle) {
      ctx.addIssue({ code: "custom", path: ["dealTitle"], message: "Название сделки: обязательное поле" });
    }
  });

/* ---------- Активность ---------- */

export const activitySchema = z
  .object({
    type: z.enum(["note", "task"], { error: "Тип: выберите заметку или задачу" }),
    body: required("Текст", 2000),
    dueDate: optionalDate("Срок"),
  })
  .superRefine((a, ctx) => {
    if (a.type === "task" && !a.dueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Для задачи укажите срок выполнения" });
    }
  });
