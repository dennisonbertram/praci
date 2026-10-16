import { CapTableSnapshotInputSchema } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  DEMO_CAP_TABLE,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  demoFinance,
  demoMailboxes,
  MOCK_NOTE,
  MOCK_SUBJECT_PREFIX,
} from "./data.js";

describe("mock demo data", () => {
  it("labels the company and every contact and document as mock", () => {
    expect(DEMO_COMPANY.startsWith("MOCK DEMO DATA —")).toBe(true);
    for (const contact of DEMO_CONTACTS) expect(contact.notes).toContain(MOCK_NOTE);
    for (const document of DEMO_DOCUMENTS) {
      expect(document.name).toContain("MOCK");
      expect(document.text).toContain(MOCK_NOTE);
    }
  });

  it("has a valid mock cap table whose classes add up to the fully diluted count", () => {
    const table = CapTableSnapshotInputSchema.parse(DEMO_CAP_TABLE);
    expect(table.companyName).toBe(DEMO_COMPANY);
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    expect(sum(table.shareClasses.map((c) => c.shares))).toBe(table.fullyDilutedShares);
    expect(sum(table.shareClasses.map((c) => c.percent))).toBe(100);
    for (const holder of table.holders)
      expect(`${holder.name} ${holder.organization ?? ""}`).toMatch(/Mock|Placeholder|Notareal/);
  });

  it("builds a mailbox of 25 mock threads with unread mail and one attachment", () => {
    const { messages } = demoMailboxes()["mock-demo-mailbox"];
    for (const message of messages) {
      expect(message.subject.startsWith(MOCK_SUBJECT_PREFIX)).toBe(true);
      expect(message.text).toContain(MOCK_NOTE);
    }
    expect(new Set(messages.map((m) => m.threadId)).size).toBe(25);
    expect(messages.some((m) => m.labels.includes("UNREAD"))).toBe(true);
    expect(messages.filter((m) => m.attachments?.length)).toHaveLength(1);
  });

  it("serves about three months of mock finance history", async () => {
    const { callToolFor } = demoFinance(new Date("2026-10-16T12:00:00Z"));
    const server = { id: "s", provider: "mercury", endpoint: "" } as never;
    const mercury = await callToolFor(server);
    const accounts = JSON.stringify(await mercury("getAccounts", {}));
    expect(accounts).toContain("MOCK Checking");
    const page = (await mercury("listTransactions", {
      accountId: ["chk-1111"],
      limit: 300,
      status: ["sent"],
    })) as { transactions: Array<{ counterpartyName: string; date: string }> };
    expect(page.transactions.length).toBeGreaterThan(15);
    for (const t of page.transactions) expect(t.counterpartyName).toMatch(/\(Mock\)|^Brex$/);
    const dates = page.transactions.map((t) => t.date).sort();
    const spanDays =
      (Date.parse(dates.at(-1) as string) - Date.parse(dates[0] as string)) / 86_400_000;
    expect(spanDays).toBeGreaterThan(60);
  });
});
