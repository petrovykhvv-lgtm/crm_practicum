import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

// Даты считаются от начала сегодняшнего дня (локальное время),
// поэтому «просрочено» и «на сегодня» получаются одинаково при любом запуске.
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const at = (days: number, hour = 12) => new Date(startOfToday.getTime() + days * DAY + hour * 60 * 60 * 1000);

// Ожидаемое содержимое базы после seed. Расхождение считается ошибкой.
const EXPECTED = { leads: 6, accounts: 4, contacts: 5, opportunities: 6, activities: 8 };

async function main() {
  // Идемпотентность: seed всегда начинает с чистых таблиц.
  await prisma.activity.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.stage.deleteMany();

  // Стадии воронки
  await prisma.stage.createMany({
    data: [
      { id: "stage_new", code: "new", name: "Новая", position: 1, isClosed: false },
      { id: "stage_qualification", code: "qualification", name: "Квалификация", position: 2, isClosed: false },
      { id: "stage_proposal", code: "proposal", name: "Смета / КП", position: 3, isClosed: false },
      { id: "stage_negotiation", code: "negotiation", name: "Согласование", position: 4, isClosed: false },
      { id: "stage_won", code: "won", name: "Выиграна", position: 5, isClosed: true },
      { id: "stage_lost", code: "lost", name: "Проиграна", position: 6, isClosed: true },
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
      { id: "lead_1", name: "Дмитрий Соколов", company: "Альфа Декор", email: "sokolov@alfa.example", source: "site", status: "new", budget: 1_500_000, venue: "Крокус Экспо", workFormat: "Стенд под ключ", deadline: at(90) },
      { id: "lead_2", name: "Елена Павлова", company: "Мед-Тех", phone: "+7 900 000-00-11", source: "phone", status: "in_progress", budget: 800_000, venue: "Экспоцентр", workFormat: "Аренда и оформление" },
      { id: "lead_3", name: "Сергей Белов", company: "Ритм", email: "belov@ritm.example", source: "email", status: "qualified", budget: 2_100_000, venue: "ВДНХ", workFormat: "Бренд-зона", deadline: at(60) },
      { id: "lead_4", name: "Павел Круглов", company: "Стройсервис", source: "manual", status: "disqualified", disqualifyReason: "Бюджет ниже минимального" },
      {
        id: "lead_5", name: "Анна Лебедева", company: "Техно-М", email: "lebedeva@techno-m.example", source: "referral", status: "converted",
        budget: 3_900_000, venue: "Экспо-центр Екатеринбург", workFormat: "Стенд под ключ",
        convertedAt: at(-20), convertedAccountId: "acc_techno", convertedContactId: "con_lebedeva",
      },
      { id: "lead_6", name: "Игорь Новак", company: "Логика", email: "novak@logika.example", source: "site", status: "new", budget: 1_000_000 },
    ],
  });

  // Сделки (6): по одной на каждую стадию воронки
  await prisma.opportunity.createMany({
    data: [
      { id: "opp_1", title: "Стенд на Агропродмаш", stageId: "stage_new", status: "open", amount: 450_000, accountId: "acc_fresh", contactId: "con_smirnov", venue: "Экспоцентр" },
      { id: "opp_2", title: "Стенд 36 м² на MosBuild", stageId: "stage_qualification", status: "open", amount: 1_200_000, accountId: "acc_expo", contactId: "con_orlov", venue: "Крокус Экспо", eventDate: at(75) },
      { id: "opp_3", title: "Бренд-зона в ТЦ", stageId: "stage_proposal", status: "open", amount: 2_750_000, accountId: "acc_nordic", contactId: "con_kim", venue: "ТЦ «Галерея»", eventDate: at(50) },
      { id: "opp_4", title: "Pop-up стенд", stageId: "stage_negotiation", status: "open", amount: 640_000, accountId: "acc_expo", contactId: "con_petrova", venue: "Экспоцентр", eventDate: at(30) },
      { id: "opp_5", title: "Стенд на Иннопром", stageId: "stage_won", status: "won", amount: 3_900_000, closedAt: at(-6), accountId: "acc_techno", contactId: "con_lebedeva", leadId: "lead_5", venue: "Экспо-центр Екатеринбург" },
      { id: "opp_6", title: "Выставка «Мебель»", stageId: "stage_lost", status: "lost", amount: 980_000, closedAt: at(-15), lostReason: "Выбрали другого подрядчика", accountId: "acc_nordic", contactId: "con_kim" },
    ],
  });

  // Активности (8): 2 заметки и 6 задач
  //   просрочено (2): act_3, act_4; на сегодня (2): act_5, act_6; будущая: act_7; выполненная: act_8
  await prisma.activity.createMany({
    data: [
      { id: "act_1", type: "note", body: "Клиент просит два варианта планировки: открытый и с закрытой переговорной.", opportunityId: "opp_2" },
      { id: "act_2", type: "note", body: "Пришла рекомендация от Техно-М.", leadId: "lead_2" },
      { id: "act_3", type: "task", body: "Уточнить размеры площадки у организатора", dueDate: at(-3), done: false, opportunityId: "opp_2" },
      { id: "act_4", type: "task", body: "Подготовить 3D-визуализацию", dueDate: at(-1), done: false, opportunityId: "opp_4" },
      { id: "act_5", type: "task", body: "Отправить обновлённую смету", dueDate: at(0, 15), done: false, opportunityId: "opp_3" },
      { id: "act_6", type: "task", body: "Перезвонить по заявке", dueDate: at(0, 17), done: false, leadId: "lead_2" },
      { id: "act_7", type: "task", body: "Созвон по срокам монтажа", dueDate: at(2), done: false, opportunityId: "opp_4" },
      { id: "act_8", type: "task", body: "Отправить договор", dueDate: at(-10), done: true, completedAt: at(-9), opportunityId: "opp_5" },
    ],
  });

  const actual = {
    leads: await prisma.lead.count(),
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    activities: await prisma.activity.count(),
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
