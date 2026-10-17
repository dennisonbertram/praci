import { describe, expect, it } from "vitest";
import {
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  demoFinance,
  demoMailboxes,
  demoStatementCsv,
  MOCK_NOTE,
  MOCK_SUBJECT_PREFIX,
} from "./data.js";

describe("mock demo data", () => {
  it("labels the company and every contact and document as mock", () => {
    expect(DEMO_COMPANY.startsWith("MOCK DEMO DATA —")).toBe(true);
    expect(DEMO_EMPTY_SPACE.startsWith("MOCK DEMO DATA —")).toBe(true);
    for (const contact of DEMO_CONTACTS) expect(contact.notes).toContain(MOCK_NOTE);
    for (const document of DEMO_DOCUMENTS) {
      expect(document.name).toContain("MOCK");
      expect(document.text).toContain(MOCK_NOTE);
    }
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

  it("builds last month's mock statement with balances that add up", () => {
    const { fileName, body } = demoStatementCsv(new Date("2026-10-16T12:00:00Z"));
    expect(fileName).toBe("mock-community-bank-2026-09.csv");
    const [, ...lines] = body.trim().split("\n");
    let balance = 10_000_00;
    for (const line of lines) {
      const [date, description, amount, after] = line.split(",");
      expect(date?.startsWith("2026-09-")).toBe(true);
      expect(description).toContain("(Mock)");
      balance += Math.round(Number(amount) * 100);
      expect(Math.round(Number(after) * 100)).toBe(balance);
    }
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
