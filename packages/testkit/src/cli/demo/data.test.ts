import {
  createRpcClient,
  fetchChainSnapshot,
  fetchPrices,
  McpSession,
  ThirdPartyConnectorEmulator,
} from "@rakazo/adapters";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CapTableSnapshotInputSchema,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  DEMO_ARCHIVED_BOT,
  DEMO_ARTIFACTS,
  DEMO_BOTS,
  DEMO_CAP_TABLE,
  DEMO_CHIEF_DRAFT,
  DEMO_CHIEF_DRAFT_V1,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENT_FACETS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_RUNNING_RUN,
  DEMO_USER_NAME,
  DEMO_WAITING_RUN,
  DEMO_WALLET,
  demoCarta,
  demoCrypto,
  demoFinance,
  demoFolderPaths,
  demoMailboxes,
  demoStatementCsv,
  linkDemoArtifacts,
  MOCK_NOTE,
  MOCK_SUBJECT_PREFIX,
} from "./data.js";

describe("mock demo data", () => {
  it("links Chief's mentions of an artifact to that artifact", () => {
    const ids = new Map([["MOCK Q3 Board Deck.md", "art1"]]);
    expect(linkDemoArtifacts("See {artifact:MOCK Q3 Board Deck.md}.", ids)).toBe(
      "See [MOCK Q3 Board Deck](/app/artifacts/art1).",
    );
    expect(linkDemoArtifacts("See {artifact:Missing.md}.", ids)).toBe("See Missing.");
  });

  it("parks one mock run on a question for a bot the seed creates", () => {
    expect(DEMO_BOTS.map((bot) => bot.name)).toContain(DEMO_WAITING_RUN.botName);
    expect(DEMO_WAITING_RUN.intro.startsWith(MOCK_NOTE)).toBe(true);
    expect(DEMO_WAITING_RUN.question.endsWith("?")).toBe(true);
  });

  it("labels the company and every contact and document as mock", () => {
    expect(DEMO_COMPANY.startsWith("MOCK DEMO DATA —")).toBe(true);
    expect(DEMO_EMPTY_SPACE.startsWith("MOCK DEMO DATA —")).toBe(true);
    for (const contact of DEMO_CONTACTS) expect(contact.notes).toContain(MOCK_NOTE);
    expect(DEMO_CHIEF_DRAFT.name).toContain("MOCK");
    expect(DEMO_CHIEF_DRAFT.text).toContain(MOCK_NOTE);
    expect(DEMO_CHIEF_DRAFT_V1.name).toBe(DEMO_CHIEF_DRAFT.name);
    for (const artifact of [DEMO_CHIEF_DRAFT_V1, ...DEMO_ARTIFACTS]) {
      expect(artifact.name).toContain("MOCK");
      expect(artifact.text).toContain(MOCK_NOTE);
    }
    expect(DEMO_ARCHIVED_BOT.description).toContain(MOCK_NOTE);
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

  it("builds a valid mock cap table whose investors match the demo contacts", () => {
    const snapshot = CapTableSnapshotInputSchema.parse(DEMO_CAP_TABLE);
    expect(snapshot.companyName).toBe(DEMO_COMPANY);
    expect(snapshot.shareClasses.reduce((sum, c) => sum + c.percent, 0)).toBe(100);
    const contactEmails = new Set(DEMO_CONTACTS.map((c) => c.email));
    const investors = snapshot.holders.filter((h) => h.security === "SAFE");
    expect(investors.length).toBeGreaterThan(0);
    for (const holder of investors) expect(contactEmails.has(holder.email ?? "")).toBe(true);
  });

  it("gives every mock Data room document a type and date for the list columns", () => {
    expect(Object.keys(DEMO_DOCUMENT_FACETS).sort()).toEqual(
      // The unreadable scan stays unclassified, so the failed state shows.
      DEMO_DOCUMENTS.filter((d) => d.kind !== "broken")
        .map((d) => d.name)
        .sort(),
    );
  });

  it("has a mock cap table whose holdings, option pool and fully diluted total add up", () => {
    const snapshot = CapTableSnapshotInputSchema.parse(DEMO_CAP_TABLE);
    const held = snapshot.holders.reduce((sum, h) => sum + (h.shares ?? 0), 0);
    const pool = snapshot.shareClasses.find((c) => /option pool/i.test(c.name))?.shares ?? 0;
    // The pool class counts options already granted (held below); only the rest is still available.
    expect(snapshot.optionPoolAvailable).toBeLessThanOrEqual(pool);
    expect(held + (snapshot.optionPoolAvailable ?? 0)).toBe(snapshot.fullyDilutedShares);
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

  it("matches the story catalog's seed: Maya Chen, six artifacts and a working run off the group", () => {
    expect(DEMO_USER_NAME).toBe("Maya Chen (Mock)");
    // The investor update draft is seeded on top of these, as a second version.
    expect(DEMO_ARTIFACTS).toHaveLength(5);
    expect(DEMO_RUNNING_RUN.bot.description).toContain(MOCK_NOTE);
    expect(DEMO_RUNNING_RUN.prompt).toContain("mock");
    expect(DEMO_BOTS.map((bot) => bot.name)).not.toContain(DEMO_RUNNING_RUN.bot.name);
  });
});
