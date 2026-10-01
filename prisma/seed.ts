import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "../src/lib/tz";

const prisma = new PrismaClient();

// Даты считаются от начала сегодняшнего дня в часовом поясе приложения (APP_TIMEZONE),
// поэтому «просрочено» и «на сегодня» получаются одинаково при любом запуске.
const startOfToday = startOfDay();
const at = (days: number, hour = 12) => new Date(addDays(startOfToday, days).getTime() + hour * 60 * 60 * 1000);

// Ожидаемое содержимое базы после seed. Расхождение считается ошибкой.
const EXPECTED = { leads: 6, accounts: 4, contacts: 5, opportunities: 6, activities: 8, managers: 3, lostReasons: 6 };

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "postgresql://unknown/unknown");
  console.log(`Seed: база «${target.pathname.slice(1)}» на ${target.host}. Все данные в ней будут заменены.`);

  // Идемпотентность: seed всегда начинает с чистых таблиц.
  await prisma.activity.deleteMany();
  await prisma.stageTransition.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.lostReason.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.auditLog.deleteMany();

  // Менеджеры (ответственные) и справочник причин отказа
  await prisma.manager.createMany({
    data: [
      { id: "mgr_anna", name: "Анна Мельникова", email: "melnikova@agency.example" },
      { id: "mgr_boris", name: "Борис Кузнецов", email: "kuznetsov@agency.example" },
      { id: "mgr_vera", name: "Вера Соколова", email: "sokolova@agency.example" },
    ],
  });
  await prisma.lostReason.createMany({
    data: [
      { id: "lr_price", name: "Цена выше ожиданий", position: 1 },
      { id: "lr_competitor", name: "Выбрали другого подрядчика", position: 2 },
      { id: "lr_timing", name: "Не подошли сроки", position: 3 },
      { id: "lr_budget", name: "Бюджет сократили или отменили", position: 4 },
      { id: "lr_silent", name: "Клиент перестал отвечать", position: 5 },
      { id: "lr_other", name: "Другое", position: 6, requiresComment: true },
    ],
  });

  // Стадии воронки
  await prisma.stage.createMany({
    data: [
      { id: "stage_new", code: "new", name: "Новая", position: 1, isClosed: false, probability: 10 },
      { id: "stage_qualification", code: "qualification", name: "Квалификация", position: 2, isClosed: false, probability: 25 },
      { id: "stage_proposal", code: "proposal", name: "Смета / КП", position: 3, isClosed: false, probability: 50 },
      { id: "stage_negotiation", code: "negotiation", name: "Согласование", position: 4, isClosed: false, probability: 75 },
      { id: "stage_won", code: "won", name: "Выиграна", position: 5, isClosed: true, probability: 100 },
      { id: "stage_lost", code: "lost", name: "Проиграна", position: 6, isClosed: true, probability: 0 },
    ],
  });

  // Компании (4)
  await prisma.account.createMany({
    data: [
      { id: "acc_expo", name: "ООО «Экспо Плюс»", industry: "Строительные материалы", city: "Москва", website: "https://expoplus.example", phone: "+7 495 000-00-01" },
      { id: "acc_nordic", name: "Nordic Home", industry: "Мебель и интерьер", city: "Санкт-Петербург", phone: "+7 812 000-00-02" },
      { id: "acc_fresh", name: "Fresh Lab", industry: "Пищевая промышленность", city: "Казань" },
      { id: "acc_techno", name: "Техно-М", industry: "Промышленное оборудование", city: "Екатеринбург", website: "https://techno-m.example" },
    ],
  });

  // Контакты (5): у «Экспо Плюс» два контакта, у остальных по одному
  await prisma.contact.createMany({
    data: [
      { id: "con_orlov", firstName: "Иван", lastName: "Орлов", position: "Руководитель отдела маркетинга", email: "orlov@expoplus.example", phone: "+7 900 000-00-01", accountId: "acc_expo" },
      { id: "con_petrova", firstName: "Наталья", lastName: "Петрова", position: "Менеджер по выставкам", email: "petrova@expoplus.example", accountId: "acc_expo" },
      { id: "con_kim", firstName: "Мария", lastName: "Ким", position: "Бренд-менеджер", email: "kim@nordic.example", phone: "+7 900 000-00-02", accountId: "acc_nordic" },
      { id: "con_smirnov", firstName: "Олег", lastName: "Смирнов", position: "Директор по развитию", email: "smirnov@freshlab.example", accountId: "acc_fresh" },
      { id: "con_lebedeva", firstName: "Анна", lastName: "Лебедева", position: "Организатор выставок", email: "lebedeva@techno-m.example", phone: "+7 900 000-00-04", accountId: "acc_techno" },
    ],
  });

  // Лиды (6): все источники и 5 статусов
  await prisma.lead.createMany({
    data: [
      { id: "lead_1", managerId: "mgr_anna", name: "Дмитрий Соколов", company: "Альфа Декор", email: "sokolov@alfa.example", source: "site", status: "new", budget: 1_500_000, venue: "Крокус Экспо", workFormat: "Стенд под ключ", deadline: at(90) },
      { id: "lead_2", managerId: "mgr_boris", name: "Елена Павлова", company: "Мед-Тех", phone: "+7 900 000-00-11", source: "phone", status: "in_progress", budget: 800_000, venue: "Экспоцентр", workFormat: "Аренда и оформление" },
      { id: "lead_3", managerId: "mgr_anna", name: "Сергей Белов", company: "Ритм", email: "belov@ritm.example", source: "email", status: "qualified", budget: 2_100_000, venue: "ВДНХ", workFormat: "Бренд-зона", deadline: at(60) },
      { id: "lead_4", name: "Павел Круглов", company: "Стройсервис", source: "manual", status: "disqualified", disqualifyReason: "Бюджет ниже минимального" },
      {
        id: "lead_5", managerId: "mgr_vera", name: "Анна Лебедева", company: "Техно-М", email: "lebedeva@techno-m.example", source: "referral", status: "converted",
        budget: 3_900_000, venue: "Экспо-центр Екатеринбург", workFormat: "Стенд под ключ",
        convertedAt: at(-20), convertedAccountId: "acc_techno", convertedContactId: "con_lebedeva",
      },
      { id: "lead_6", name: "Игорь Новак", company: "Логика", email: "novak@logika.example", source: "site", status: "new", budget: 1_000_000 },
    ],
  });

  // Сделки (6): по одной на каждую стадию воронки
  await prisma.opportunity.createMany({
    data: [
      { id: "opp_1", managerId: "mgr_boris", title: "Стенд на Агропродмаш", stageId: "stage_new", status: "open", amount: 450_000, accountId: "acc_fresh", contactId: "con_smirnov", venue: "Экспоцентр" },
      { id: "opp_2", managerId: "mgr_anna", title: "Стенд 36 м² на MosBuild", stageId: "stage_qualification", status: "open", amount: 1_200_000, accountId: "acc_expo", contactId: "con_orlov", venue: "Крокус Экспо", eventDate: at(75), updatedAt: at(-20) },
      { id: "opp_3", managerId: "mgr_anna", title: "Бренд-зона в ТЦ", stageId: "stage_proposal", status: "open", amount: 2_750_000, accountId: "acc_nordic", contactId: "con_kim", venue: "ТЦ «Галерея»", eventDate: at(50) },
      { id: "opp_4", managerId: "mgr_boris", title: "Pop-up стенд", stageId: "stage_negotiation", status: "open", amount: 640_000, accountId: "acc_expo", contactId: "con_petrova", venue: "Экспоцентр", eventDate: at(30) },
      { id: "opp_5", managerId: "mgr_vera", title: "Стенд на Иннопром", stageId: "stage_won", status: "won", amount: 3_900_000, closedAt: at(-6), accountId: "acc_techno", contactId: "con_lebedeva", leadId: "lead_5", venue: "Экспо-центр Екатеринбург" },
      { id: "opp_6", managerId: "mgr_anna", title: "Выставка «Мебель»", stageId: "stage_lost", status: "lost", amount: 980_000, closedAt: at(-15), lostReasonId: "lr_competitor", lostReason: "Выбрали другого подрядчика", accountId: "acc_nordic", contactId: "con_kim" },
    ],
  });

  // История переходов по стадиям: из неё строится динамика объёмов на дашборде.
  // [сделка, сумма, [[стадия, дней назад], ...]]
  const history: [string, number, [string, number][]][] = [
    ["opp_1", 450_000, [["new", 3]]],
    ["opp_2", 1_200_000, [["new", 38], ["qualification", 30]]],
    ["opp_3", 2_750_000, [["new", 35], ["qualification", 28], ["proposal", 12]]],
    ["opp_4", 640_000, [["new", 25], ["qualification", 18], ["proposal", 10], ["negotiation", 4]]],
    ["opp_5", 3_900_000, [["new", 50], ["qualification", 44], ["proposal", 30], ["negotiation", 16], ["won", 6]]],
    ["opp_6", 980_000, [["new", 40], ["qualification", 33], ["lost", 15]]],
  ];
  await prisma.stageTransition.createMany({
    data: history.flatMap(([opportunityId, amount, steps]) =>
      steps.map(([stage, daysAgo]) => ({ opportunityId, amount, stageId: `stage_${stage}`, createdAt: at(-daysAgo, 10) })),
    ),
  });

  // Активности (8): 2 заметки и 6 задач
  //   просрочено (2): act_3, act_4; на сегодня (2): act_5, act_6; будущая: act_7; выполненная: act_8
  await prisma.activity.createMany({
    data: [
      { id: "act_1", type: "note", body: "Клиент просит два варианта планировки: открытый и с закрытой переговорной.", opportunityId: "opp_2" },
      { id: "act_2", type: "note", body: "Пришла рекомендация от Техно-М.", leadId: "lead_2" },
      { id: "act_3", assigneeId: "mgr_anna", type: "task", body: "Уточнить размеры площадки у организатора", dueDate: at(-3), done: false, opportunityId: "opp_2" },
      { id: "act_4", assigneeId: "mgr_boris", type: "task", body: "Подготовить 3D-визуализацию", dueDate: at(-1), done: false, opportunityId: "opp_4" },
      { id: "act_5", assigneeId: "mgr_anna", type: "task", body: "Отправить обновлённую смету", dueDate: at(0, 15), done: false, opportunityId: "opp_3" },
      { id: "act_6", assigneeId: "mgr_boris", type: "task", body: "Перезвонить по заявке", dueDate: at(0, 17), done: false, leadId: "lead_2" },
      { id: "act_7", assigneeId: "mgr_boris", type: "task", body: "Созвон по срокам монтажа", dueDate: at(2), done: false, opportunityId: "opp_4" },
      { id: "act_8", assigneeId: "mgr_vera", type: "task", body: "Отправить договор", dueDate: at(-10), done: true, completedAt: at(-9), opportunityId: "opp_5" },
    ],
  });

  const actual = {
    leads: await prisma.lead.count(),
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    activities: await prisma.activity.count(),
    managers: await prisma.manager.count(),
    lostReasons: await prisma.lostReason.count(),
  };
  const overdue = await prisma.activity.count({ where: { type: "task", done: false, dueDate: { lt: startOfToday } } });
  const today = await prisma.activity.count({ where: { type: "task", done: false, dueDate: { gte: startOfToday, lt: at(1, 0) } } });

  for (const key of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    if (actual[key] !== EXPECTED[key]) throw new Error(`Seed: ${key} = ${actual[key]}, ожидалось ${EXPECTED[key]}`);
  }
  if (overdue < 2 || today < 2) throw new Error(`Seed: просроченных ${overdue}, на сегодня ${today}, нужно минимум по 2`);

  console.log("Seed выполнен:", { ...actual, "задач просрочено": overdue, "задач на сегодня": today });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
