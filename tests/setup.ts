import { existsSync, readFileSync } from "node:fs";
import { vi } from "vitest";
import { testDatabaseUrl } from "./helpers/test-db";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
// Жёсткая подмена: всё приложение в тестах работает только с тестовой базой.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Moscow";

// Next.js-окружение: кэш и переходы подменяются, cookie хранятся в памяти.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
(globalThis as { __cookieJar?: Map<string, string> }).__cookieJar = jar;
