import type { EmailCard } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { emailCardsText, groupEmailCards, triageUrgency } from "./email-cards.js";

const card = (id: string, urgency: EmailCard["urgency"], receivedAt: string): EmailCard => ({
  id,
  urgency,
  from: `From ${id}`,
  subject: `Subject ${id}`,
  snippet: "",
  receivedAt,
});

describe("groupEmailCards", () => {
  it("orders groups Today, Within 3 days, This week, Later and sorts each newest first", () => {
    const groups = groupEmailCards([
      card("late", "later", "2026-10-01T00:00:00Z"),
      card("old", "today", "2026-10-12T08:00:00Z"),
      card("week", "this_week", "2026-10-11T00:00:00Z"),
      card("new", "today", "2026-10-12T09:00:00Z"),
      card("soon", "within_3_days", "2026-10-10T00:00:00Z"),
    ]);
    expect(groups.map((group) => [group.urgency, group.emails.map((e) => e.id)])).toEqual([
      ["today", ["new", "old"]],
      ["within_3_days", ["soon"]],
      ["this_week", ["week"]],
      ["later", ["late"]],
    ]);
  });

  it("leaves out groups with no messages", () => {
    const groups = groupEmailCards([card("a", "later", "2026-10-01T00:00:00Z")]);
    expect(groups.map((group) => group.urgency)).toEqual(["later"]);
  });
});

describe("triageUrgency", () => {
  const now = new Date("2026-10-12T15:00:00Z");

  it.each([
    ["due today", { priority: "normal", dueOn: "2026-10-12" }, "today"],
    ["overdue", { priority: "low", dueOn: "2026-10-01" }, "today"],
    ["due in 3 days", { priority: null, dueOn: "2026-10-15" }, "within_3_days"],
    ["due in 7 days", { priority: null, dueOn: "2026-10-19" }, "this_week"],
    ["due later", { priority: "critical", dueOn: "2026-11-30" }, "later"],
    ["critical with no date", { priority: "critical", dueOn: null }, "today"],
    ["important with no date", { priority: "important", dueOn: null }, "within_3_days"],
    ["untriaged", { priority: null, dueOn: null }, "later"],
    ["normal with no date", { priority: "normal", dueOn: null }, "later"],
  ] as const)("puts %s in %s", (_name, triage, expected) => {
    expect(triageUrgency(triage, now)).toBe(expected);
  });
});

describe("emailCardsText", () => {
  it("lists sender and subject in urgency order and escapes markdown from untrusted mail", () => {
    const text = emailCardsText([
      card("b", "later", "2026-10-01T00:00:00Z"),
      {
        ...card("a", "today", "2026-10-12T09:00:00Z"),
        from: "Eve",
        subject: "[pay](https://evil.test)",
      },
    ]);
    expect(text).toBe("Eve: \\[pay\\]\\(https://evil\\.test\\)\nFrom b: Subject b");
  });
});
