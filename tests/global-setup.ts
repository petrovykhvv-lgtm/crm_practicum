import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { maintenanceUrl, testDatabaseUrl } from "./helpers/test-db";

// Подхватываем DATABASE_URL из .env, чтобы вывести из него имя тестовой базы (переменные окружения приоритетнее).
function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

/** Создаёт тестовую базу (если её нет) и применяет к ней миграции. */
export default function setup() {
  loadDotEnv();
  const url = testDatabaseUrl();
  const name = new URL(url).pathname.slice(1);
  try {
    execSync(`npx prisma db execute --url "${maintenanceUrl(url)}" --stdin`, { input: `CREATE DATABASE "${name}"`, stdio: ["pipe", "ignore", "ignore"] });
  } catch {
    // база уже существует или нет прав на создание: это выяснится на следующем шаге
  }
  try {
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  } catch (error) {
    throw new Error(`Не удалось применить миграции к тестовой базе «${name}». Создайте её вручную: createdb ${name}\n${(error as Error).message}`);
  }
}
