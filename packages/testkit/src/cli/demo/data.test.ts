import { McpSession, ThirdPartyConnectorEmulator } from "@rakazo/adapters";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CapTableSnapshotInputSchema,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  DEMO_CAP_TABLE,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  demoCarta,
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

  it("has a valid mock cap table whose classes add up to the fully diluted count", () => {
    const table = CapTableSnapshotInputSchema.parse(DEMO_CAP_TABLE);
    expect(table.companyName).toBe(DEMO_COMPANY);
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    expect(sum(table.shareClasses.map((c) => c.shares))).toBe(table.fullyDilutedShares);
    expect(sum(table.shareClasses.map((c) => c.percent))).toBe(100);
    for (const holder of table.holders)
      expect(`${holder.name} ${holder.organization ?? ""}`).toMatch(/Mock|Placeholder|Notareal/);
  });

  it("answers the Carta agent's read tools from the mock cap table, only when signed in", async () => {
    const emulator = new ThirdPartyConnectorEmulator({
      [new URL(CARTA_MCP_ENDPOINT).hostname]: demoCarta(),
    });
    const call = async (method: string, params: unknown, token?: string) => {
      const response = await emulator.fetch(CARTA_MCP_ENDPOINT, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      return (await response.json()) as {
        result?: { tools?: { name: string }[]; content?: { text: string }[] };
        error?: unknown;
      };
    };
    const listed = await call("tools/list", {}, "mock");
    const names = listed.result?.tools?.map((tool) => tool.name) ?? [];
    expect(names).toContain("cap_table_chart");
    for (const name of names) expect(CARTA_READ_TOOLS).toContain(name);

    const chart = await call("tools/call", { name: "cap_table_chart", arguments: {} }, "mock");
    const table = JSON.parse(chart.result?.content?.[0]?.text ?? "{}");
    expect(table.companyName).toBe(DEMO_COMPANY);
    expect(table.optionPoolAvailable).toBe(600_000);
    expect(table.safes.map((safe: { amountUsd: number }) => safe.amountUsd)).toEqual([
      250_000, 50_000,
    ]);

    expect(
      (await call("tools/call", { name: "cap_table_chart", arguments: {} })).error,
    ).toBeDefined();

    // The agent's own MCP session (signed in with a stored login) reaches the same tools.
    const session = new McpSession();
    await session.connectRemote({
      url: CARTA_MCP_ENDPOINT,
      transport: "streamable-http",
      network: { fetch: emulator.fetch, resolveHostname: emulator.resolveHostname },
      headerPolicy: { headers: { Authorization: "Bearer mock-demo-token" } },
      fallbackToSse: false,
      timeoutMs: 5_000,
    });
    const { tools } = await session.listTools();
    expect(tools.map((tool) => tool.name)).toContain("cap_table_chart");
    const result = await session.callTool("cap_table_chart");
    expect(JSON.stringify(result.content)).toContain("Quill Capital (Mock)");
    await session.close();
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
