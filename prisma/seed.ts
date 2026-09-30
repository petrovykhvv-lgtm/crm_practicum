import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * day);

async function main() {
  // Идемпотентность: seed всегда начинает с чистых таблиц.
  await prisma.activity.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.stage.deleteMany();

  const stageDefs = [
    { code: "new", name: "Новая", position: 1, isClosed: false },
    { code: "qualification", name: "Квалификация", position: 2, isClosed: false },
    { code: "proposal", name: "Смета / КП", position: 3, isClosed: false },
    { code: "negotiation", name: "Согласование", position: 4, isClosed: false },
    { code: "won", name: "Выиграна", position: 5, isClosed: true },
    { code: "lost", name: "Проиграна", position: 6, isClosed: true },
  ];
  await prisma.stage.createMany({ data: stageDefs });
  const stages = Object.fromEntries((await prisma.stage.findMany()).map((s) => [s.code, s.id]));

  const expo = await prisma.account.create({
    data: { name: "ООО «Экспо Плюс»", industry: "Строительные материалы", city: "Москва", website: "https://expoplus.example" },
  });
  const nordic = await prisma.account.create({
    data: { name: "Nordic Home", industry: "Мебель и интерьер", city: "Санкт-Петербург" },
  });
  const fresh = await prisma.account.create({
    data: { name: "Fresh Lab", industry: "Пищевая промышленность", city: "Казань" },
  });
  const techno = await prisma.account.create({
    data: { name: "Техно-М", industry: "Промышленное оборудование", city: "Екатеринбург" },
  });

  const ivan = await prisma.contact.create({
    data: { firstName: "Иван", lastName: "Орлов", position: "Руководитель отдела маркетинга", email: "orlov@expoplus.example", phone: "+7 900 000-00-01", accountId: expo.id },
  });
  const maria = await prisma.contact.create({
    data: { firstName: "Мария", lastName: "Ким", position: "Бренд-менеджер", email: "kim@nordic.example", phone: "+7 900 000-00-02", accountId: nordic.id },
  });
  const oleg = await prisma.contact.create({
    data: { firstName: "Олег", lastName: "Смирнов", position: "Директор по развитию", email: "smirnov@freshlab.example", accountId: fresh.id },
  });
  const anna = await prisma.contact.create({
    data: { firstName: "Анна", lastName: "Лебедева", position: "Организатор выставок", email: "lebedeva@techno-m.example", phone: "+7 900 000-00-04", accountId: techno.id },
  });

  const deal = (title: string, stage: string, accountId: string, contactId: string, amount: number | null, extra = {}) =>
    prisma.opportunity.create({
      data: { title, stageId: stages[stage], accountId, contactId, amount, ...extra },
    });

  const d1 = await deal("Стенд 36 м² на MosBuild", "qualification", expo.id, ivan.id, 1_200_000, { venue: "Крокус Экспо", eventDate: daysFromNow(75) });
  const d2 = await deal("Бренд-зона в ТЦ", "proposal", nordic.id, maria.id, 2_750_000, { venue: "ТЦ «Галерея»", eventDate: daysFromNow(50) });
  const d3 = await deal("Pop-up стенд", "negotiation", fresh.id, oleg.id, 640_000, { venue: "Экспоцентр", eventDate: daysFromNow(30) });
  await deal("Стенд на Иннопром", "won", techno.id, anna.id, 3_900_000, { status: "won", closedAt: daysFromNow(-6), venue: "Экспо-центр Екатеринбург" });
  await deal("Выставка «Мебель»", "lost", nordic.id, maria.id, 980_000, { status: "lost", closedAt: daysFromNow(-15), lostReason: "Выбрали другого подрядчика" });
  await deal("Стенд на Агропродмаш", "new", fresh.id, oleg.id, null);

  const leads = await Promise.all([
    prisma.lead.create({ data: { name: "Дмитрий Соколов", company: "Альфа Декор", email: "sokolov@alfa.example", source: "site", status: "new", budget: 1_500_000, venue: "Крокус Экспо", workFormat: "Стенд под ключ", deadline: daysFromNow(90) } }),
    prisma.lead.create({ data: { name: "Елена Павлова", company: "Мед-Тех", phone: "+7 900 000-00-11", source: "phone", status: "in_progress", budget: 800_000, venue: "Экспоцентр", workFormat: "Аренда и оформление" } }),
    prisma.lead.create({ data: { name: "Сергей Белов", company: "Ритм", email: "belov@ritm.example", source: "email", status: "qualified", budget: 2_100_000, venue: "ВДНХ", workFormat: "Бренд-зона", deadline: daysFromNow(60) } }),
    prisma.lead.create({ data: { name: "Ольга Гринева", company: "Зелёный дом", source: "referral", status: "in_progress", budget: 500_000 } }),
    prisma.lead.create({ data: { name: "Павел Круглов", company: "Стройсервис", source: "manual", status: "disqualified", disqualifyReason: "Бюджет ниже минимального" } }),
    prisma.lead.create({
      data: {
        name: "Анна Лебедева", company: "Техно-М", email: "lebedeva@techno-m.example", source: "referral", status: "converted",
        budget: 3_900_000, convertedAt: daysFromNow(-20), convertedAccountId: techno.id, convertedContactId: anna.id,
      },
    }),
    prisma.lead.create({ data: { name: "Игорь Новак", company: "Логика", email: "novak@logika.example", source: "site", status: "new", budget: 1_000_000 } }),
  ]);

  await prisma.activity.createMany({
    data: [
      { type: "note", body: "Клиент просит два варианта планировки: открытый и с закрытой переговорной.", opportunityId: d1.id },
      { type: "note", body: "КП отправлено, ждём обратную связь по материалам.", opportunityId: d2.id },
      { type: "task", body: "Уточнить размеры площадки у организатора", dueDate: daysFromNow(-3), done: false, opportunityId: d1.id },
      { type: "task", body: "Отправить обновлённую смету", dueDate: daysFromNow(0), done: false, opportunityId: d2.id },
      { type: "task", body: "Созвон по согласованию сроков монтажа", dueDate: daysFromNow(2), done: false, opportunityId: d3.id },
      { type: "task", body: "Подготовить 3D-визуализацию", dueDate: daysFromNow(-1), done: false, opportunityId: d3.id },
      { type: "task", body: "Отправить договор", dueDate: daysFromNow(-10), done: true, completedAt: daysFromNow(-9), opportunityId: d2.id },
      { type: "task", body: "Перезвонить по заявке", dueDate: daysFromNow(1), done: false, leadId: leads[1].id },
      { type: "note", body: "Пришла рекомендация от Техно-М.", leadId: leads[3].id },
    ],
  });

  const counts = {
    stages: await prisma.stage.count(),
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    leads: await prisma.lead.count(),
    opportunities: await prisma.opportunity.count(),
    activities: await prisma.activity.count(),
  };
  console.log("Seed выполнен:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
