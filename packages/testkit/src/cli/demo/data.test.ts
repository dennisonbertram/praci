import { createRpcClient, fetchChainSnapshot, fetchPrices } from "@rakazo/adapters";
import { describe, expect, it } from "vitest";
import {
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_WALLET,
  demoCrypto,
  demoFinance,
  demoFolderPaths,
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

  it("includes one document that fails to read, so the failed state can be seen", () => {
    expect(DEMO_DOCUMENTS.filter((document) => document.kind === "broken")).toHaveLength(1);
  });

  it("creates each parent folder before its sub-folders", () => {
    expect(demoFolderPaths([{ folder: "A/B/C" }, { folder: "D" }] as never)).toEqual([
      "A",
      "D",
      "A/B",
      "A/B/C",
    ]);
    expect(demoFolderPaths(DEMO_DOCUMENTS)).toContain("Finance/Invoices");
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

  it("reads the mock wallet's ETH and USDC offline, priced, through the real RPC reader", async () => {
    const rpc = createRpcClient({ fetch: demoCrypto().fetch, gapMs: 0 });
    const { holdings } = await fetchChainSnapshot(rpc, 1, DEMO_WALLET.address);
    expect(holdings.map((h) => [h.symbol, h.rawBalance])).toEqual([
      ["ETH", "2500000000000000000"],
      ["USDC", "40000000000"],
    ]);
    const prices = await fetchPrices(
      rpc,
      holdings.map((h) => h.llamaKey),
    );
    expect(prices.size).toBe(2);
  });

  it("serves one pending Brex charge and one unpaid Brex bill", async () => {
    const { callToolFor } = demoFinance(new Date("2026-10-16T12:00:00Z"));
    const brex = await callToolFor({ id: "s", provider: "brex", endpoint: "" } as never);
    const page = (await brex("list_expenses", { intent: "test", limit: 100 })) as {
      items: Array<{ id: string; payment_status: string }>;
    };
    expect(page.items.filter((e) => e.payment_status === "PROCESSING").map((e) => e.id)).toEqual([
      "mock-brex-pending",
    ]);
    const bills = (await brex("list_bills", { intent: "test" })) as {
      items: Array<{ vendor: { name: string }; due_at: string }>;
    };
    expect(bills.items.map((b) => b.vendor.name)).toEqual(["Placeholder Legal LLP (Mock)"]);
    expect(bills.items[0]?.due_at > "2026-10-16").toBe(true);
  });
});
