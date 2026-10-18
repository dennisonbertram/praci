import { generateKeyPairSync } from "node:crypto";
import {
  createRpcClient,
  fetchChainSnapshot,
  fetchExchangeBalances,
  fetchPrices,
  McpSession,
  parseStatement,
  ThirdPartyConnectorEmulator,
} from "@rakazo/adapters";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CapTableSnapshotInputSchema,
  FINANCE_MCP_ENDPOINTS,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  DEMO_CAP_TABLE,
  DEMO_CHIEF_DRAFT,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENT_FACETS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_WALLET,
  demoCarta,
  demoCrypto,
  demoFinance,
  demoFinanceMcp,
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
    expect(DEMO_CHIEF_DRAFT.name).toContain("MOCK");
    expect(DEMO_CHIEF_DRAFT.text).toContain(MOCK_NOTE);
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

  it("advertises only tools whose handlers work with the arguments the schema requires", async () => {
    const servers = demoFinanceMcp("http://127.0.0.1:5374");
    for (const provider of ["mercury", "brex"] as const) {
      const server = servers[new URL(FINANCE_MCP_ENDPOINTS[provider]).hostname];
      expect(server?.tools.length).toBeGreaterThan(0);
      for (const tool of server?.tools ?? []) {
        const schema = tool.inputSchema as {
          properties: Record<string, { type: string }>;
          required: string[];
        };
        const args = Object.fromEntries(
          schema.required.map((key) => [
            key,
            schema.properties[key]?.type === "array"
              ? ["x"]
              : schema.properties[key]?.type === "number"
                ? 10
                : "x",
          ]),
        );
        const result = await server?.call(tool.name, args);
        expect(result, `${provider} ${tool.name}`).not.toHaveProperty("error");
      }
    }
  });

  it("lets Mercury and Brex sign in and answer their tools in the demo", async () => {
    const emulator = new ThirdPartyConnectorEmulator(demoFinanceMcp("http://127.0.0.1:5374"));
    for (const provider of ["mercury", "brex"] as const) {
      const endpoint = FINANCE_MCP_ENDPOINTS[provider];
      // Unsigned calls ask for a sign-in whose page is the app's own callback with a mock code.
      const refused = await emulator.fetch(endpoint, { method: "POST", body: "{}" });
      expect(refused.status).toBe(401);
      const meta = await emulator.fetch(
        `${new URL(endpoint).origin}/.well-known/oauth-authorization-server`,
      );
      expect(
        ((await meta.json()) as { authorization_endpoint: string }).authorization_endpoint,
      ).toBe(`http://127.0.0.1:5374/mcp/oauth/callback?code=mock-demo-${provider}-code`);
    }
    const response = await emulator.fetch(FINANCE_MCP_ENDPOINTS.mercury, {
      method: "POST",
      headers: { authorization: "Bearer mock-demo-token" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "getAccounts", arguments: {} },
      }),
    });
    const body = (await response.json()) as { result: { content: { text: string }[] } };
    expect(body.result.content[0]?.text).toContain("MOCK Checking");
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

  it("builds last month's mock statement that names its bank and whose balances add up", async () => {
    const { fileName, body } = demoStatementCsv(new Date("2026-10-16T12:00:00Z"));
    expect(fileName).toBe("mock-community-bank-2026-09.csv");
    const { statement, check } = await parseStatement(
      { fileName, bytes: new TextEncoder().encode(body) },
      {},
    );
    expect(statement).toMatchObject({
      institution: "MOCK Community Bank",
      accountLast4: "5502",
      openingBalanceCents: 1_000_000,
      closingBalanceCents: 1_050_000,
    });
    expect(check).toEqual({ balances: "match", differenceCents: 0 });
    for (const t of statement.transactions) {
      expect(t.date.startsWith("2026-09-")).toBe(true);
      expect(t.description).toContain("(Mock)");
    }
  });

  it("serves the finance history the Finance stories need, without a negative checking balance", async () => {
    const now = new Date("2026-10-16T12:00:00Z");
    const { callToolFor } = demoFinance(now);
    const mercury = await callToolFor({ id: "s", provider: "mercury", endpoint: "" } as never);
    const brex = await callToolFor({ id: "s", provider: "brex", endpoint: "" } as never);
    const accounts = (await mercury("getAccounts", {})) as {
      accounts: Array<{ id: string; availableBalance: number }>;
    };
    const checking = (await mercury("listTransactions", {
      accountId: ["chk-1111"],
      limit: 1000,
      status: ["sent"],
    })) as { transactions: Array<{ amount: number; date: string; category: string | null }> };
    // Rebuilt backward from today, the balance never goes below zero.
    let cents = Math.round(
      (accounts.accounts.find((a) => a.id === "chk-1111")?.availableBalance ?? 0) * 100,
    );
    for (const t of [...checking.transactions].sort((a, b) => b.date.localeCompare(a.date))) {
      cents -= Math.round(t.amount * 100);
      expect(cents).toBeGreaterThanOrEqual(0);
    }
    const months = new Set(checking.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(7);
    expect(checking.transactions.some((t) => t.amount === -48_000)).toBe(true);

    const expenses = (await brex("list_expenses", { intent: "test", limit: 100 })) as {
      items: Array<{
        purchased_at: string;
        memo: string;
        merchant_category: { name: string };
        amount: { currency: string };
      }>;
    };
    const all = [...expenses.items];
    for (let cursor = "100"; ; ) {
      const next = (await brex("list_expenses", { intent: "test", limit: 100, cursor })) as {
        items: typeof all;
        next_cursor: string | null;
      };
      all.push(...next.items);
      if (!next.next_cursor) break;
      cursor = next.next_cursor;
    }
    const thisMonth = new Set([
      ...all
        .filter((e) => e.purchased_at.startsWith("2026-10"))
        .map((e) => e.merchant_category.name),
      ...checking.transactions
        .filter((t) => t.date.startsWith("2026-10") && t.amount < 0 && t.category)
        .map((t) => t.category),
    ]);
    expect(thisMonth.size).toBeGreaterThanOrEqual(8);
    expect(all.some((e) => e.amount.currency === "EUR")).toBe(true);
    expect(all.some((e) => /\$\d/.test(e.memo))).toBe(true);
    // Each memo says what the charge was for (a vendor page lists them), and stays marked Mock.
    for (const e of all) {
      expect(e.memo).toMatch(/\(Mock\)$/);
      expect(e.memo).not.toBe(MOCK_NOTE);
    }
    const treasury = (await mercury("getTreasury", {})) as {
      accounts: Array<{ netReturns: unknown[] }>;
    };
    expect(treasury.accounts[0]?.netReturns).toHaveLength(6);
  });

  it("reads the Coinbase and Kraken fakes with any well-formed key", async () => {
    const { fetch } = demoCrypto();
    const kraken = await fetchExchangeBalances(
      "kraken",
      { key: "mock-key", secret: "bW9jay1zZWNyZXQ=" },
      { fetch },
    );
    expect(kraken.map((b) => b.code).sort()).toEqual(["XETH", "ZUSD"]);
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const coinbase = await fetchExchangeBalances(
      "coinbase",
      { key: "mock-key", secret: privateKey.export({ type: "sec1", format: "pem" }).toString() },
      { fetch },
    );
    expect(new Set(coinbase.map((b) => b.code))).toEqual(new Set(["USD", "BTC", "USDC"]));
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
