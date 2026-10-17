import { describe, expect, it } from "vitest";
import {
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  demoFinance,
  demoFolderPaths,
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

  it("builds two mock mailboxes with a Cc thread, sent mail and attachments of every size", () => {
    const boxes = demoMailboxes();
    const { messages } = boxes["mock-demo-mailbox"];
    for (const message of [...messages, ...boxes["mock-demo-sales"].messages]) {
      expect(message.subject).toMatch(/^(Re: )?\[MOCK\] /);
      expect(message.text).toContain(MOCK_NOTE);
    }
    expect(new Set(messages.map((m) => m.threadId)).size).toBe(26);
    expect(messages.some((m) => m.labels.includes("UNREAD"))).toBe(true);
    const redlines = messages.filter((m) => m.threadId.endsWith("msa-redlines"));
    expect(redlines).toHaveLength(4);
    expect(redlines.every((m) => m.cc)).toBe(true);
    expect(redlines.filter((m) => m.labels.includes("SENT"))).toHaveLength(1);
    expect(redlines.at(-1)?.subject).toBe(
      `Re: ${MOCK_SUBJECT_PREFIX} Redlines on the Master Services Agreement`,
    );
    const sizes = messages.flatMap((m) => m.attachments ?? []).map((a) => a.data?.length ?? 0);
    expect(sizes.some((size) => size > 10 * 1024 * 1024)).toBe(true);
    expect(boxes["mock-demo-sales"].messages.length).toBeGreaterThan(0);
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
