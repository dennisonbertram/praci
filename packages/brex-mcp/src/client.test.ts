import { afterEach, describe, expect, it, vi } from "vitest";
import { BrexError, createBrexClient } from "./client.js";
import { BrexApiEmulator } from "./emulator.js";

const TOKEN = "bxt_test_token_1234567890";
const open: BrexApiEmulator[] = [];

async function setup(options: { maxPageSize?: number; random?: () => number } = {}) {
  const emulator = new BrexApiEmulator({
    token: TOKEN,
    ...(options.maxPageSize ? { maxPageSize: options.maxPageSize } : {}),
  });
  open.push(emulator);
  const baseUrl = await emulator.start();
  const sleeps: number[] = [];
  const client = createBrexClient({
    token: TOKEN,
    baseUrl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: options.random ?? (() => 0),
  });
  return { emulator, client, sleeps, baseUrl };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(open.splice(0).map((e) => e.stop()));
});

const cardBody = {
  owner: { type: "USER", user_id: "u_ada" },
  card_name: "Notion",
  card_type: "VIRTUAL",
  limit_type: "CARD",
  spend_controls: { spend_limit: { amount: 2500, currency: "USD" }, spend_duration: "MONTHLY" },
};

async function failure(promise: Promise<unknown>): Promise<BrexError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BrexError);
  return error as BrexError;
}

describe("createBrexClient", () => {
  it("sends the bearer token and JSON, and the Idempotency-Key only when the caller gives one", async () => {
    const { emulator, client } = await setup();
    await client.me();
    await client.createCard(cardBody, "key-1");
    const [read, write] = emulator.requests;
    expect(read?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(read?.idempotencyKey).toBeNull();
    expect(write?.idempotencyKey).toBe("key-1");
    expect(write?.contentType).toContain("application/json");
    expect(write?.body).toMatchObject({ card_name: "Notion" });
  });

  it("follows the cursor to the last page", async () => {
    const { emulator, client } = await setup({ maxPageSize: 2 });
    const paged = await client.listCards();
    expect(paged.complete).toBe(true);
    expect(paged.items.map((c) => c.id)).toEqual(emulator.cards.map((c) => c.id));
    const pages = emulator.requests.filter((r) => r.path === "/v2/cards");
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]?.query).toContain("cursor=");
  });

  it("returns the pages it got and the error when a later page fails", async () => {
    const { emulator, client } = await setup({ maxPageSize: 2 });
    emulator.failNext.push({ path: "/v2/cards", status: 500, after: 1 });
    const paged = await client.listCards();
    expect(paged.complete).toBe(false);
    expect(paged.items).toHaveLength(2);
    expect(paged.error?.kind).toBe("unavailable");
  });

  it("filters users with email[] and name, never the legacy singular email", async () => {
    const { emulator, client } = await setup();
    const byEmail = await client.listUsers({ email: "ben@example.test", name: "sample" });
    expect(byEmail.items.map((u) => u.id)).toEqual(["u_ben"]);
    const params = new URLSearchParams(emulator.requests.at(-1)?.query);
    expect(params.get("email[]")).toBe("ben@example.test");
    expect(params.has("email")).toBe(false);
    expect((await client.listUsers({ name: "CY" })).items.map((u) => u.id)).toEqual(["u_cy"]);
    expect((await client.listUsers({ email: "nobody@example.test" })).items).toEqual([]);
  });

  it("lists only the spend limits a user belongs to", async () => {
    const { client } = await setup();
    const none = await client.listSpendLimits({ memberUserId: "u_cy" });
    expect(none.items).toEqual([]);
    const ada = await client.listSpendLimits({ memberUserId: "u_ada" });
    expect(ada.items.length).toBeGreaterThan(0);
  });

  it("backs off on 429 using Retry-After plus jitter, then succeeds", async () => {
    const { emulator, client, sleeps } = await setup({ random: () => 0.5 });
    emulator.rateLimitNext = 2;
    await client.me();
    expect(sleeps).toEqual([1125, 1125]);
    expect(emulator.requests).toHaveLength(3);
  });

  it("gives up with a rate_limit error after repeated 429s", async () => {
    const { emulator, client, sleeps } = await setup();
    emulator.rateLimitNext = 100;
    const error = await failure(client.me());
    expect(error.kind).toBe("rate_limit");
    expect(error.definite).toBe(true);
    expect(emulator.requests).toHaveLength(5);
    expect(sleeps).toHaveLength(4);
  });

  it("turns 401 and 403 into an auth error", async () => {
    const { emulator, client, baseUrl } = await setup();
    const wrong = createBrexClient({ token: "bxt_wrong", baseUrl });
    expect((await failure(wrong.me())).kind).toBe("auth");
    emulator.failNext.push({ path: "/v2/users/me", status: 403 });
    const forbidden = await failure(client.me());
    expect(forbidden).toMatchObject({ kind: "auth", status: 403, definite: true });
  });

  it("classifies definite and uncertain failures", async () => {
    const { emulator, client } = await setup();
    emulator.failNext.push({
      path: "/v2/cards",
      method: "POST",
      status: 400,
      body: { message: "secret detail" },
    });
    const rejected = await failure(client.createCard(cardBody, "k"));
    expect(rejected).toMatchObject({ kind: "client", status: 400, definite: true });
    expect(rejected.message).not.toContain("secret detail");

    emulator.failNext.push({ path: "/v2/cards", method: "POST", status: 503 });
    expect(await failure(client.createCard(cardBody, "k"))).toMatchObject({
      kind: "unavailable",
      definite: false,
    });

    emulator.failNext.push({ path: "/v2/cards", method: "POST", status: 200, body: { nope: 1 } });
    expect(await failure(client.createCard(cardBody, "k"))).toMatchObject({
      kind: "mapping",
      definite: false,
    });
  });

  it("treats a network failure and a timeout as uncertain", async () => {
    const down = createBrexClient({
      token: TOKEN,
      baseUrl: "http://brex.invalid",
      fetch: async () => {
        throw new TypeError("connect ECONNREFUSED");
      },
    });
    expect(await failure(down.me())).toMatchObject({ kind: "network", definite: false });

    const hung = createBrexClient({
      token: TOKEN,
      baseUrl: "http://brex.invalid",
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    });
    expect(await failure(hung.me())).toMatchObject({ kind: "network", definite: false });
  });

  it("never logs, and never puts the token or a response body in an error", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { emulator, client } = await setup();
    emulator.failNext.push({
      path: "/v2/users/me",
      status: 500,
      body: { detail: "internal body text" },
    });
    const error = await failure(client.me());
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).not.toContain("internal body text");
    const wrong = createBrexClient({
      token: TOKEN,
      baseUrl: "http://brex.invalid",
      fetch: async () => {
        throw new Error(`boom ${TOKEN}`);
      },
    });
    expect((await failure(wrong.me())).message).not.toContain(TOKEN);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("reads transaction MCCs, expense details, spend-limit usage and reimbursements", async () => {
    const { client } = await setup();
    const transactions = await client.listCardTransactions();
    expect(transactions.items.some((t) => t.merchant?.mcc && /^\d{4}$/.test(t.merchant.mcc))).toBe(
      true,
    );

    const expenses = await client.listExpenses();
    const categorized = expenses.items.find((e) => e.category);
    expect(categorized).toMatchObject({
      category: expect.any(String),
      expense_type: "CARD",
      receipts: expect.any(Array),
    });
    expect(categorized?.review?.compliance_status).toEqual(expect.any(String));

    const limits = await client.listSpendLimits();
    expect(
      limits.items.some((s) => s.current_period_balance?.amount_spent?.amount !== undefined),
    ).toBe(true);

    const reimbursements = await client.listReimbursements();
    expect(reimbursements.items.length).toBeGreaterThan(0);
    expect(reimbursements.items.every((e) => e.expense_type === "REIMBURSEMENT")).toBe(true);
  });
});
