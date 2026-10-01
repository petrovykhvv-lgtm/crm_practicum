/** Адрес тестовой базы. Тесты никогда не работают с рабочей базой: имя обязано оканчиваться на `_test`. */
export function testDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL_TEST;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Не задан DATABASE_URL_TEST (или DATABASE_URL, из которого будет выведена тестовая база).");
  const url = new URL(base);
  if (!explicit) url.pathname = `${url.pathname.replace(/_test$/, "")}_test`;
  const name = url.pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) throw new Error(`Отказ: имя тестовой базы «${name}» должно оканчиваться на _test. Тесты очищают таблицы.`);
  return url.toString();
}

export function maintenanceUrl(testUrl: string): string {
  const url = new URL(testUrl);
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}
