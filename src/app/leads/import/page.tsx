import type { Metadata } from "next";
import { ImportLeadsForm } from "@/components/import-leads-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Импорт лидов" };

export default function ImportLeadsPage() {
  return (
    <>
      <PageHeader title="Импорт лидов из CSV" breadcrumb={{ href: "/leads", label: "Лиды" }} subtitle="Каждая строка проверяется так же, как форма создания лида." />
      <Card>
        <ImportLeadsForm />
      </Card>
      <Card title="Формат файла">
        <ul className="error-list" style={{ color: "var(--text-muted)" }}>
          <li>Первая строка: заголовки. Обязателен столбец «Имя». Остальные: Компания, Email, Телефон, Источник, Бюджет, Площадка, Формат работ, Ответственный, Статус, Срок (дд.мм.гггг).</li>
          <li>Источник: Сайт, Почта, Телефон, Рекомендация, Вручную (или коды site, email, phone, referral, manual).</li>
          <li>Разделитель: `;`, `,` или табуляция, кодировка UTF-8 (как при экспорте из Excel в «CSV UTF-8»).</li>
          <li>Строки с ошибками и дубли по email пропускаются, остальные импортируются. Максимум 2000 строк и 2 МБ.</li>
        </ul>
      </Card>
    </>
  );
}
