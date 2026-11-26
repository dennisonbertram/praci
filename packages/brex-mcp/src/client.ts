import { BrexCardDurationSchema } from "@rakazo/contracts";
import * as z from "zod";

// Response schemas keep only the fields this package reads (and drop the rest on purpose: card
// numbers, account and routing numbers never enter memory). Field names are from the Brex OpenAPI
// specs (team, budgets, expenses, transactions, travel); unknown extra fields are ignored.
const Money = z.object({
  amount: z.number().int(),
  currency: z.string().nullish(),
});
const Merchant = z.object({ name: z.string() });
const MerchantDetails = z.object({
  raw_descriptor: z.string(),
  mcc: z.string().nullish(),
  country: z.string().nullish(),
});

const SpendControl = z.object({
  spend_limit: Money.nullish(),
  spend_duration: BrexCardDurationSchema.nullish(),
  lock_after_date: z.string().nullish(),
  allowed_merchant_details: z.array(Merchant).nullish(),
  blocked_merchant_details: z.array(Merchant).nullish(),
  reason: z.string().nullish(),
});

export const BrexCardSchema = z.object({
  id: z.string(),
  owner: z.object({ user_id: z.string().nullish() }).nullish(),
  status: z.string().nullish(),
  last_four: z.string(),
  card_name: z.string().nullish(),
  card_type: z.string().nullish(),
  limit_type: z.string(),
  spend_controls: SpendControl.nullish(),
});
export type BrexCard = z.infer<typeof BrexCardSchema>;

export const BrexUserSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().nullish(),
  status: z.string().nullish(),
});
export type BrexUser = z.infer<typeof BrexUserSchema>;

export const BrexSpendLimitSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  period_recurrence_type: z.string(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  current_period_balance: z
    .object({
      start_date: z.string().nullish(),
      end_date: z.string().nullish(),
      amount_spent: Money.nullish(),
    })
    .nullish(),
  authorization_settings: z
    .object({
      base_limit: Money,
      limit_buffer_percentage: z.number().nullish(),
      authorization_type: z.string(),
      rollover_refresh_rate: z.string().nullish(),
    })
    .nullish(),
  expense_visibility: z.string(),
  authorization_visibility: z.string(),
  limit_increase_setting: z.string(),
  spend_type: z.string(),
  auto_transfer_cards_setting: z.string(),
  auto_create_limit_cards_setting: z.string(),
  expense_policy_id: z.string(),
  member_user_ids: z.array(z.string()),
});
export type BrexSpendLimit = z.infer<typeof BrexSpendLimitSchema>;

export const BrexExpenseSchema = z.object({
  id: z.string(),
  memo: z.string().nullish(),
  status: z.string().nullish(),
  payment_status: z.string().nullish(),
  purchased_at: z.string().nullish(),
  billing_amount: Money.nullish(),
  user_id: z.string().nullish(),
  category: z.string().nullish(),
  expense_type: z.string().nullish(),
  receipts: z.array(z.object({ id: z.string() })).nullish(),
  review: z.object({ compliance_status: z.string().nullish() }).nullish(),
  merchant: MerchantDetails.nullish(),
});
export type BrexExpense = z.infer<typeof BrexExpenseSchema>;

export const BrexTransactionSchema = z.object({
  id: z.string(),
  card_id: z.string().nullish(),
  description: z.string(),
  amount: Money,
  posted_at_date: z.string(),
  initiated_at_date: z.string().nullish(),
  type: z.string().nullish(),
  merchant: MerchantDetails.nullish(),
  expense_id: z.string().nullish(),
});
export type BrexTransaction = z.infer<typeof BrexTransactionSchema>;

export const BrexTripSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  status: z.string(),
  booker_user_id: z.string(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
});
export type BrexTrip = z.infer<typeof BrexTripSchema>;

export const BrexCashAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().nullish(),
  current_balance: Money,
  available_balance: Money,
  primary: z.boolean(),
});
export type BrexCashAccount = z.infer<typeof BrexCashAccountSchema>;

export const BrexStatementSchema = z.object({
  id: z.string(),
  start_balance: Money.nullish(),
  end_balance: Money.nullish(),
  period: z.object({ start_date: z.string(), end_date: z.string() }),
});
export type BrexStatement = z.infer<typeof BrexStatementSchema>;

const Company = z.object({ id: z.string(), legal_name: z.string() });

export type BrexErrorKind =
  | "auth" // 401 or 403: the token is wrong or lacks the scope
  | "client" // another 4xx: Brex refused the request
  | "rate_limit" // 429 after every retry
  | "unavailable" // 5xx
  | "network" // no answer: connection failure or timeout
  | "mapping" // 2xx with a body that is not what the spec says
  | "incomplete"; // paging stopped before the last page

/**
 * A Brex call failed. The message never carries the token or a response body. `definite` is true
 * when Brex answered and refused, so the request had no effect; false when the outcome is unknown.
 */
export class BrexError extends Error {
  readonly definite: boolean;
  constructor(
    readonly kind: BrexErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BrexError";
    this.definite = kind === "auth" || kind === "client" || kind === "rate_limit";
  }
}

export interface Paged<T> {
  items: T[];
  complete: boolean;
  /** Why paging stopped early; items holds what was read before that. */
  error?: BrexError;
}

export interface BrexClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Replaceable in tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
}

type Query = Record<string, string | string[] | undefined>;

const MAX_RETRIES = 4;
const MAX_BACKOFF_MS = 30_000;
const MAX_PAGES = 50;
const PAGE_SIZE = "100";

export function createBrexClient(options: BrexClientOptions) {
  const baseUrl = (options.baseUrl ?? "https://api.brex.com").replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = options.random ?? Math.random;
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    schema: z.ZodType<T>,
    init: { query?: Query; body?: object; key?: string } = {},
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [name, value] of Object.entries(init.query ?? {}))
      for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value])
        url.searchParams.append(name, v);
    const headers: Record<string, string> = {
      authorization: `Bearer ${options.token}`,
      accept: "application/json",
    };
    if (init.body) headers["content-type"] = "application/json";
    if (init.key) headers["idempotency-key"] = init.key;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await doFetch(url, {
          method,
          headers,
          ...(init.body ? { body: JSON.stringify(init.body) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Deliberately drops the cause: it can echo the URL or headers.
        throw new BrexError("network", "Brex did not answer");
      }
      if (res.status === 429) {
        await res.body?.cancel().catch(() => {});
        if (attempt >= MAX_RETRIES) throw new BrexError("rate_limit", "Brex rate limit", 429);
        const retryAfter = Number(res.headers.get("retry-after"));
        const base =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        await sleep(Math.min(base + random() * 250, MAX_BACKOFF_MS));
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        if (res.status === 401 || res.status === 403)
          throw new BrexError("auth", "Brex rejected the token or its scope", res.status);
        if (res.status >= 500)
          throw new BrexError("unavailable", `Brex is unavailable (${res.status})`, res.status);
        throw new BrexError("client", `Brex refused the request (${res.status})`, res.status);
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new BrexError("mapping", "Brex sent a body that is not JSON", res.status);
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success)
        throw new BrexError("mapping", "Brex sent an unexpected response", res.status);
      return parsed.data;
    }
  }

  async function paginate<T>(
    path: string,
    item: z.ZodType<T>,
    query: Query = {},
  ): Promise<Paged<T>> {
    const Page = z.object({
      next_cursor: z.string().nullish(),
      items: z.array(item),
    });
    const items: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      let result: z.infer<typeof Page>;
      try {
        result = await request("GET", path, Page, {
          query: { ...query, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        });
      } catch (error) {
        if (error instanceof BrexError) return { items, complete: false, error };
        throw error;
      }
      items.push(...result.items);
      if (!result.next_cursor) return { items, complete: true };
      if (result.next_cursor === cursor)
        return {
          items,
          complete: false,
          error: new BrexError("incomplete", "Brex paging did not advance"),
        };
      cursor = result.next_cursor;
    }
    return {
      items,
      complete: false,
      error: new BrexError("incomplete", "Too many pages"),
    };
  }

  const id = encodeURIComponent;
  return {
    me: () => request("GET", "/v2/users/me", BrexUserSchema),
    company: () => request("GET", "/v2/company", Company),

    listCards: (q: { userId?: string } = {}) =>
      paginate("/v2/cards", BrexCardSchema, { user_id: q.userId }),
    getCard: (cardId: string) => request("GET", `/v2/cards/${id(cardId)}`, BrexCardSchema),
    createCard: (body: object, key: string) =>
      request("POST", "/v2/cards", BrexCardSchema, { body, key }),
    updateCard: (cardId: string, body: object, key?: string) =>
      request("PUT", `/v2/cards/${id(cardId)}`, BrexCardSchema, { body, key }),
    lockCard: (cardId: string, body: object, key?: string) =>
      request("POST", `/v2/cards/${id(cardId)}/lock`, BrexCardSchema, {
        body,
        key,
      }),
    terminateCard: (cardId: string, body: object, key?: string) =>
      request("POST", `/v2/cards/${id(cardId)}/terminate`, BrexCardSchema, {
        body,
        key,
      }),

    listUsers: (q: { name?: string; email?: string } = {}) =>
      // `email[]` is the current filter; the legacy `email` cannot be combined with `name`.
      paginate("/v2/users", BrexUserSchema, {
        name: q.name,
        "email[]": q.email,
      }),
    getUser: (userId: string) => request("GET", `/v2/users/${id(userId)}`, BrexUserSchema),

    listSpendLimits: (q: { memberUserId?: string } = {}) =>
      paginate("/v2/spend_limits", BrexSpendLimitSchema, {
        "member_user_id[]": q.memberUserId,
      }),
    getSpendLimit: (limitId: string) =>
      request("GET", `/v2/spend_limits/${id(limitId)}`, BrexSpendLimitSchema),
    createSpendLimit: (body: object, key: string) =>
      request("POST", "/v2/spend_limits", BrexSpendLimitSchema, { body, key }),
    updateSpendLimit: (limitId: string, body: object, key: string) =>
      request("PUT", `/v2/spend_limits/${id(limitId)}`, BrexSpendLimitSchema, {
        body,
        key,
      }),

    listExpenses: (
      q: {
        userId?: string;
        purchasedAtStart?: string;
        purchasedAtEnd?: string;
        complianceStatus?: string[];
      } = {},
    ) =>
      paginate("/v1/expenses/card", BrexExpenseSchema, {
        "expand[]": "merchant",
        "user_id[]": q.userId,
        purchased_at_start: q.purchasedAtStart,
        purchased_at_end: q.purchasedAtEnd,
        "compliance_status[]": q.complianceStatus,
      }),
    updateExpenseMemo: (expenseId: string, memo: string) =>
      request("PUT", `/v1/expenses/card/${id(expenseId)}`, BrexExpenseSchema, {
        body: { memo },
      }),
    listReimbursements: (
      q: { userId?: string; purchasedAtStart?: string; purchasedAtEnd?: string } = {},
    ) =>
      paginate("/v1/expenses", BrexExpenseSchema, {
        "expand[]": "merchant",
        "user_id[]": q.userId,
        purchased_at_start: q.purchasedAtStart,
        purchased_at_end: q.purchasedAtEnd,
        "expense_type[]": "REIMBURSEMENT",
      }),

    /** Settled card transactions only; Brex does not expose pending ones. */
    listCardTransactions: (q: { userId?: string; postedAtStart?: string } = {}) =>
      paginate("/v2/transactions/card/primary", BrexTransactionSchema, {
        "expand[]": "expense_id",
        user_ids: q.userId,
        posted_at_start: q.postedAtStart,
      }),

    listTrips: () => paginate("/v1/trips", BrexTripSchema),
    listCashAccounts: () => paginate("/v2/accounts/cash", BrexCashAccountSchema),
    listCardStatements: () => paginate("/v2/accounts/card/primary/statements", BrexStatementSchema),
    listCashStatements: (accountId: string) =>
      paginate(`/v2/accounts/cash/${id(accountId)}/statements`, BrexStatementSchema),
  };
}

export type BrexClient = ReturnType<typeof createBrexClient>;
