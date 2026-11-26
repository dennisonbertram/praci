import * as z from "zod";
import type { BrexSpendBucket } from "./brex-categories.js";
import { BREX_SPEND_BUCKETS } from "./brex-categories.js";
import { LEGAL_AGENT_MODEL } from "./legal.js";

/**
 * The Rakazo-owned Brex cards MCP server runs inside the connector, not behind a URL. Its row
 * carries this sentinel as its endpoint, so it is never mistaken for Brex's own MCP server
 * (`financeProviderForEndpoint` only matches https hosts) and cannot be created through the
 * remote connection inputs, which accept only http(s).
 */
/**
 * Starts the Brex MCP server's failure text when Brex answered 401 or 403, and is the code of the
 * API error the Brex page checks to offer "Replace token".
 */
export const BREX_TOKEN_REJECTED = "BREX_TOKEN_REJECTED";

export const BREX_CARDS_MCP_ENDPOINT = "rakazo+brex://cards";

export function isBrexCardsEndpoint(endpoint: string | null | undefined): boolean {
  return endpoint === BREX_CARDS_MCP_ENDPOINT;
}

export const BREX_CARDS_READ_TOOLS = [
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
] as const;

/** There is no unlock tool: the agent can lock a card but only the user unlocks it, in Brex. */
export const BREX_CARDS_WRITE_TOOLS = [
  "create_vendor_card",
  "update_card",
  "lock_card",
  "terminate_card",
  "create_spend_limit",
  "update_spend_limit",
  "update_expense_memo",
] as const;

/** Same model as the Legal agent: the stronger model, with the highest effort. */
export const BREX_AGENT_MODEL = LEGAL_AGENT_MODEL;

// Brex enums, from the Brex API reference (CardSpendDuration, ChangeCardReason, spend limit periods).
export const BrexCardDurationSchema = z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"]);
export type BrexCardDuration = z.infer<typeof BrexCardDurationSchema>;

export const BrexChangeCardReasonSchema = z.enum([
  "OTHER",
  "CARD_DAMAGED",
  "CARD_LOST",
  "CARD_NOT_RECEIVED",
  "DO_NOT_NEED_PHYSICAL_CARD",
  "DO_NOT_NEED_VIRTUAL_CARD",
  "FRAUD",
]);
export type BrexChangeCardReason = z.infer<typeof BrexChangeCardReasonSchema>;

export const BrexSpendLimitPeriodSchema = z.enum([
  "PER_WEEK",
  "PER_MONTH",
  "PER_QUARTER",
  "PER_YEAR",
  "ONE_TIME",
]);

const MAX_CENTS = 1_000_000_000; // $10,000,000: a bound against typos, not a policy

const Cents = z.number().int().positive().max(MAX_CENTS);

/** The owner's hard limits. Amounts are USD cents. */
export const BrexCardsControlsSchema = z
  .object({
    /** The largest limit a new vendor card may start with. */
    maxNewCardLimitCents: Cents,
    /** The ceiling for raising an existing card's limit. */
    maxCardLimitCents: Cents,
    /** The ceiling for a spend limit's base amount. */
    maxSpendLimitBaseCents: Cents,
    /** New cards per rolling 24 hours, counted per Brex account. */
    maxCardsPerDay: z.number().int().min(1).max(1000),
    allowedDurations: z
      .array(BrexCardDurationSchema)
      .min(1)
      .refine((list) => new Set(list).size === list.length, "Durations must be unique"),
    /** A ONE_TIME card must lock within this many days; null means no rule. */
    oneTimeMaxDays: z.number().int().min(1).max(3650).nullable(),
  })
  .strict();
export type BrexCardsControls = z.infer<typeof BrexCardsControlsSchema>;

/** Proposals the owner can change; they match the column defaults in the database. */
export const BREX_CARDS_CONTROLS_DEFAULTS = {
  maxNewCardLimitCents: 100_000,
  maxCardLimitCents: 500_000,
  maxSpendLimitBaseCents: 1_000_000,
  maxCardsPerDay: 5,
  allowedDurations: ["MONTHLY", "ONE_TIME"],
  oneTimeMaxDays: 90,
} as const satisfies BrexCardsControls;

// Write-tool arguments. The approval card and the server both read these, so each write names
// its target (and the server re-reads the target at dispatch and refuses on a mismatch).
const Text = z.string().min(1).max(200);
const Date10 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const MerchantList = z.array(Text).max(50);

const CardIdentity = {
  cardId: z.string().min(1).max(200),
  cardName: Text,
  lastFour: z.string().regex(/^\d{4}$/, "Four digits"),
};

const Member = z.object({ userId: z.string().min(1).max(200), name: Text }).strict();
export type BrexMember = z.infer<typeof Member>;

/** True when something besides the target's identity is set. */
const changesSomething = (identity: readonly string[]) => (value: object) =>
  Object.entries(value).some(([key, v]) => !identity.includes(key) && v !== undefined);

export const BrexLockCardArgsSchema = z
  .object({ ...CardIdentity, reason: BrexChangeCardReasonSchema })
  .strict();

export const BrexTerminateCardArgsSchema = BrexLockCardArgsSchema;

/** An omitted field keeps the current value; null clears the date or a merchant list. */
export const BrexUpdateCardArgsSchema = z
  .object({
    ...CardIdentity,
    amountCents: Cents.optional(),
    duration: BrexCardDurationSchema.optional(),
    lockAfterDate: Date10.nullable().optional(),
    allowedMerchants: MerchantList.nullable().optional(),
    blockedMerchants: MerchantList.nullable().optional(),
  })
  .strict()
  .refine(
    changesSomething(["cardId", "cardName", "lastFour"]),
    "Give at least one value to change",
  );

/** Always a virtual vendor card; there is no argument for the type. */
export const BrexCreateVendorCardArgsSchema = z
  .object({
    cardName: Text,
    ownerUserId: z.string().min(1).max(200),
    ownerName: Text,
    amountCents: Cents,
    duration: BrexCardDurationSchema,
    allowedMerchants: MerchantList.optional(),
    blockedMerchants: MerchantList.optional(),
    lockAfterDate: Date10.optional(),
  })
  .strict();

/** The server copies policy and visibility from the template and forces the safe settings. */
export const BrexCreateSpendLimitArgsSchema = z
  .object({
    name: Text,
    amountCents: Cents,
    period: BrexSpendLimitPeriodSchema,
    startDate: Date10.optional(),
    endDate: Date10.optional(),
    templateSpendLimitId: z.string().min(1).max(200),
    templateName: Text,
    members: z.array(Member).max(100),
  })
  .strict();

/**
 * The only fields an agent may change on a spend limit. Strict on purpose: authorization type,
 * buffer, rollover, auto-card, transfer and policy fields are rejected, so a safe limit cannot be
 * made unsafe, and only ACTIVE or ARCHIVED are accepted as a status.
 */
export const BrexUpdateSpendLimitArgsSchema = z
  .object({
    spendLimitId: z.string().min(1).max(200),
    spendLimitName: Text,
    amountCents: Cents.optional(),
    addMembers: z.array(Member).max(100).optional(),
    removeMembers: z.array(Member).max(100).optional(),
    endDate: Date10.optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine(
    changesSomething(["spendLimitId", "spendLimitName"]),
    "Give at least one value to change",
  );

export const BrexUpdateExpenseMemoArgsSchema = z
  .object({ expenseId: z.string().min(1).max(200), memo: z.string().min(1).max(2000) })
  .strict();

/** The argument schema of each write tool, shared by the server and the approval preview. */
export const BREX_CARDS_WRITE_ARGS = {
  create_vendor_card: BrexCreateVendorCardArgsSchema,
  update_card: BrexUpdateCardArgsSchema,
  lock_card: BrexLockCardArgsSchema,
  terminate_card: BrexTerminateCardArgsSchema,
  create_spend_limit: BrexCreateSpendLimitArgsSchema,
  update_spend_limit: BrexUpdateSpendLimitArgsSchema,
  update_expense_memo: BrexUpdateExpenseMemoArgsSchema,
} as const satisfies Record<(typeof BREX_CARDS_WRITE_TOOLS)[number], z.ZodType>;

// RPC shapes the API and web slices reuse.
export const BrexCardsConnectInputSchema = z
  .object({ token: z.string().trim().min(1).max(4096) })
  .strict();

/** What a connect shows the caller. The token is never returned. */
export const BrexCardsConnectOutputSchema = z.object({
  serverId: z.string(),
  agentBotId: z.string(),
});

/**
 * One row of the Brex cards table. The name is Brex-controlled text: display only. The owner is an
 * id because the page reads only `list_cards`, which carries no names.
 */
export const BrexCardRowSchema = z.object({
  cardId: z.string(),
  name: z.string(),
  lastFour: z.string(),
  ownerUserId: z.string().nullable(),
  status: z.string(),
  limitCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  duration: z.string().nullable(),
});
export type BrexCardRow = z.infer<typeof BrexCardRowSchema>;

export const BrexCardsListSchema = z.object({
  serverId: z.string(),
  agentBotId: z.string().nullable(),
  writesEnabled: z.boolean(),
  cards: z.array(BrexCardRowSchema),
});
export type BrexCardsList = z.infer<typeof BrexCardsListSchema>;

// Owner-only read model for the Brex page. Amounts are integer cents; days are UTC YYYY-MM-DD.
const AnyCents = z.number().int();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const DateTime = z.string();
export const BrexSpendBucketSchema = z.enum(BREX_SPEND_BUCKETS);
export type { BrexSpendBucket };

const ServerFields = {
  serverId: z.string(),
  agentBotId: z.string().nullable(),
  writesEnabled: z.boolean(),
};

export const BrexSpendPointSchema = z.object({ day: Day, cents: AnyCents });
export type BrexSpendPoint = z.infer<typeof BrexSpendPointSchema>;

export const BrexMerchantSpendSchema = z.object({
  merchant: z.string(),
  cents: AnyCents,
  count: z.number().int().nonnegative(),
  partial: z.boolean(),
});
export type BrexMerchantSpend = z.infer<typeof BrexMerchantSpendSchema>;

export const BrexCategorySpendSchema = z.object({
  bucket: BrexSpendBucketSchema,
  cents: AnyCents,
  count: z.number().int().nonnegative(),
  partial: z.boolean(),
  merchants: z.array(BrexMerchantSpendSchema),
});
export type BrexCategorySpend = z.infer<typeof BrexCategorySpendSchema>;

/** Card spend -> category -> merchant. Merchant cents sum to their category and to totalCents. */
export const BrexSpendSankeySchema = z.object({
  partial: z.boolean(),
  totalCents: AnyCents,
  categories: z.array(BrexCategorySpendSchema),
});
export type BrexSpendSankey = z.infer<typeof BrexSpendSankeySchema>;

export const BrexNearLimitItemSchema = z.object({
  kind: z.enum(["card", "spend_limit"]),
  id: z.string(),
  name: z.string(),
  usedCents: AnyCents,
  limitCents: AnyCents,
  percent: z.number(),
});
export type BrexNearLimitItem = z.infer<typeof BrexNearLimitItemSchema>;

export const BrexCardsOverviewSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  cash: z.object({
    totalCents: AnyCents,
    availableCents: AnyCents,
    accountCount: z.number().int().nonnegative(),
  }),
  cardSpend: z.object({
    partial: z.boolean(),
    monthToDateCents: AnyCents,
    previousMonthToDateCents: AnyCents,
    changePercent: z.number().nullable(),
    sparkline: z.array(BrexSpendPointSchema),
  }),
  cards: z.object({
    active: z.number().int().nonnegative(),
    locked: z.number().int().nonnegative(),
    terminated: z.number().int().nonnegative(),
  }),
  nearLimit: z.object({
    partial: z.boolean(),
    count: z.number().int().nonnegative(),
    items: z.array(BrexNearLimitItemSchema),
  }),
  sankey: BrexSpendSankeySchema,
  topVendors: z.array(BrexMerchantSpendSchema),
});
export type BrexCardsOverview = z.infer<typeof BrexCardsOverviewSchema>;

export const BrexCardViewSchema = BrexCardRowSchema.extend({
  cardType: z.string().nullable(),
  lockAfterDate: Day.nullable(),
  allowedMerchants: z.array(z.string()),
  blockedMerchants: z.array(z.string()),
  ownerName: z.string().nullable(),
  period: z.object({ start: Day, end: Day }),
  periodSpendCents: AnyCents,
  series: z.array(BrexSpendPointSchema),
  usage: z.object({ usedCents: AnyCents, limitCents: AnyCents, percent: z.number() }).nullable(),
  partial: z.boolean(),
});
export type BrexCardView = z.infer<typeof BrexCardViewSchema>;

export const BrexCardsViewSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  cards: z.array(BrexCardViewSchema),
});
export type BrexCardsView = z.infer<typeof BrexCardsViewSchema>;

export const BrexSpendingInputSchema = z
  .object({
    merchant: z.string().trim().min(1).max(200).optional(),
    cardId: z.string().min(1).max(200).optional(),
    userId: z.string().min(1).max(200).optional(),
    category: BrexSpendBucketSchema.optional(),
    from: Day.optional(),
    to: Day.optional(),
  })
  .strict();
export type BrexSpendingInput = z.infer<typeof BrexSpendingInputSchema>;

export const BrexSpendTransactionSchema = z.object({
  id: z.string(),
  postedAt: DateTime,
  day: Day,
  cardId: z.string().nullable(),
  cardName: z.string().nullable(),
  cardLastFour: z.string().nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  merchant: z.string().nullable(),
  description: z.string(),
  amountCents: AnyCents,
  currency: z.string().nullable(),
  bucket: BrexSpendBucketSchema,
  expenseId: z.string().nullable(),
});
export type BrexSpendTransaction = z.infer<typeof BrexSpendTransactionSchema>;

export const BrexDuplicateSubscriptionSchema = z.object({
  merchant: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  cardIds: z.array(z.string()),
  cardNames: z.array(z.string()),
  cents: AnyCents,
  count: z.number().int().nonnegative(),
  partial: z.boolean(),
});
export type BrexDuplicateSubscription = z.infer<typeof BrexDuplicateSubscriptionSchema>;

export const BrexSpendingSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  range: z.object({ from: Day, to: Day }),
  totalCents: AnyCents,
  transactions: z.array(BrexSpendTransactionSchema),
  categories: z.array(BrexCategorySpendSchema),
  sankey: BrexSpendSankeySchema,
  duplicates: z.array(BrexDuplicateSubscriptionSchema),
});
export type BrexSpending = z.infer<typeof BrexSpendingSchema>;

export const BrexSpendLimitViewSchema = z.object({
  spendLimitId: z.string(),
  name: z.string(),
  status: z.string().nullable(),
  period: z.string().nullable(),
  startDate: Day.nullable(),
  endDate: Day.nullable(),
  limitCents: AnyCents.nullable(),
  currency: z.string().nullable(),
  usedCents: AnyCents.nullable(),
  percent: z.number().nullable(),
  memberUserIds: z.array(z.string()),
  members: z.array(z.object({ userId: z.string(), name: z.string() })),
});
export type BrexSpendLimitView = z.infer<typeof BrexSpendLimitViewSchema>;

export const BrexLimitsSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  limits: z.array(BrexSpendLimitViewSchema),
});
export type BrexLimits = z.infer<typeof BrexLimitsSchema>;

export const BrexPersonSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  status: z.string().nullable(),
  cards: z.array(
    z.object({ cardId: z.string(), name: z.string(), lastFour: z.string(), status: z.string() }),
  ),
  activeCardCount: z.number().int().nonnegative(),
  terminatedCardCount: z.number().int().nonnegative(),
  spendLimitIds: z.array(z.string()),
  spendLimitNames: z.array(z.string()),
  monthSpendCents: AnyCents,
  windowSpendCents: AnyCents,
  partial: z.boolean(),
});
export type BrexPerson = z.infer<typeof BrexPersonSchema>;

export const BrexPeopleSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  people: z.array(BrexPersonSchema),
});
export type BrexPeople = z.infer<typeof BrexPeopleSchema>;

export const BrexExpenseViewSchema = z.object({
  expenseId: z.string(),
  purchasedAt: DateTime.nullable(),
  day: Day.nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  merchant: z.string().nullable(),
  memo: z.string().nullable(),
  status: z.string().nullable(),
  paymentStatus: z.string().nullable(),
  expenseType: z.string().nullable(),
  category: z.string().nullable(),
  bucket: BrexSpendBucketSchema,
  amountCents: AnyCents.nullable(),
  currency: z.string().nullable(),
  receipts: z.array(z.object({ id: z.string() })),
  missingReceipt: z.boolean(),
  missingMemo: z.boolean(),
  complianceStatus: z.string().nullable(),
  cardId: z.string().nullable(),
});
export type BrexExpenseView = z.infer<typeof BrexExpenseViewSchema>;

export const BrexExpensesSchema = z.object({
  ...ServerFields,
  partial: z.boolean(),
  expenses: z.array(BrexExpenseViewSchema),
  reimbursements: z.array(BrexExpenseViewSchema),
});
export type BrexExpenses = z.infer<typeof BrexExpensesSchema>;

export const BrexAccountSchema = z.object({
  cashAccountId: z.string(),
  name: z.string().nullable(),
  status: z.string().nullable(),
  currentBalanceCents: AnyCents.nullable(),
  availableBalanceCents: AnyCents.nullable(),
  currency: z.string().nullable(),
  primary: z.boolean().nullable(),
});
export type BrexAccount = z.infer<typeof BrexAccountSchema>;

export const BrexStatementSchema = z.object({
  statementId: z.string(),
  accountKind: z.enum(["card", "cash"]),
  cashAccountId: z.string().nullable(),
  accountName: z.string().nullable(),
  startDate: Day.nullable(),
  endDate: Day.nullable(),
  startBalanceCents: AnyCents.nullable(),
  endBalanceCents: AnyCents.nullable(),
});
export type BrexStatement = z.infer<typeof BrexStatementSchema>;

export const BrexAccountsSchema = z.object({
  ...ServerFields,
  accounts: z.array(BrexAccountSchema),
  statements: z.array(BrexStatementSchema),
});
export type BrexAccounts = z.infer<typeof BrexAccountsSchema>;

export const BrexTripSchema = z.object({
  tripId: z.string(),
  name: z.string().nullable(),
  status: z.string().nullable(),
  bookerUserId: z.string().nullable(),
  bookerName: z.string().nullable(),
  startsAt: DateTime.nullable(),
  endsAt: DateTime.nullable(),
});
export type BrexTrip = z.infer<typeof BrexTripSchema>;

export const BrexTripsSchema = z.object({
  ...ServerFields,
  trips: z.array(BrexTripSchema),
});
export type BrexTrips = z.infer<typeof BrexTripsSchema>;

export const BrexActivitySchema = z.object({
  ...ServerFields,
  activities: z.array(
    z.object({
      effectId: z.string(),
      at: DateTime,
      action: z.string(),
      target: z.string().nullable(),
      status: z.string(),
    }),
  ),
});
export type BrexActivity = z.infer<typeof BrexActivitySchema>;
