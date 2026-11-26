import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// The emulator mirrors loosely typed Brex JSON; tests read and edit it directly.
export type Row = Record<string, any>;

export interface BrexApiEmulatorOptions {
  /** The one bearer token the emulator accepts. */
  token?: string;
  /** 0 picks a free port. */
  port?: number;
  /** Upper bound on `limit`, so small values exercise paging. Brex allows up to 100. */
  maxPageSize?: number;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: string;
  authorization: string | null;
  idempotencyKey: string | null;
  contentType: string | null;
  body: unknown;
}

export interface InjectedFailure {
  method?: string;
  path?: string;
  status: number;
  body?: unknown;
  /** Let this many matching requests through first. */
  after?: number;
}

const USD = (amount: number) => ({ amount, currency: "USD" });
const ADDRESS = {
  line1: "1 Example Way",
  city: "Springfield",
  state: "CA",
  country: "US",
  postal_code: "00000",
};
const SPEND_LIMIT_ENUMS = [
  "authorization_visibility",
  "auto_create_limit_cards_setting",
  "auto_transfer_cards_setting",
  "expense_visibility",
  "limit_increase_setting",
  "spend_type",
] as const;

const card = (id: string, name: string, lastFour: string, over: Row = {}): Row => ({
  id,
  owner: { type: "USER", user_id: "u_ada" },
  status: "ACTIVE",
  last_four: lastFour,
  card_name: name,
  card_type: "VIRTUAL",
  limit_type: "CARD",
  billing_address: ADDRESS,
  expiration_date: { month: 12, year: 2029 },
  created_at: "2026-01-05T10:00:00Z",
  ...over,
});

const spendLimit = (id: string, name: string, over: Row = {}): Row => ({
  id,
  account_id: "cmp_example",
  name,
  status: "ACTIVE",
  period_recurrence_type: "PER_MONTH",
  start_date: "2026-11-01",
  end_date: "2026-11-30",
  current_period_balance: {
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    amount_spent: USD(0),
  },
  authorization_settings: {
    base_limit: USD(100_000),
    authorization_type: "HARD",
    rollover_refresh_rate: "OFF",
    limit_with_increases: USD(100_000),
  },
  expense_visibility: "SHARED",
  authorization_visibility: "PUBLIC",
  limit_increase_setting: "DISABLED",
  spend_type: "BUDGET_PROVISIONED_CARDS_ONLY",
  auto_transfer_cards_setting: "DISABLED",
  auto_create_limit_cards_setting: "DISABLED",
  expense_policy_id: "pol_software",
  owner_user_ids: ["u_ada"],
  member_user_ids: ["u_ada"],
  ...over,
});

function seed() {
  const day = (i: number) => new Date(Date.UTC(2026, 7, 4 + i)).toISOString().slice(0, 10);
  const merchants = [
    { name: "Figma", mcc: "5734", category: "RECURRING_SOFTWARE_AND_SAAS" },
    { name: "Example Cloud", mcc: "7371", category: "SERVERS" },
    { name: "Example Travel", mcc: "7011", category: "LODGING" },
    { name: "Cafe Example", mcc: "5812", category: "RESTAURANTS" },
    { name: "Example Ads", mcc: "7311", category: "ADVERTISING_AND_MARKETING" },
    { name: "Office Example", mcc: "7299", category: "OFFICE_SUPPLIES" },
  ];
  const users = [
    {
      id: "u_ada",
      first_name: "Ada",
      last_name: "Example",
      email: "ada@example.test",
      status: "ACTIVE",
    },
    {
      id: "u_ben",
      first_name: "Ben",
      last_name: "Sample",
      email: "ben@example.test",
      status: "ACTIVE",
    },
    {
      id: "u_cy",
      first_name: "Cy",
      last_name: "Demo",
      email: "cy@example.test",
      status: "ACTIVE",
    },
  ] as Row[];
  const cards = [
    card("card_figma", "Figma", "4242", {
      spend_controls: {
        spend_limit: USD(50_000),
        spend_duration: "MONTHLY",
        allowed_merchant_details: [{ name: "Figma" }],
      },
    }),
    card("card_ads", "Ad spend", "5555", {
      owner: { type: "USER", user_id: "u_ben" },
      spend_controls: {
        spend_limit: USD(100_000),
        spend_duration: "ONE_TIME",
        lock_after_date: "2026-12-31",
      },
    }),
    card("card_team", "Ada team card", "1111", { limit_type: "USER" }),
    card("card_eur", "Berlin tools", "2222", {
      spend_controls: {
        spend_limit: { amount: 20_000, currency: "EUR" },
        spend_duration: "MONTHLY",
      },
    }),
    card("card_locked", "Locked travel", "3333", {
      status: "LOCKED",
      owner: { type: "USER", user_id: "u_ben" },
      spend_controls: { spend_limit: USD(80_000), spend_duration: "QUARTERLY" },
    }),
    card("card_ended", "Old ads", "4444", {
      status: "TERMINATED",
      owner: { type: "USER", user_id: "u_cy" },
      spend_controls: { spend_limit: USD(25_000), spend_duration: "ONE_TIME" },
    }),
    card("card_yearly", "Yearly cloud", "6666", {
      owner: { type: "USER", user_id: "u_cy" },
      spend_controls: { spend_limit: USD(250_000), spend_duration: "YEARLY" },
    }),
    card("card_onetime", "Launch", "7777", {
      owner: { type: "USER", user_id: "u_ada" },
      spend_controls: { spend_limit: USD(40_000), spend_duration: "ONE_TIME" },
    }),
  ] as Row[];
  const balance = (start: string, end: string, amount: number) => ({
    start_date: start,
    end_date: end,
    amount_spent: USD(amount),
  });
  const spendLimits = [
    spendLimit("sl_template", "Software template", {
      expense_visibility: "PRIVATE",
      authorization_visibility: "PRIVATE",
      limit_increase_setting: "ENABLED",
      spend_type: "NON_BUDGET_PROVISIONED_CARDS_ALLOWED",
      current_period_balance: balance("2026-11-01", "2026-11-30", 18_400),
    }),
    spendLimit("sl_soft", "Soft travel", {
      authorization_settings: {
        base_limit: USD(100_000),
        authorization_type: "SOFT",
        rollover_refresh_rate: "OFF",
      },
      current_period_balance: balance("2026-11-01", "2026-11-30", 7_900),
    }),
    spendLimit("sl_auto", "Everyone", {
      auto_create_limit_cards_setting: "ALL_MEMBERS",
      current_period_balance: balance("2026-11-01", "2026-11-30", 42_300),
    }),
    spendLimit("sl_buffered", "Buffered limit", {
      authorization_settings: {
        base_limit: USD(100_000),
        limit_buffer_percentage: 10,
        authorization_type: "HARD",
        rollover_refresh_rate: "OFF",
      },
      current_period_balance: balance("2026-11-01", "2026-11-30", 3_100),
    }),
    spendLimit("sl_quarterly", "Travel quarter", {
      period_recurrence_type: "PER_QUARTER",
      start_date: "2026-10-01",
      end_date: "2026-12-31",
      current_period_balance: balance("2026-10-01", "2026-12-31", 64_000),
    }),
    spendLimit("sl_yearly", "Cloud year", {
      period_recurrence_type: "PER_YEAR",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      current_period_balance: balance("2026-01-01", "2026-12-31", 212_000),
    }),
    spendLimit("sl_one_time", "Launch", {
      period_recurrence_type: "ONE_TIME",
      start_date: "2026-11-01",
      end_date: "2026-12-15",
      current_period_balance: balance("2026-11-01", "2026-12-15", 12_500),
    }),
  ] as Row[];
  const expenses: Row[] = [
    {
      id: "exp_1",
      memo: null,
      status: "SUBMITTED",
      payment_status: "CLEARED",
      user_id: "u_ada",
      purchased_at: "2026-11-01T10:00:00Z",
      billing_amount: USD(1200),
      category: "RECURRING_SOFTWARE_AND_SAAS",
      expense_type: "CARD",
      receipts: [],
      review: { compliance_status: "DUE" },
      merchant: { raw_descriptor: "Figma", mcc: "5734", country: "US" },
    },
    {
      id: "exp_missing_memo",
      memo: null,
      status: "APPROVED",
      payment_status: "CLEARED",
      user_id: "u_ben",
      purchased_at: "2026-10-28T10:00:00Z",
      billing_amount: USD(2450),
      category: "RESTAURANTS",
      expense_type: "CARD",
      receipts: [{ id: "rcpt_missing_memo" }],
      review: { compliance_status: "DUE" },
      merchant: { raw_descriptor: "Cafe Example", mcc: "5812", country: "US" },
    },
    {
      id: "exp_complete",
      memo: "Client dinner",
      status: "APPROVED",
      payment_status: "CLEARED",
      user_id: "u_cy",
      purchased_at: "2026-10-20T10:00:00Z",
      billing_amount: USD(8700),
      category: "LODGING",
      expense_type: "CARD",
      receipts: [{ id: "rcpt_complete" }],
      review: { compliance_status: "COMPLETED" },
      merchant: {
        raw_descriptor: "Example Travel",
        mcc: "7011",
        country: "US",
      },
    },
  ];
  const transactions: Row[] = [];
  for (let i = 0; i < 90; i += 1) {
    const m = merchants[i % merchants.length]!;
    const amount = 900 + ((i * 791) % 46_000);
    const date = day(i);
    const cardId = ["card_figma", "card_ads", "card_team", "card_eur", "card_yearly"][i % 5]!;
    const userId = i % 3 === 0 ? "u_ben" : i % 3 === 1 ? "u_cy" : "u_ada";
    const expenseId = `exp_${String(i + 1).padStart(3, "0")}`;
    const receipts = i % 4 === 0 ? [] : [{ id: `rcpt_${expenseId}` }];
    const memo = i % 6 === 0 ? null : `${m.name} ${date}`;
    expenses.push({
      id: expenseId,
      memo,
      status: i % 5 === 0 ? "SUBMITTED" : "APPROVED",
      payment_status: "CLEARED",
      user_id: userId,
      purchased_at: `${date}T12:00:00Z`,
      billing_amount: USD(amount),
      category: m.category,
      expense_type: "CARD",
      receipts,
      review: {
        compliance_status: receipts.length && memo ? "COMPLETED" : "DUE",
      },
      merchant: { raw_descriptor: m.name, mcc: m.mcc, country: "US" },
    });
    transactions.push({
      id: `txn_${String(i + 1).padStart(3, "0")}`,
      card_id: cardId,
      description: m.name,
      amount: USD(amount),
      initiated_at_date: date,
      posted_at_date: date,
      type: "PURCHASE",
      merchant: { raw_descriptor: m.name, mcc: m.mcc, country: "US" },
      expense_id: expenseId,
    });
  }
  const reimbursements = [
    ["REIMBURSEMENTS", "Taxi Example", "4121", "OTHER_TRAVEL_EXPENSES", "u_ada", "DUE", false],
    ["Client meals", "Cafe Example", "5812", "RESTAURANTS", "u_ben", "COMPLETED", true],
    ["Laptop repair", "Office Example", "5734", "SOFTWARE_NON_RECURRING", "u_cy", "OVERDUE", false],
    ["Hotel", "Example Travel", "7011", "LODGING", "u_ada", "COMPLETED", true],
    ["Ads", "Example Ads", "7311", "ADVERTISING_AND_MARKETING", "u_ben", "DUE", false],
  ] as const;
  reimbursements.forEach(
    ([merchant, descriptor, mcc, category, userId, compliance, hasReceipt], i) => {
      const id = `exp_reimb_${i + 1}`;
      expenses.push({
        id,
        memo: i === 1 ? null : merchant,
        status: i % 2 ? "APPROVED" : "SUBMITTED",
        payment_status: i % 2 ? "CLEARED" : "AWAITING_PAYMENT",
        user_id: userId,
        purchased_at: `2026-10-${String(12 + i).padStart(2, "0")}T15:00:00Z`,
        billing_amount: USD(4200 + i * 1300),
        category,
        expense_type: "REIMBURSEMENT",
        receipts: hasReceipt ? [{ id: `rcpt_${id}` }] : [],
        review: { compliance_status: compliance },
        merchant: { raw_descriptor: descriptor, mcc, country: "US" },
      });
    },
  );
  return {
    users,
    cards,
    spendLimits,
    expenses,
    transactions,
    trips: [
      {
        id: "trip_1",
        name: "Example offsite",
        status: "UPCOMING",
        booker_user_id: "u_ada",
        starts_at: "2026-12-01T09:00:00Z",
        ends_at: "2026-12-04T17:00:00Z",
        version: 1,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      },
      {
        id: "trip_2",
        name: "Customer visit",
        status: "APPROVED",
        booker_user_id: "u_ben",
        starts_at: "2026-09-14T08:00:00Z",
        ends_at: "2026-09-16T18:00:00Z",
        version: 1,
        created_at: "2026-08-20T00:00:00Z",
        updated_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "trip_3",
        name: "Conference",
        status: "CANCELLED",
        booker_user_id: "u_cy",
        starts_at: "2026-08-10T08:00:00Z",
        ends_at: "2026-08-12T18:00:00Z",
        version: 1,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-15T00:00:00Z",
      },
    ] as Row[],
    cashAccounts: [
      {
        id: "ca_1",
        name: "Operating",
        status: "ACTIVE",
        current_balance: USD(1_234_500),
        available_balance: USD(1_200_000),
        account_number: "000123456789",
        routing_number: "000000000",
        primary: true,
      },
      {
        id: "ca_2",
        name: "Payroll",
        status: "ACTIVE",
        current_balance: USD(480_000),
        available_balance: USD(480_000),
        account_number: "000987654321",
        routing_number: "000000000",
        primary: false,
      },
    ] as Row[],
    cardStatements: [
      {
        id: "st_card_1",
        start_balance: USD(0),
        end_balance: USD(31_000),
        period: { start_date: "2026-08-01", end_date: "2026-08-31" },
      },
      {
        id: "st_card_2",
        start_balance: USD(31_000),
        end_balance: USD(52_000),
        period: { start_date: "2026-09-01", end_date: "2026-09-30" },
      },
      {
        id: "st_card_3",
        start_balance: USD(52_000),
        end_balance: USD(88_400),
        period: { start_date: "2026-10-01", end_date: "2026-10-31" },
      },
      {
        id: "st_card_4",
        start_balance: USD(88_400),
        end_balance: USD(91_800),
        period: { start_date: "2026-11-01", end_date: "2026-11-30" },
      },
    ] as Row[],
    cashStatements: [
      {
        id: "st_cash_1",
        start_balance: USD(1_000_000),
        end_balance: USD(1_234_500),
        period: { start_date: "2026-10-01", end_date: "2026-10-31" },
      },
      {
        id: "st_cash_2",
        start_balance: USD(480_000),
        end_balance: USD(480_000),
        period: { start_date: "2026-11-01", end_date: "2026-11-30" },
      },
    ] as Row[],
  };
}

/**
 * Offline stand-in for the parts of the Brex REST API this package calls (team, budgets,
 * expenses, transactions and travel). Field names follow the Brex OpenAPI specs. Seeded with
 * invented data. It has no `/pan`, `secure_email` or `unlock` route: those answer 404 and are
 * recorded in `requests`, so a test can prove they are never called.
 */
export class BrexApiEmulator {
  /** Replace it to revoke the old token: requests that carry the old one then answer 401. */
  token: string;
  /** Respond 429 (Retry-After: 1) to this many next requests. */
  rateLimitNext = 0;
  /** Answer matching requests with this failure, once each. */
  readonly failNext: InjectedFailure[] = [];
  readonly requests: RecordedRequest[] = [];
  readonly company: Row = {
    id: "cmp_example",
    legal_name: "Example Co",
    mailing_address: ADDRESS,
    accountType: "BREX_EMPOWER",
  };
  /** Expense policies a spend limit may reference. */
  readonly policyIds = new Set(["pol_software"]);
  readonly users: Row[];
  readonly cards: Row[];
  readonly spendLimits: Row[];
  readonly expenses: Row[];
  readonly transactions: Row[];
  readonly trips: Row[];
  readonly cashAccounts: Row[];
  readonly cardStatements: Row[];
  readonly cashStatements: Row[];
  private server: ReturnType<typeof createServer> | undefined;
  private readonly maxPageSize: number;
  private readonly port: number;
  private readonly replays = new Map<string, [number, unknown]>();
  private sequence = 0;

  constructor(options: BrexApiEmulatorOptions = {}) {
    this.token = options.token ?? "bxt_emulator_token";
    this.maxPageSize = options.maxPageSize ?? 100;
    this.port = options.port ?? 0;
    ({
      users: this.users,
      cards: this.cards,
      spendLimits: this.spendLimits,
      expenses: this.expenses,
      transactions: this.transactions,
      trips: this.trips,
      cashAccounts: this.cashAccounts,
      cardStatements: this.cardStatements,
      cashStatements: this.cashStatements,
    } = seed());
  }

  /** Starts listening on 127.0.0.1 and returns the base URL (no trailing slash). */
  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const url = new URL(req.url ?? "/", "http://emulator.test");
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          body = undefined;
        }
        const [status, payload, headers] = this.handle(req.method ?? "GET", url, req.headers, body);
        res.writeHead(status, {
          "content-type": "application/json",
          ...headers,
        });
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(this.port, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }

  private handle(
    method: string,
    url: URL,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): [number, unknown, Record<string, string>?] {
    const header = (name: string) =>
      typeof headers[name] === "string" ? (headers[name] as string) : null;
    const path = url.pathname;
    this.requests.push({
      method,
      path,
      query: url.search,
      authorization: header("authorization"),
      idempotencyKey: header("idempotency-key"),
      contentType: header("content-type"),
      body,
    });
    if (header("authorization") !== `Bearer ${this.token}`) return [401, { error: "unauthorized" }];
    if (this.rateLimitNext > 0) {
      this.rateLimitNext -= 1;
      return [429, { error: "too_many_requests" }, { "retry-after": "1" }];
    }
    const injected = this.failNext.findIndex(
      (f) => (!f.method || f.method === method) && (!f.path || f.path === path),
    );
    const failure = this.failNext[injected];
    if (failure && (failure.after ?? 0) > 0) failure.after = (failure.after ?? 0) - 1;
    else if (failure) {
      this.failNext.splice(injected, 1);
      return [failure.status, failure.body ?? { error: "injected" }];
    }

    const key = header("idempotency-key");
    const replayKey = key && method !== "GET" ? `${method} ${path} ${key}` : undefined;
    const replay = replayKey ? this.replays.get(replayKey) : undefined;
    if (replay) return [replay[0], structuredClone(replay[1])];
    const result = this.route(method, url, body);
    if (replayKey && result[0] === 200)
      this.replays.set(replayKey, [result[0], structuredClone(result[1])]);
    return result;
  }

  private route(method: string, url: URL, body: unknown): [number, unknown] {
    const q = url.searchParams;
    const b = (body ?? {}) as Row;
    const parts = url.pathname.split("/").filter(Boolean);
    const [v, a, c, d] = parts;
    const at = (list: Row[], id: string | undefined) => list.find((row) => row.id === id);
    const found = (row: Row | undefined): [number, unknown] =>
      row ? [200, row] : [404, { error: "not_found" }];

    if (v === "v2" && a === "cards") {
      if (parts.length === 2 && method === "GET")
        return this.page(
          this.cards.filter((x) => !q.get("user_id") || x.owner?.user_id === q.get("user_id")),
          q,
        );
      if (parts.length === 2 && method === "POST") return this.createCard(b);
      const target = at(this.cards, c);
      if (parts.length === 3 && method === "GET") return found(target);
      if (parts.length === 3 && method === "PUT" && target) {
        target.spend_controls = {
          ...target.spend_controls,
          ...b.spend_controls,
        };
        return [200, target];
      }
      if (
        parts.length === 4 &&
        method === "POST" &&
        target &&
        (d === "lock" || d === "terminate")
      ) {
        if (!b.reason) return [400, { error: "reason_required" }];
        target.status = d === "lock" ? "LOCKED" : "TERMINATED";
        return [200, target];
      }
    }
    if (v === "v2" && a === "users" && method === "GET") {
      if (c === "me") return found(this.users[0]);
      if (parts.length === 3) return found(at(this.users, c));
      const emails = q.getAll("email[]").flatMap((e) => e.split(","));
      const name = q.get("name")?.toLowerCase();
      return this.page(
        this.users
          .filter((u) => !emails.length || emails.includes(u.email))
          .filter(
            (u) =>
              !name || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(name),
          ),
        q,
      );
    }
    if (v === "v2" && a === "company" && method === "GET") return [200, this.company];
    if (v === "v2" && a === "spend_limits") {
      if (parts.length === 2 && method === "GET") {
        const members = q.getAll("member_user_id[]");
        return this.page(
          this.spendLimits.filter(
            (x) => !members.length || members.some((m) => x.member_user_ids.includes(m)),
          ),
          q,
        );
      }
      if (parts.length === 2 && method === "POST") return this.createSpendLimit(b);
      const target = at(this.spendLimits, c);
      if (parts.length === 3 && method === "GET") return found(target);
      if (parts.length === 3 && method === "PUT" && target) return this.updateSpendLimit(target, b);
    }
    if (v === "v1" && a === "expenses" && parts.length === 2 && method === "GET") {
      const wanted = q.getAll("expense_type[]");
      const compliance = q.getAll("compliance_status[]");
      const users = q.getAll("user_id[]");
      const purchasedStart = q.get("purchased_at_start");
      const purchasedEnd = q.get("purchased_at_end");
      const rows = this.expenses
        .filter((x) => !wanted.length || wanted.includes(x.expense_type))
        .filter((x) => !compliance.length || compliance.includes(x.review?.compliance_status))
        .filter((x) => !users.length || users.includes(x.user_id))
        .filter(
          (x) =>
            (!purchasedStart || x.purchased_at >= purchasedStart) &&
            (!purchasedEnd || x.purchased_at <= purchasedEnd),
        );
      return this.page(rows, q);
    }
    if (v === "v1" && a === "expenses" && c === "card") {
      if (parts.length === 3 && method === "GET") {
        const wanted = q.getAll("compliance_status[]");
        const users = q.getAll("user_id[]");
        const purchasedStart = q.get("purchased_at_start");
        const purchasedEnd = q.get("purchased_at_end");
        const rows = this.expenses
          .filter((x) => x.expense_type !== "REIMBURSEMENT")
          .filter((x) => !wanted.length || wanted.includes(x.review?.compliance_status))
          .filter((x) => !users.length || users.includes(x.user_id))
          .filter(
            (x) =>
              (!purchasedStart || x.purchased_at >= purchasedStart) &&
              (!purchasedEnd || x.purchased_at <= purchasedEnd),
          );
        return this.page(rows, q);
      }
      const target = at(this.expenses, d);
      if (parts.length === 4 && method === "PUT" && target) {
        if (typeof b.memo === "string") target.memo = b.memo;
        return [200, target];
      }
    }
    if (v === "v2" && a === "transactions" && c === "card" && d === "primary" && method === "GET") {
      const since = q.get("posted_at_start");
      const owners = q.getAll("user_ids");
      const expand = q.getAll("expand[]").includes("expense_id");
      const rows = this.transactions
        .filter((x) => !since || Date.parse(x.posted_at_date) >= Date.parse(since))
        .filter((x) => !owners.length || owners.includes(at(this.cards, x.card_id)?.owner?.user_id))
        .map(({ expense_id, ...rest }) => (expand ? { ...rest, expense_id } : rest));
      return this.page(rows, q);
    }
    if (v === "v1" && a === "trips" && parts.length === 2 && method === "GET")
      return this.page(this.trips, q);
    if (v === "v2" && a === "accounts" && method === "GET") {
      if (c === "cash" && parts.length === 3) return this.page(this.cashAccounts, q);
      if (c === "card" && d === "primary" && parts[4] === "statements")
        return this.page(this.cardStatements, q);
      if (c === "cash" && at(this.cashAccounts, d) && parts[4] === "statements")
        return this.page(this.cashStatements, q);
    }
    return [404, { error: "not_found" }];
  }

  private page(rows: Row[], q: URLSearchParams): [number, unknown] {
    const size = Math.min(Number(q.get("limit")) || 100, this.maxPageSize);
    const start = q.has("cursor") ? Number(Buffer.from(q.get("cursor") ?? "", "base64url")) : 0;
    if (!Number.isInteger(start) || start < 0) return [400, { error: "bad_cursor" }];
    const next = start + size;
    return [
      200,
      {
        items: rows.slice(start, next),
        next_cursor: next < rows.length ? Buffer.from(String(next)).toString("base64url") : null,
      },
    ];
  }

  private createCard(b: Row): [number, unknown] {
    for (const field of ["owner", "card_name", "card_type", "limit_type"])
      if (!b[field]) return [400, { error: `${field}_required` }];
    if (!this.users.some((u) => u.id === b.owner?.user_id))
      return [400, { error: "unknown_owner" }];
    if (
      b.limit_type === "CARD" &&
      !(b.spend_controls?.spend_limit && b.spend_controls?.spend_duration)
    )
      return [400, { error: "spend_controls_required" }];
    const n = ++this.sequence;
    const created = card(`card_new_${n}`, b.card_name, String(7000 + n), {
      owner: b.owner,
      card_type: b.card_type,
      limit_type: b.limit_type,
      ...(b.spend_controls ? { spend_controls: b.spend_controls } : {}),
    });
    this.cards.push(created);
    return [200, created];
  }

  private createSpendLimit(b: Row): [number, unknown] {
    const settings = b.authorization_settings;
    for (const field of [
      "name",
      "period_recurrence_type",
      "authorization_settings",
      ...SPEND_LIMIT_ENUMS,
    ])
      if (!b[field]) return [400, { error: `${field}_required` }];
    if (!(settings.base_limit && settings.authorization_type && settings.rollover_refresh_rate))
      return [400, { error: "authorization_settings_incomplete" }];
    if (!b.expense_policy_id || !this.policyIds.has(b.expense_policy_id))
      return [400, { error: "unknown_expense_policy" }];
    const created = spendLimit(`sl_new_${++this.sequence}`, b.name, {
      ...b,
      authorization_settings: {
        ...settings,
        limit_with_increases: settings.base_limit,
      },
      owner_user_ids: b.owner_user_ids ?? [],
      member_user_ids: b.member_user_ids ?? [],
    });
    this.spendLimits.push(created);
    return [200, created];
  }

  private updateSpendLimit(target: Row, b: Row): [number, unknown] {
    if (b.expense_policy_id && !this.policyIds.has(b.expense_policy_id))
      return [400, { error: "unknown_expense_policy" }];
    const { authorization_settings: settings, ...rest } = b;
    Object.assign(target, rest);
    if (settings) Object.assign(target.authorization_settings, settings);
    return [200, target];
  }
}
