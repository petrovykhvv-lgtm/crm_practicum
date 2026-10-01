import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("разбирает разделитель ; и кавычки с переводами строк", () => {
    const rows = parseCsv('Имя;Компания\r\n"Иван; Петров";"ООО ""Ромашка"""\r\n"Строка\nдве";Б\r\n');
    expect(rows).toEqual([["Имя", "Компания"], ["Иван; Петров", 'ООО "Ромашка"'], ["Строка\nдве", "Б"]]);
  });
  it("определяет запятую и табуляцию, убирает BOM и пустые строки", () => {
    expect(parseCsv("﻿a,b\n1,2\n\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("toCsv", () => {
  it("строит CSV для Excel: BOM, разделитель ;, CRLF, экранирование", () => {
    const csv = toCsv(["Имя", "Заметка"], [["Иван", 'Сказал "да"; перезвонить'], ["Анна", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('Иван;"Сказал ""да""; перезвонить"');
    expect(csv).toContain("Анна;\r\n");
  });
  it("защищает от инъекции формул, но не трогает числа", () => {
    const csv = toCsv(["a"], [["=SUM(A1)"], ["-5"], ["+7,5"], ["+7 900 000-00-00"], ["@cmd"], ["+1+1"], ["-cmd|calc"]]);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("\r\n-5\r\n");
    expect(csv).toContain("'@cmd");
    expect(csv).toContain("\r\n+7 900 000-00-00\r\n"); // телефон не портится
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-cmd|calc");
  });
  it("круговое преобразование сохраняет данные", () => {
    const data = [["a;b", 'c"d', "e\nf", "обычный"]];
    expect(parseCsv(toCsv(["1", "2", "3", "4"], data))[1]).toEqual(data[0]);
  });
});
