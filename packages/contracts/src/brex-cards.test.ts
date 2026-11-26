import { describe, expect, it } from "vitest";
import {
  BREX_AGENT_MODEL,
  BREX_CARDS_CONTROLS_DEFAULTS,
  BREX_CARDS_MCP_ENDPOINT,
  BREX_CARDS_READ_TOOLS,
  BREX_CARDS_WRITE_ARGS,
  BREX_CARDS_WRITE_TOOLS,
  BrexCardsControlsSchema,
  BrexCreateSpendLimitArgsSchema,
  BrexCreateVendorCardArgsSchema,
  BrexLockCardArgsSchema,
  BrexTerminateCardArgsSchema,
  BrexUpdateCardArgsSchema,
  BrexUpdateExpenseMemoArgsSchema,
  BrexUpdateSpendLimitArgsSchema,
  isBrexCardsEndpoint,
} from "./brex-cards.js";
import { McpServerConfigInput, McpServerSchema } from "./domain.js";
import { financeProviderForEndpoint } from "./finance.js";
import { LEGAL_AGENT_MODEL } from "./legal.js";

const card = { cardId: "card_1", cardName: "Figma", lastFour: "4242" };

describe("Brex cards endpoint", () => {
  it("matches only the Rakazo sentinel", () => {
    expect(BREX_CARDS_MCP_ENDPOINT).toBe("rakazo+brex://cards");
    expect(isBrexCardsEndpoint("rakazo+brex://cards")).toBe(true);
    expect(isBrexCardsEndpoint("https://api.brex.com/mcp")).toBe(false);
    expect(isBrexCardsEndpoint("rakazo+brex://other")).toBe(false);
    expect(isBrexCardsEndpoint(null)).toBe(false);
    expect(isBrexCardsEndpoint(undefined)).toBe(false);
  });

  it("is never a finance source", () => {
    expect(financeProviderForEndpoint(BREX_CARDS_MCP_ENDPOINT)).toBeNull();
  });

  it("parses as a stored server endpoint but is rejected as a remote connection input", () => {
    const stored = McpServerSchema.safeParse({
      id: "s1",
      spaceId: "sp1",
      slug: "brex-cards",
      name: "Brex cards",
      description: "",
      transport: "streamable_http",
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      command: null,
      args: [],
      envKeys: [],
      headerKeys: [],
      hasSecret: true,
      oauthStatus: "none",
      oauthSupported: true,
      oauthAttempted: false,
      enabled: true,
      writesEnabled: false,
      revision: 1,
      createdAt: "2026-10-30T00:00:00.000Z",
      updatedAt: "2026-10-30T00:00:00.000Z",
    });
    expect(stored.success).toBe(true);
    const remote = McpServerConfigInput.safeParse({
      transport: "streamable_http",
      slug: "brex-cards",
      name: "Brex cards",
      endpoint: BREX_CARDS_MCP_ENDPOINT,
    });
    expect(remote.success).toBe(false);
  });
});

describe("Brex cards tools", () => {
  it("lists the eleven reads and seven writes, with no unlock", () => {
    expect([...BREX_CARDS_READ_TOOLS]).toEqual([
      "list_cards",
      "get_card",
      "list_users",
      "list_spend_limits",
      "get_spend_limit",
      "list_expenses",
      "list_reimbursements",
      "list_card_transactions",
      "list_trips",
      "list_cash_accounts",
      "list_statements",
    ]);
    expect([...BREX_CARDS_WRITE_TOOLS]).toEqual([
      "create_vendor_card",
      "update_card",
      "lock_card",
      "terminate_card",
      "create_spend_limit",
      "update_spend_limit",
      "update_expense_memo",
    ]);
    const all: string[] = [...BREX_CARDS_READ_TOOLS, ...BREX_CARDS_WRITE_TOOLS];
    expect(new Set(all).size).toBe(18);
    expect(all.filter((name) => /unlock/i.test(name))).toEqual([]);
  });

  it("has an argument schema for every write and for nothing else", () => {
    expect(Object.keys(BREX_CARDS_WRITE_ARGS).sort()).toEqual([...BREX_CARDS_WRITE_TOOLS].sort());
  });

  it("pins the agent model to the Legal agent's", () => {
    expect(BREX_AGENT_MODEL).toEqual(LEGAL_AGENT_MODEL);
  });
});

describe("Brex cards controls", () => {
  it("accepts the defaults and has no vendorVirtualOnly column", () => {
    expect(BrexCardsControlsSchema.parse(BREX_CARDS_CONTROLS_DEFAULTS)).toEqual(
      BREX_CARDS_CONTROLS_DEFAULTS,
    );
    expect(Object.keys(BREX_CARDS_CONTROLS_DEFAULTS).sort()).toEqual([
      "allowedDurations",
      "maxCardLimitCents",
      "maxCardsPerDay",
      "maxNewCardLimitCents",
      "maxSpendLimitBaseCents",
      "oneTimeMaxDays",
    ]);
    expect(
      BrexCardsControlsSchema.safeParse({
        ...BREX_CARDS_CONTROLS_DEFAULTS,
        vendorVirtualOnly: false,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["maxNewCardLimitCents", 0],
    ["maxNewCardLimitCents", -1],
    ["maxNewCardLimitCents", 1.5],
    ["maxCardLimitCents", 0],
    ["maxSpendLimitBaseCents", 0],
    ["maxCardsPerDay", 0],
    ["maxCardsPerDay", 1001],
    ["oneTimeMaxDays", 0],
    ["allowedDurations", []],
    ["allowedDurations", ["WEEKLY"]],
    ["allowedDurations", ["MONTHLY", "MONTHLY"]],
  ])("rejects %s = %j", (key, value) => {
    expect(
      BrexCardsControlsSchema.safeParse({ ...BREX_CARDS_CONTROLS_DEFAULTS, [key]: value }).success,
    ).toBe(false);
  });

  it("allows no one-time lifetime rule (null)", () => {
    expect(
      BrexCardsControlsSchema.parse({ ...BREX_CARDS_CONTROLS_DEFAULTS, oneTimeMaxDays: null })
        .oneTimeMaxDays,
    ).toBeNull();
  });
});

describe("Brex cards write arguments", () => {
  it("lock and terminate carry the card identity and a Brex reason", () => {
    for (const schema of [BrexLockCardArgsSchema, BrexTerminateCardArgsSchema]) {
      expect(schema.safeParse({ ...card, reason: "FRAUD" }).success).toBe(true);
      expect(schema.safeParse({ ...card, reason: "BORED" }).success).toBe(false);
      expect(schema.safeParse(card).success).toBe(false);
      expect(schema.safeParse({ ...card, lastFour: "42", reason: "FRAUD" }).success).toBe(false);
      expect(schema.safeParse({ cardId: "card_1", reason: "FRAUD" }).success).toBe(false);
    }
  });

  it("update_card carries identity plus at least one change, and clears with null", () => {
    expect(BrexUpdateCardArgsSchema.safeParse(card).success).toBe(false);
    expect(BrexUpdateCardArgsSchema.safeParse({ ...card, amountCents: 5000 }).success).toBe(true);
    expect(BrexUpdateCardArgsSchema.safeParse({ ...card, lockAfterDate: null }).success).toBe(true);
    expect(BrexUpdateCardArgsSchema.safeParse({ ...card, amountCents: 0 }).success).toBe(false);
    expect(BrexUpdateCardArgsSchema.safeParse({ ...card, lockAfterDate: "soon" }).success).toBe(
      false,
    );
    expect(
      BrexUpdateCardArgsSchema.safeParse({ ...card, reason: "FRAUD", amountCents: 1 }).success,
    ).toBe(false);
  });

  it("create_vendor_card carries the owner's id and name", () => {
    const create = {
      cardName: "Figma",
      ownerUserId: "user_1",
      ownerName: "Ada Example",
      amountCents: 5000,
      duration: "MONTHLY",
    };
    expect(BrexCreateVendorCardArgsSchema.safeParse(create).success).toBe(true);
    expect(
      BrexCreateVendorCardArgsSchema.safeParse({ ...create, ownerName: undefined }).success,
    ).toBe(false);
    expect(BrexCreateVendorCardArgsSchema.safeParse({ ...create, duration: "DAILY" }).success).toBe(
      false,
    );
    // Cards are always virtual vendor cards: there is no argument to change that.
    expect(
      BrexCreateVendorCardArgsSchema.safeParse({ ...create, cardType: "PHYSICAL" }).success,
    ).toBe(false);
  });

  it("create_spend_limit carries names, members as { userId, name }, dates and the template", () => {
    const create = {
      name: "Offsite",
      amountCents: 200000,
      period: "ONE_TIME",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      templateSpendLimitId: "limit_tpl",
      templateName: "Team template",
      members: [{ userId: "user_1", name: "Ada Example" }],
    };
    expect(BrexCreateSpendLimitArgsSchema.safeParse(create).success).toBe(true);
    expect(
      BrexCreateSpendLimitArgsSchema.safeParse({ ...create, members: [{ userId: "user_1" }] })
        .success,
    ).toBe(false);
    expect(
      BrexCreateSpendLimitArgsSchema.safeParse({ ...create, templateSpendLimitId: undefined })
        .success,
    ).toBe(false);
    // The server forces HARD, no buffer, no auto cards and no rollover.
    expect(
      BrexCreateSpendLimitArgsSchema.safeParse({ ...create, authorizationType: "SOFT" }).success,
    ).toBe(false);
  });

  it("update_expense_memo carries the expense id and the exact memo", () => {
    expect(
      BrexUpdateExpenseMemoArgsSchema.parse({ expenseId: "exp_1", memo: "Team lunch" }),
    ).toEqual({ expenseId: "exp_1", memo: "Team lunch" });
    expect(BrexUpdateExpenseMemoArgsSchema.safeParse({ memo: "x" }).success).toBe(false);
    expect(BrexUpdateExpenseMemoArgsSchema.safeParse({ expenseId: "exp_1" }).success).toBe(false);
  });
});

describe("Brex update_spend_limit schema", () => {
  const base = { spendLimitId: "limit_1", spendLimitName: "Offsite" };

  it("accepts amount, members, end date and ACTIVE or ARCHIVED status", () => {
    const patch = {
      ...base,
      amountCents: 150000,
      addMembers: [{ userId: "user_1", name: "Ada Example" }],
      removeMembers: [{ userId: "user_2", name: "Bo Example" }],
      endDate: "2026-12-31",
    };
    expect(BrexUpdateSpendLimitArgsSchema.parse(patch)).toEqual(patch);
    for (const status of ["ACTIVE", "ARCHIVED"]) {
      expect(BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, status }).success).toBe(true);
    }
  });

  it.each(["TERMINATED", "PENDING", "active", ""])("rejects status %j", (status) => {
    expect(BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, status }).success).toBe(false);
  });

  it.each([
    ["authorization_type", "SOFT"],
    ["authorizationType", "SOFT"],
    ["limitBufferPercentage", 20],
    ["limit_buffer_percentage", 20],
    ["rolloverRefreshRate", "MONTHLY"],
    ["autoCreateLimitCardsSetting", "ALL_MEMBERS"],
    ["autoTransferCardsSetting", "ENABLED"],
    ["expensePolicyId", "policy_1"],
    ["transfer", { to: "acct" }],
  ])("rejects the extra field %s so a safe limit cannot be made unsafe", (key, value) => {
    expect(
      BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, amountCents: 1000, [key]: value })
        .success,
    ).toBe(false);
  });

  it("needs at least one change and a USD amount in positive whole cents", () => {
    expect(BrexUpdateSpendLimitArgsSchema.safeParse(base).success).toBe(false);
    expect(BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, amountCents: -5 }).success).toBe(
      false,
    );
    expect(BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, amountCents: 10.5 }).success).toBe(
      false,
    );
    expect(
      BrexUpdateSpendLimitArgsSchema.safeParse({ ...base, currency: "EUR", amountCents: 5 })
        .success,
    ).toBe(false);
  });
});
