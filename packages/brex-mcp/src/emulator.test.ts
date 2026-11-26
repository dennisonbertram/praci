import { afterEach, describe, expect, it } from "vitest";
import { BrexApiEmulator } from "./emulator.js";

const TOKEN = "bxt_test_token_1234567890";
const open: BrexApiEmulator[] = [];

async function setup(maxPageSize?: number) {
  const emulator = new BrexApiEmulator({ token: TOKEN, ...(maxPageSize ? { maxPageSize } : {}) });
  open.push(emulator);
  const baseUrl = await emulator.start();
  const api = async (path: string, init: RequestInit & { json?: unknown; key?: string } = {}) => {
    const { json, key, ...rest } = init;
    const res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        ...(json === undefined ? {} : { "content-type": "application/json" }),
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any, res };
  };
  return { emulator, baseUrl, api };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((e) => e.stop()));
});

const newCard = {
  owner: { type: "USER", user_id: "u_ada" },
  card_name: "Notion",
  card_type: "VIRTUAL",
  limit_type: "CARD",
  spend_controls: { spend_limit: { amount: 2500, currency: "USD" }, spend_duration: "MONTHLY" },
};

describe("BrexApiEmulator", () => {
  it("answers 401 without the bearer token and still records the request", async () => {
    const { emulator, baseUrl } = await setup();
    const res = await fetch(`${baseUrl}/v2/cards`);
    expect(res.status).toBe(401);
    expect(emulator.requests).toHaveLength(1);
    expect(emulator.requests[0]?.authorization).toBeNull();
  });

  it("creates a card, and replays the first response for the same Idempotency-Key", async () => {
    const { emulator, api } = await setup();
    const first = await api("/v2/cards", { method: "POST", json: newCard, key: "k1" });
    const replay = await api("/v2/cards", { method: "POST", json: newCard, key: "k1" });
    const other = await api("/v2/cards", { method: "POST", json: newCard, key: "k2" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      card_name: "Notion",
      status: "ACTIVE",
      card_type: "VIRTUAL",
    });
    expect(replay.body.id).toBe(first.body.id);
    expect(other.body.id).not.toBe(first.body.id);
    expect(emulator.cards.filter((c) => c.card_name === "Notion")).toHaveLength(2);
    expect(emulator.requests[0]?.idempotencyKey).toBe("k1");
  });

  it("replays the response as it was first returned, not the card's current state", async () => {
    const { api } = await setup();
    const first = await api("/v2/cards", { method: "POST", json: newCard, key: "k1" });
    await api(`/v2/cards/${first.body.id}/lock`, { method: "POST", json: { reason: "OTHER" } });
    const replay = await api("/v2/cards", { method: "POST", json: newCard, key: "k1" });
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.status).toBe("ACTIVE");
  });

  it("filters spend limits by member_user_id[] and users by name and email[]", async () => {
    const { api } = await setup();
    const mine = await api("/v2/spend_limits?member_user_id[]=u_ada");
    expect(mine.body.items.length).toBeGreaterThan(0);
    expect((await api("/v2/spend_limits?member_user_id[]=u_cy")).body.items).toEqual([]);
    expect(
      (await api("/v2/users?email[]=cy@example.test")).body.items.map((u: any) => u.id),
    ).toEqual(["u_cy"]);
    expect((await api("/v2/users?name=ben")).body.items.map((u: any) => u.id)).toEqual(["u_ben"]);
  });

  it("rejects a vendor card without spend controls and an unknown owner", async () => {
    const { api } = await setup();
    const { spend_controls: _omit, ...noControls } = newCard;
    expect((await api("/v2/cards", { method: "POST", json: noControls })).status).toBe(400);
    const ghost = { ...newCard, owner: { type: "USER", user_id: "u_nobody" } };
    expect((await api("/v2/cards", { method: "POST", json: ghost })).status).toBe(400);
  });

  it("locks and terminates a card with a reason, and rejects a lock without one", async () => {
    const { api } = await setup();
    expect((await api("/v2/cards/card_figma/lock", { method: "POST", json: {} })).status).toBe(400);
    const locked = await api("/v2/cards/card_figma/lock", {
      method: "POST",
      json: { reason: "OTHER" },
    });
    expect(locked.body.status).toBe("LOCKED");
    const ended = await api("/v2/cards/card_figma/terminate", {
      method: "POST",
      json: { reason: "FRAUD" },
    });
    expect(ended.body.status).toBe("TERMINATED");
    expect((await api("/v2/cards/card_nope")).status).toBe(404);
  });

  it("updates spend controls on a card", async () => {
    const { api } = await setup();
    const res = await api("/v2/cards/card_figma", {
      method: "PUT",
      json: {
        spend_controls: {
          spend_limit: { amount: 70_000, currency: "USD" },
          spend_duration: "YEARLY",
        },
      },
    });
    expect(res.body.spend_controls).toMatchObject({
      spend_limit: { amount: 70_000 },
      spend_duration: "YEARLY",
    });
  });

  it("pages with limit and cursor and ends with a null cursor", async () => {
    const { api } = await setup(2);
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: any = await api(`/v2/cards?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
      seen.push(...res.body.items.map((c: any) => c.id));
      cursor = res.body.next_cursor ?? null;
      pages++;
    } while (cursor);
    expect(pages).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain("card_figma");
  });

  it("rejects a spend limit with a missing or unknown expense policy", async () => {
    const { emulator, api } = await setup();
    const template = emulator.spendLimits.find((s) => s.id === "sl_template");
    const body = {
      name: "New limit",
      period_recurrence_type: "PER_MONTH",
      authorization_settings: {
        base_limit: { amount: 1000, currency: "USD" },
        authorization_type: "HARD",
        rollover_refresh_rate: "OFF",
      },
      expense_visibility: "SHARED",
      authorization_visibility: "PUBLIC",
      limit_increase_setting: "DISABLED",
      spend_type: "BUDGET_PROVISIONED_CARDS_ONLY",
      auto_transfer_cards_setting: "DISABLED",
      auto_create_limit_cards_setting: "DISABLED",
      expense_policy_id: template?.expense_policy_id,
      member_user_ids: ["u_ada"],
    };
    expect(
      (
        await api("/v2/spend_limits", {
          method: "POST",
          json: { ...body, expense_policy_id: undefined },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("/v2/spend_limits", {
          method: "POST",
          json: { ...body, expense_policy_id: "pol_nope" },
        })
      ).status,
    ).toBe(400);
    const ok = await api("/v2/spend_limits", { method: "POST", json: body });
    expect(ok.status).toBe(200);
    expect(ok.body.id).toMatch(/^sl_/);
    const updated = await api(`/v2/spend_limits/${ok.body.id}`, {
      method: "PUT",
      json: {
        authorization_settings: { base_limit: { amount: 2000, currency: "USD" } },
        member_user_ids: ["u_ben"],
      },
    });
    expect(updated.body.authorization_settings).toMatchObject({
      base_limit: { amount: 2000 },
      authorization_type: "HARD",
    });
    expect(updated.body.member_user_ids).toEqual(["u_ben"]);
  });

  it("serves the read endpoints with Brex field names", async () => {
    const { api } = await setup();
    expect((await api("/v2/users/me")).body).toMatchObject({ id: "u_ada", first_name: "Ada" });
    expect((await api("/v2/users/u_ben")).body).toMatchObject({ last_name: "Sample" });
    expect((await api("/v2/company")).body).toMatchObject({ id: "cmp_example" });
    expect((await api("/v1/trips")).body.items.length).toBeGreaterThan(0);
    expect((await api("/v2/accounts/cash")).body.items[0]).toMatchObject({
      id: "ca_1",
      primary: true,
    });
    expect((await api("/v2/accounts/card/primary/statements")).body.items[0]).toHaveProperty(
      "period.start_date",
    );
    expect((await api("/v2/accounts/cash/ca_1/statements")).body.items.length).toBeGreaterThan(0);
    const txns = await api("/v2/transactions/card/primary?expand[]=expense_id");
    expect(txns.body.items[0]).toMatchObject({
      card_id: expect.any(String),
      posted_at_date: expect.any(String),
    });
    const due = await api("/v1/expenses/card?compliance_status[]=DUE&compliance_status[]=OVERDUE");
    const all = await api("/v1/expenses/card");
    expect(due.body.items.length).toBeGreaterThan(0);
    expect(due.body.items.length).toBeLessThan(all.body.items.length);
    expect(all.body.items.every((e: any) => e.expense_type !== "REIMBURSEMENT")).toBe(true);
    expect(all.body.items.some((e: any) => e.category === "SERVERS")).toBe(true);
    expect(txns.body.items.every((t: any) => typeof t.expense_id === "string")).toBe(true);

    const reimbursements = await api("/v1/expenses?expense_type[]=REIMBURSEMENT");
    expect(reimbursements.body.items.length).toBeGreaterThan(0);
    expect(reimbursements.body.items.every((e: any) => e.expense_type === "REIMBURSEMENT")).toBe(
      true,
    );
    expect(reimbursements.body.items[0]).toMatchObject({
      category: expect.any(String),
      review: { compliance_status: expect.any(String) },
      receipts: expect.any(Array),
    });
    expect(txns.body.items[0].merchant.mcc).toMatch(/^\d{4}$/);
  });

  it("has no PAN, secure-email or unlock route: they answer 404 and are recorded", async () => {
    const { emulator, api } = await setup();
    expect((await api("/v2/cards/card_figma/pan")).status).toBe(404);
    expect(
      (await api("/v2/cards/card_figma/secure_email", { method: "POST", json: {} })).status,
    ).toBe(404);
    expect((await api("/v2/cards/card_figma/unlock", { method: "POST", json: {} })).status).toBe(
      404,
    );
    expect(emulator.requests.map((r) => r.path)).toEqual([
      "/v2/cards/card_figma/pan",
      "/v2/cards/card_figma/secure_email",
      "/v2/cards/card_figma/unlock",
    ]);
    expect(emulator.cards.find((c) => c.id === "card_figma")?.status).toBe("ACTIVE");
  });

  it("answers 429 with Retry-After for rateLimitNext, then recovers", async () => {
    const { emulator, api } = await setup();
    emulator.rateLimitNext = 1;
    const limited = await api("/v2/cards");
    expect(limited.status).toBe(429);
    expect(limited.res.headers.get("retry-after")).toBe("1");
    expect((await api("/v2/cards")).status).toBe(200);
  });

  it("injects a failure for one path after letting some calls through", async () => {
    const { emulator, api } = await setup();
    emulator.failNext.push({ path: "/v2/cards", status: 500, after: 1 });
    expect((await api("/v2/cards")).status).toBe(200);
    expect((await api("/v2/cards")).status).toBe(500);
    expect((await api("/v2/cards")).status).toBe(200);
  });
});
