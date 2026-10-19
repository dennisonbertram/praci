import type { FinanceCallTool } from "./finance-sync.js";

/**
 * Canned Mercury and Brex tool servers for tests. The response shapes are copied from the live MCP
 * servers; every name, id and amount is made up.
 */

export interface FakeCalls {
  calls: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface MercuryRow {
  id: string;
  counterpartyName: string | null;
  amount: number;
  date: string;
  status: string;
  kind: string;
  category: string | null;
  dashboardLink: string | null;
  counterpartyLogoUrl: null;
}

export const mercuryRow = (id: string, over: Partial<MercuryRow> = {}): MercuryRow => ({
  id,
  counterpartyName: "Acme Hosting",
  amount: -12.34,
  date: "2026-09-10T01:00:00.000000Z",
  status: "sent",
  kind: "other",
  category: "Software",
  dashboardLink: `https://app.example.test/transactions/${id}`,
  counterpartyLogoUrl: null,
  ...over,
});

export const MERCURY_CHECKING = "chk-1111";
export const MERCURY_SAVINGS = "sav-2222";

export function mercuryAccountsResponse(
  extra: Array<Record<string, unknown>> = [],
): Record<string, unknown> {
  return {
    accounts: [
      {
        id: MERCURY_CHECKING,
        name: "Mercury Checking ••1111",
        lastFour: "1111",
        status: "active",
        type: "mercury",
        kind: "checking",
        isCredit: false,
        availableBalance: 1000.5,
        dashboardLink: "https://app.example.test/accounts/chk-1111",
      },
      {
        id: MERCURY_SAVINGS,
        name: "Mercury Savings ••2222",
        lastFour: "2222",
        status: "active",
        type: "mercury",
        kind: "savings",
        isCredit: false,
        availableBalance: 250,
        dashboardLink: "https://app.example.test/accounts/sav-2222",
      },
      ...extra,
    ],
    totalAvailableBalance: 1250.5,
    totalIncludesAllAccounts: true,
    asOf: "2026-10-14T18:00:00.000Z",
  };
}

export const mercuryTreasuryResponse = {
  accounts: [
    {
      id: "trs-3333",
      status: "active",
      createdAt: "2024-01-01T00:00:00.000Z",
      availableBalance: 5000.25,
      currentBalance: 5000.25,
      netReturns: [
        {
          month: "2026-09-01",
          netAmount: 90,
          dividends: [
            { id: "d1", type: [], securityName: "Example Money Market Fund", amount: 100 },
            { id: "d2", type: [], securityName: "Example Money Market Fund", amount: 10.5 },
          ],
          treasuryFee: -20.5,
          status: "charged",
        },
      ],
    },
  ],
  page: {},
};

export interface MercuryOptions {
  /** Rows per account id, newest first. */
  txns: Record<string, MercuryRow[]>;
  accounts?: Record<string, unknown>;
  treasury?: Record<string, unknown>;
  /** Answer pages larger than this as truncated. */
  truncateAbove?: number;
  /** Return the cursor like the vendor documents it; the live server leaves `page` out. */
  withNextPage?: boolean;
  attachments?: Array<Record<string, unknown>>;
  /** Payees `getRecipients` lists, so a payment request can name one. */
  recipients?: Array<Record<string, unknown>>;
}

/**
 * The emulated Mercury. `requestSendMoney` only records the call and returns a made-up request id;
 * it exists for offline write tests and the demo, and this file is imported by neither production code
 * nor the package index.
 */
export function fakeMercury(
  options: MercuryOptions,
): { callTool: FinanceCallTool; sendMoneyRequests: Array<Record<string, unknown>> } & FakeCalls {
  const calls: FakeCalls["calls"] = [];
  const sendMoneyRequests: Array<Record<string, unknown>> = [];
  const callTool: FinanceCallTool = async (name, args) => {
    calls.push({ name, args });
    if (name === "requestSendMoney") {
      sendMoneyRequests.push(args);
      return { requestId: `fake-request-${sendMoneyRequests.length}`, status: "pendingApproval" };
    }
    if (name === "getAccounts") return options.accounts ?? mercuryAccountsResponse();
    if (name === "getRecipients")
      return {
        recipients: options.recipients ?? [
          { id: "recipient_mock_acme", name: "Acme (Mock)", status: "active" },
        ],
      };
    if (name === "getTreasury") return options.treasury ?? mercuryTreasuryResponse;
    if (name === "getTransactionById")
      return { transaction: { id: args.transactionId, attachments: options.attachments } };
    if (name === "getAttachment")
      return { url: "https://files.example.test/receipt.pdf?sig=1", fileName: "receipt.pdf" };
    if (name !== "listTransactions") throw new Error(`unexpected tool ${name}`);
    const limit = Number(args.limit);
    if (options.truncateAbove && limit > options.truncateAbove)
      return { transactions: [], totalFetched: 0, truncatedAt: 12345 };
    const statuses = (args.status as string[] | undefined) ?? ["pending", "sent"];
    const start = args.postedStart as string | undefined;
    const all = (options.txns[(args.accountId as string[])[0] ?? ""] ?? []).filter(
      (r) => statuses.includes(r.status) && (!start || r.status === "pending" || r.date >= start),
    );
    const from = args.start_after ? all.findIndex((r) => r.id === args.start_after) + 1 : 0;
    const page = all.slice(from, from + limit);
    const more = from + limit < all.length;
    return {
      transactions: page,
      totalFetched: page.length,
      truncatedAt: null,
      ...(options.withNextPage && more ? { page: { nextPage: page.at(-1)?.id } } : {}),
    };
  };
  return { callTool, calls, sendMoneyRequests };
}

export const brexAccountsResponse = {
  items: [
    {
      id: "dpacc_1",
      name: "Acme business account",
      nickname: "Primary business account",
      account_number_last_four: "",
      account_type: "LEGACY_CASH",
      status: "ACTIVE",
      balance_breakdown: {
        available_balance: { value: "300.10", currency: "USD", display: "$300.10 USD" },
      },
    },
    {
      id: "dpacc_card",
      name: "Acme card account",
      account_number_last_four: "9999",
      account_type: "CARD",
      status: "ACTIVE",
      balance_breakdown: {
        available_balance: { value: "50000.00", currency: "USD", display: "$50,000.00 USD" },
      },
    },
  ],
  next_cursor: null,
};

export interface BrexExpense extends Record<string, unknown> {
  id: string;
  purchased_at: string;
}

export const brexExpense = (id: string, over: Record<string, unknown> = {}): BrexExpense => ({
  id,
  type: "CARD",
  status: "APPROVED",
  payment_status: "CLEARED",
  receipt_count: 0,
  user: { id: "cuuser_1", first_name: "Ada", last_name: "Example", email: "ada@example.test" },
  memo: "",
  receipts: [],
  purchased_at: "2026-09-10T12:00:00.000Z",
  posted_at: "2026-09-11T00:00:00.000Z",
  merchant: { id: "pmch_1", name: "Globex Cloud" },
  merchant_category: { id: "pmca_1", name: "Servers" },
  original_amount: { value: "42.50", currency: "USD", display: "$42.50 USD" },
  purchased_amount: { value: "42.50", currency: "USD", display: "$42.50 USD" },
  amount: { value: "42.50", currency: "USD", display: "$42.50 USD" },
  vendor: { id: "pmch_1", name: "Globex Cloud", email: null },
  card: { id: "ncard_1", last4: "4242", partner: null },
  ...over,
});

export interface BrexOptions {
  expenses: BrexExpense[];
  bills?: unknown[];
  receipts?: Array<{ download_uri: string }> | null;
}

export function fakeBrex(options: BrexOptions): { callTool: FinanceCallTool } & FakeCalls {
  const calls: FakeCalls["calls"] = [];
  const callTool: FinanceCallTool = async (name, args) => {
    calls.push({ name, args });
    if (typeof args.intent !== "string" || !args.intent) throw new Error("intent is required");
    if (name === "list_business_accounts") return brexAccountsResponse;
    if (name === "get_expense_by_id") return { id: args.id, receipts: options.receipts ?? null };
    if (name !== "list_expenses" && name !== "list_bills")
      throw new Error(`unexpected tool ${name}`);
    const source =
      name === "list_bills"
        ? (options.bills ?? [])
        : options.expenses.filter(
            (e) => !args.purchased_at_start || e.purchased_at >= String(args.purchased_at_start),
          );
    const limit = Math.min(Number(args.limit ?? 10), 100);
    const from = args.cursor ? Number(args.cursor) : 0;
    const items = source.slice(from, from + limit);
    return { items, next_cursor: from + limit < source.length ? String(from + limit) : null };
  };
  return { callTool, calls };
}

/**
 * A JSON-RPC MCP server over `fetch` for the emulated Mercury, so a real `McpConnector` can talk to
 * it offline. Lists a read tool and the write tool; calls go to `mercury.callTool`.
 */
export function fakeMercuryMcpFetch(mercury: Pick<ReturnType<typeof fakeMercury>, "callTool">) {
  const tools = ["getAccounts", "requestSendMoney"].map((name) => ({
    name,
    inputSchema: { type: "object" },
  }));
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const message = JSON.parse(await request.text()) as {
      id?: number;
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id: message.id, result });
    if (message.method === "initialize")
      return reply({
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "fake-mercury", version: "1" },
      });
    if (message.method === "tools/list") return reply({ tools });
    if (message.method === "tools/call") {
      const result = await mercury.callTool(
        message.params?.name ?? "",
        message.params?.arguments ?? {},
      );
      return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
    }
    return new Response(null, { status: 202 });
  };
}
