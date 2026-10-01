import { describe, expect, it } from "vitest";
import { stageRuleError, statusForStage } from "@/lib/opportunity-rules";

const ok = { amount: 500_000, contactId: "c1", lostReasonId: "r1", lostComment: null };

describe("statusForStage", () => {
  it("won и lost дают закрытые статусы, остальные стадии открытые", () => {
    expect(statusForStage("won")).toBe("won");
    expect(statusForStage("lost")).toBe("lost");
    for (const code of ["new", "qualification", "proposal", "negotiation"]) expect(statusForStage(code)).toBe("open");
  });
});

describe("stageRuleError: выигрыш", () => {
  it("блокируется без суммы, с нулевой суммой и без контакта", () => {
    expect(stageRuleError("won", { ...ok, amount: null })?.field).toBe("amount");
    expect(stageRuleError("won", { ...ok, amount: 0 })?.field).toBe("amount");
    expect(stageRuleError("won", { ...ok, amount: "0.00" })?.field).toBe("amount");
    expect(stageRuleError("won", { ...ok, contactId: null })?.field).toBe("contactId");
  });
  it("проходит при сумме больше нуля и контакте", () => {
    expect(stageRuleError("won", ok)).toBeNull();
    expect(stageRuleError("won", { ...ok, amount: "1200.50" })).toBeNull();
  });
});

describe("stageRuleError: проигрыш", () => {
  it("требует причину из справочника", () => {
    expect(stageRuleError("lost", { ...ok, lostReasonId: null })?.field).toBe("lostReasonId");
  });
  it("для причины «Другое» требует комментарий", () => {
    const other = { ...ok, lostReasonRequiresComment: true };
    expect(stageRuleError("lost", { ...other, lostComment: "  " })?.field).toBe("lostReason");
    expect(stageRuleError("lost", { ...other, lostComment: "клиент передумал" })).toBeNull();
  });
  it("обычная причина проходит без комментария", () => {
    expect(stageRuleError("lost", ok)).toBeNull();
  });
});

describe("stageRuleError: открытые стадии", () => {
  it("никаких дополнительных требований", () => {
    for (const code of ["new", "qualification", "proposal", "negotiation"]) {
      expect(stageRuleError(code, { amount: null, contactId: null, lostReasonId: null, lostComment: null })).toBeNull();
    }
  });
});
