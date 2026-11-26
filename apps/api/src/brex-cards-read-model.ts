import { ORPCError } from "@orpc/server";
import {
  boundDirectApprovalDetails,
  catalogApprovalConnectorId,
  catalogApprovalDetails,
  catalogApprovalInnerArgs,
  parseCatalogApprovalTarget,
} from "@rakazo/adapters";
import type {
  Actor,
  BrexAccounts,
  BrexActivity,
  BrexCardsOverview,
  BrexCardsView,
  BrexCardView,
  BrexCategorySpend,
  BrexExpenses,
  BrexExpenseView,
  BrexLimits,
  BrexMerchantSpend,
  BrexNearLimitItem,
  BrexPeople,
  BrexPerson,
  BrexSpending,
  BrexSpendLimitView,
  BrexSpendPoint,
  BrexSpendTransaction,
  BrexTrip,
  BrexTrips,
} from "@rakazo/contracts";
import { brexSpendBucket } from "@rakazo/contracts";
import * as z from "zod";
import type { BrexCardsDeps } from "./brex-cards.js";
import { connectionOf, toolFailure } from "./brex-cards.js";

const DAY_MS = 86_400_000;
const CATALOG_APPROVAL_TOOL = "__rakazoCatalogTool";
const WRITE_TOOLS = new Set([
  "create_vendor_card",
  "update_card",
  "lock_card",
  "terminate_card",
  "create_spend_limit",
  "update_spend_limit",
  "update_expense_memo",
]);

const str = z.string().nullish();
const num = z.number().nullish();
const bool = z.boolean().nullish();
const arr = <T extends z.ZodType>(item: T) => z.array(item).nullish();

const CardPayload = z.object({
  id: z.string(),
  name: str,
  lastFour: str,
  ownerUserId: str,
  status: str,
  type: str,
  limitCents: num,
  currency: str,
  duration: str,
  lockAfterDate: str,
  allowedMerchants: arr(z.string()),
  blockedMerchants: arr(z.string()),
});
const UserPayload = z.object({ id: z.string(), name: str, email: str, status: str });
const SpendLimitPayload = z.object({
  id: z.string(),
  name: str,
  status: str,
  period: str,
  startDate: str,
  endDate: str,
  currentPeriodBalance: z
    .object({
      startDate: str,
      endDate: str,
      amountSpentCents: num,
      currency: str,
    })
    .nullish(),
  baseLimitCents: num,
  currency: str,
  memberUserIds: arr(z.string()),
});
const ExpensePayload = z.object({
  id: z.string(),
  memo: str,
  status: str,
  paymentStatus: str,
  purchasedAt: str,
  amountCents: num,
  currency: str,
  userId: str,
  merchant: str,
  merchantMcc: str,
  category: str,
  expenseType: str,
  receipts: arr(z.object({ id: z.string() })),
  complianceStatus: str,
});
const TransactionPayload = z.object({
  id: z.string(),
  cardId: str,
  description: z.string(),
  amountCents: z.number(),
  currency: str,
  postedAt: z.string(),
  type: str,
  merchant: str,
  mcc: str,
  expenseId: str,
});
const CashAccountPayload = z.object({
  id: z.string(),
  name: str,
  status: str,
  currentBalanceCents: num,
  availableBalanceCents: num,
  currency: str,
  primary: bool,
});
const StatementPayload = z.object({
  id: z.string(),
  startDate: str,
  endDate: str,
  startBalanceCents: num,
  endBalanceCents: num,
});
const TripPayload = z.object({
  id: z.string(),
  name: str,
  status: str,
  bookerUserId: str,
  startsAt: str,
  endsAt: str,
});

type Card = z.infer<typeof CardPayload>;
type User = z.infer<typeof UserPayload>;
type Expense = z.infer<typeof ExpensePayload>;
type Transaction = z.infer<typeof TransactionPayload>;

const dayOf = (value: string | null | undefined) => (value ?? "").slice(0, 10);
const monthOf = (day: string) => day.slice(0, 7);
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const nowOf = (deps: BrexCardsDeps) => deps.now?.() ?? new Date();
const window90 = (now: Date) => {
  const end = now.toISOString().slice(0, 10);
  return { start: addDays(end, -89), end };
};
const monthEnd = (month: string) => {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};
const endOfDay = (day: string) => `${day}T23:59:59.999Z`;
const days = (start: string, end: string) => {
  const out: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) out.push(day);
  return out;
};

async function callTool(
  deps: BrexCardsDeps,
  server: { id: string; spaceId: string; userId: string },
  tool: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await deps.mcp
    .callServerTool(
      server as never,
      {
        operationId: `brex-cards:${server.id}`,
        traceId: `brex-cards:${server.id}`,
        spaceId: server.spaceId,
        userId: server.userId,
        signal: AbortSignal.timeout(30_000),
      },
      tool,
      args,
    )
    .catch((error: unknown) => {
      throw new ORPCError("BAD_GATEWAY", {
        message: (error instanceof Error ? error.message : "Brex cards are unreachable").slice(
          0,
          300,
        ),
      });
    });
  const text = result.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
  if (result.isError) throw toolFailure(text);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ORPCError("BAD_GATEWAY", { message: "Brex sent a response that could not be read" });
  }
}

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ORPCError("BAD_GATEWAY", { message: "Brex sent data this page cannot read" });
  return parsed.data;
};

async function listCards(deps: BrexCardsDeps, server: Parameters<typeof callTool>[1]) {
  return parse(
    z.object({ cards: z.array(CardPayload) }),
    await callTool(deps, server, "list_cards"),
  ).cards;
}
async function listUsers(deps: BrexCardsDeps, server: Parameters<typeof callTool>[1]) {
  return parse(
    z.object({ users: z.array(UserPayload) }),
    await callTool(deps, server, "list_users"),
  ).users;
}
async function listSpendLimits(deps: BrexCardsDeps, server: Parameters<typeof callTool>[1]) {
  return parse(
    z.object({ spendLimits: z.array(SpendLimitPayload) }),
    await callTool(deps, server, "list_spend_limits"),
  ).spendLimits;
}
async function listTransactions(
  deps: BrexCardsDeps,
  server: Parameters<typeof callTool>[1],
  start: string,
) {
  const value = parse(
    z.object({ transactions: z.array(TransactionPayload), incomplete: z.boolean().optional() }),
    await callTool(deps, server, "list_card_transactions", { postedAtStart: start }),
  );
  return { items: value.transactions, incomplete: value.incomplete === true };
}
async function listExpenses(
  deps: BrexCardsDeps,
  server: Parameters<typeof callTool>[1],
  start: string,
  end: string,
) {
  const value = parse(
    z.object({ expenses: z.array(ExpensePayload), incomplete: z.boolean().optional() }),
    await callTool(deps, server, "list_expenses", {
      purchasedAtStart: start,
      purchasedAtEnd: endOfDay(end),
    }),
  );
  return { items: value.expenses, incomplete: value.incomplete === true };
}

const userName = (users: User[], id: string | null | undefined) =>
  users.find((user) => user.id === id)?.name ?? null;
const sortedMerchants = (
  map: Map<string, { cents: number; count: number }>,
  partial = false,
): BrexMerchantSpend[] =>
  [...map.entries()]
    .map(([merchant, value]) => ({ merchant, ...value, partial }))
    .sort((a, b) => b.cents - a.cents || a.merchant.localeCompare(b.merchant));

function aggregates(
  transactions: Transaction[],
  expenses: Expense[],
  partial: boolean,
): { categories: BrexCategorySpend[]; sankeyTotal: number } {
  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));
  const byCategory = new Map<string, Map<string, { cents: number; count: number }>>();
  const counts = new Map<string, { cents: number; count: number }>();
  let total = 0;
  for (const transaction of transactions) {
    if (!transaction.postedAt) continue;
    const expense = transaction.expenseId ? expensesById.get(transaction.expenseId) : undefined;
    const bucket = brexSpendBucket({ category: expense?.category, mcc: transaction.mcc });
    const merchant = transaction.merchant?.trim() || transaction.description || "Unknown merchant";
    const cents = transaction.amountCents;
    total += cents;
    const category = byCategory.get(bucket) ?? new Map();
    const merchantValue = category.get(merchant) ?? { cents: 0, count: 0 };
    merchantValue.cents += cents;
    merchantValue.count += 1;
    category.set(merchant, merchantValue);
    byCategory.set(bucket, category);
    const bucketValue = counts.get(bucket) ?? { cents: 0, count: 0 };
    bucketValue.cents += cents;
    bucketValue.count += 1;
    counts.set(bucket, bucketValue);
  }
  const categories = [...counts.entries()]
    .map(([bucket, value]) => ({
      bucket: bucket as BrexCategorySpend["bucket"],
      cents: value.cents,
      count: value.count,
      partial,
      merchants: sortedMerchants(byCategory.get(bucket) ?? new Map(), partial),
    }))
    .sort((a, b) => b.cents - a.cents || a.bucket.localeCompare(b.bucket));
  return { categories, sankeyTotal: total };
}

function sankey(categories: BrexCategorySpend[], total: number, partial: boolean) {
  return { partial, totalCents: total, categories };
}

function seriesFor(
  transactions: Transaction[],
  start: string,
  end: string,
  cardId?: string,
): BrexSpendPoint[] {
  const byDay = new Map<string, number>();
  for (const transaction of transactions) {
    if (cardId && transaction.cardId !== cardId) continue;
    const day = dayOf(transaction.postedAt);
    if (day < start || day > end) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + transaction.amountCents);
  }
  return days(start, end).map((day) => ({ day, cents: byDay.get(day) ?? 0 }));
}

function periodFor(duration: string | null | undefined, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const month = today.slice(0, 7);
  const lastDay = (monthIdx: number) =>
    new Date(Date.UTC(year, monthIdx + 1, 0)).toISOString().slice(0, 10);
  if (duration === "QUARTERLY") {
    const quarterStart = Math.floor(monthIndex / 3) * 3;
    return {
      start: `${year}-${String(quarterStart + 1).padStart(2, "0")}-01`,
      end: lastDay(quarterStart + 2),
    };
  }
  if (duration === "YEARLY") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (duration === "ONE_TIME") return { start: addDays(today, -89), end: today };
  return { start: `${month}-01`, end: lastDay(monthIndex) };
}

function usageFor(card: Card, periodSpend: number) {
  if (card.duration !== "MONTHLY" && card.duration !== "QUARTERLY") return null;
  const limit = card.limitCents;
  if (limit == null || limit <= 0) return null;
  return { usedCents: periodSpend, limitCents: limit, percent: (periodSpend / limit) * 100 };
}

function serverFields(server: { id: string; agentBotId: string | null; writesEnabled: boolean }) {
  return {
    serverId: server.id,
    agentBotId: server.agentBotId,
    writesEnabled: server.writesEnabled,
  };
}

async function sharedReads(deps: BrexCardsDeps, actor: Actor, withExpenses = true) {
  const connection = await connectionOf(deps, actor);
  const { server } = connection;
  const now = nowOf(deps);
  const window = window90(now);
  // The longest current quarter is 92 days; card usage needs those two extra days while
  // sparklines and spending ranges stay on the 90-day window.
  const fetchStart = addDays(window.start, -2);
  const [cards, users, spendLimits, transactions, expenses, cashAccounts] = await Promise.all([
    listCards(deps, server),
    listUsers(deps, server),
    listSpendLimits(deps, server),
    listTransactions(deps, server, fetchStart),
    withExpenses
      ? listExpenses(deps, server, window.start, window.end)
      : { items: [], incomplete: false },
    callTool(deps, server, "list_cash_accounts").then(
      (value) => parse(z.object({ accounts: z.array(CashAccountPayload) }), value).accounts,
    ),
  ]);
  const boundedTransactions = {
    items: transactions.items.filter((transaction) => {
      const day = dayOf(transaction.postedAt);
      return day >= fetchStart && day <= window.end;
    }),
    incomplete: transactions.incomplete,
  };
  return {
    connection,
    server,
    now,
    window,
    cards,
    users,
    spendLimits,
    transactions: boundedTransactions,
    expenses,
    cashAccounts,
  };
}

export async function brexCardsOverview(
  deps: BrexCardsDeps,
  actor: Actor,
): Promise<BrexCardsOverview> {
  const { server, now, window, cards, spendLimits, transactions, expenses, cashAccounts } =
    await sharedReads(deps, actor);
  const partial = transactions.incomplete || expenses.incomplete;
  const windowTransactions = transactions.items.filter((transaction) => {
    const day = dayOf(transaction.postedAt);
    return day >= window.start && day <= window.end;
  });
  const { categories, sankeyTotal } = aggregates(windowTransactions, expenses.items, partial);
  const allSeries = seriesFor(windowTransactions, window.start, window.end);
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${monthOf(today)}-01`;
  const prevMonth = addDays(`${monthOf(today)}-01`, -1).slice(0, 7);
  const prevStart = `${prevMonth}-01`;
  const elapsed = Number(today.slice(8, 10));
  const elapsedEnd = addDays(prevStart, elapsed - 1);
  const prevEndSame = elapsedEnd < monthEnd(prevMonth) ? elapsedEnd : monthEnd(prevMonth);
  const monthSpend = windowTransactions
    .filter((t) => dayOf(t.postedAt) >= monthStart && dayOf(t.postedAt) <= today)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const prevSpend = windowTransactions
    .filter((t) => dayOf(t.postedAt) >= prevStart && dayOf(t.postedAt) <= prevEndSame)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const changePercent = prevSpend === 0 ? null : ((monthSpend - prevSpend) / prevSpend) * 100;
  const near: BrexNearLimitItem[] = [];
  for (const card of cards) {
    if (card.status === "TERMINATED") continue;
    const period = periodFor(card.duration, now);
    const used = transactions.items
      .filter(
        (t) =>
          t.cardId === card.id &&
          dayOf(t.postedAt) >= period.start &&
          dayOf(t.postedAt) <= period.end,
      )
      .reduce((sum, t) => sum + t.amountCents, 0);
    const usage = usageFor(card, used);
    if (usage && usage.percent >= 80)
      near.push({
        kind: "card",
        id: card.id,
        name: card.name ?? card.id,
        usedCents: usage.usedCents,
        limitCents: usage.limitCents,
        percent: usage.percent,
      });
  }
  for (const limit of spendLimits) {
    const used = limit.currentPeriodBalance?.amountSpentCents;
    const base = limit.baseLimitCents;
    if (used != null && base != null && base > 0 && (used / base) * 100 >= 80)
      near.push({
        kind: "spend_limit",
        id: limit.id,
        name: limit.name ?? limit.id,
        usedCents: used,
        limitCents: base,
        percent: (used / base) * 100,
      });
  }
  near.sort((a, b) => b.percent - a.percent);
  const vendorMap = new Map<string, { cents: number; count: number }>();
  for (const transaction of windowTransactions) {
    const merchant = transaction.merchant?.trim() || transaction.description || "Unknown merchant";
    const value = vendorMap.get(merchant) ?? { cents: 0, count: 0 };
    value.cents += transaction.amountCents;
    value.count += 1;
    vendorMap.set(merchant, value);
  }
  return {
    ...serverFields(server),
    partial,
    cash: {
      totalCents: cashAccounts.reduce(
        (sum, account) => sum + (account.currentBalanceCents ?? 0),
        0,
      ),
      availableCents: cashAccounts.reduce(
        (sum, account) => sum + (account.availableBalanceCents ?? 0),
        0,
      ),
      accountCount: cashAccounts.length,
    },
    cardSpend: {
      partial,
      monthToDateCents: monthSpend,
      previousMonthToDateCents: prevSpend,
      changePercent,
      sparkline: allSeries,
    },
    cards: {
      active: cards.filter((card) => card.status !== "TERMINATED").length,
      locked: cards.filter((card) => card.status === "LOCKED").length,
      terminated: cards.filter((card) => card.status === "TERMINATED").length,
    },
    nearLimit: { partial, count: near.length, items: near },
    sankey: sankey(categories, sankeyTotal, partial),
    topVendors: sortedMerchants(vendorMap, partial),
  };
}

export async function brexCardsView(deps: BrexCardsDeps, actor: Actor): Promise<BrexCardsView> {
  const { server, now, window, cards, users, transactions } = await sharedReads(deps, actor, false);
  const partial = transactions.incomplete;
  const views: BrexCardView[] = cards.map((card) => {
    const period = periodFor(card.duration, now);
    const periodTransactions = transactions.items.filter(
      (transaction) =>
        transaction.cardId === card.id &&
        dayOf(transaction.postedAt) >= period.start &&
        dayOf(transaction.postedAt) <= period.end,
    );
    const periodSpendCents = periodTransactions.reduce((sum, t) => sum + t.amountCents, 0);
    return {
      cardId: card.id,
      name: card.name ?? "",
      lastFour: card.lastFour ?? "",
      ownerUserId: card.ownerUserId ?? null,
      status: card.status ?? "UNKNOWN",
      limitCents: card.limitCents ?? null,
      currency: card.currency ?? null,
      duration: card.duration ?? null,
      cardType: card.type ?? null,
      lockAfterDate: card.lockAfterDate ?? null,
      allowedMerchants: card.allowedMerchants ?? [],
      blockedMerchants: card.blockedMerchants ?? [],
      ownerName: userName(users, card.ownerUserId ?? null),
      period,
      periodSpendCents,
      series: seriesFor(transactions.items, window.start, window.end, card.id),
      usage: usageFor(card, periodSpendCents),
      partial,
    };
  });
  return { ...serverFields(server), partial, cards: views };
}

export async function brexCardsSpending(
  deps: BrexCardsDeps,
  actor: Actor,
  input: {
    merchant?: string;
    cardId?: string;
    userId?: string;
    category?: BrexSpendTransaction["bucket"];
    from?: string;
    to?: string;
  },
): Promise<BrexSpending> {
  const { server, window, cards, users, transactions, expenses } = await sharedReads(deps, actor);
  const partial = transactions.incomplete || expenses.incomplete;
  const expensesById = new Map(expenses.items.map((expense) => [expense.id, expense]));
  const from = input.from ?? window.start;
  const to = input.to ?? window.end;
  if (from > to || from < window.start || to > window.end)
    throw new ORPCError("BAD_REQUEST", { message: "Spending covers the last 90 days only" });
  const merchantNeedle = input.merchant?.trim().toLowerCase();
  const filtered = transactions.items.filter((transaction) => {
    const day = dayOf(transaction.postedAt);
    if (day < from || day > to) return false;
    if (input.cardId && transaction.cardId !== input.cardId) return false;
    if (input.userId) {
      const card = cards.find((candidate) => candidate.id === transaction.cardId);
      if (card?.ownerUserId !== input.userId) return false;
    }
    if (merchantNeedle) {
      const haystack = `${transaction.merchant ?? ""} ${transaction.description}`.toLowerCase();
      if (!haystack.includes(merchantNeedle)) return false;
    }
    if (input.category) {
      const expense = transaction.expenseId ? expensesById.get(transaction.expenseId) : undefined;
      if (brexSpendBucket({ category: expense?.category, mcc: transaction.mcc }) !== input.category)
        return false;
    }
    return true;
  });
  const { categories, sankeyTotal } = aggregates(filtered, expenses.items, partial);
  const rows: BrexSpendTransaction[] = filtered.map((transaction) => {
    const card = cards.find((candidate) => candidate.id === transaction.cardId);
    const expense = transaction.expenseId ? expensesById.get(transaction.expenseId) : undefined;
    return {
      id: transaction.id,
      postedAt: transaction.postedAt,
      day: dayOf(transaction.postedAt),
      cardId: transaction.cardId ?? null,
      cardName: card?.name ?? null,
      cardLastFour: card?.lastFour ?? null,
      userId: card?.ownerUserId ?? null,
      userName: userName(users, card?.ownerUserId ?? null),
      merchant: transaction.merchant ?? null,
      description: transaction.description,
      amountCents: transaction.amountCents,
      currency: transaction.currency ?? null,
      bucket: brexSpendBucket({ category: expense?.category, mcc: transaction.mcc }),
      expenseId: transaction.expenseId ?? null,
    };
  });
  const duplicateMap = new Map<string, BrexSpending["duplicates"][number]>();
  for (const transaction of rows) {
    const merchant = transaction.merchant?.trim();
    if (!merchant || !transaction.cardId) continue;
    const month = monthOf(transaction.day);
    const key = `${month}:${merchant.toLowerCase()}`;
    const value = duplicateMap.get(key) ?? {
      merchant,
      month,
      cardIds: [],
      cardNames: [],
      cents: 0,
      count: 0,
      partial,
    };
    if (!value.cardIds.includes(transaction.cardId)) {
      value.cardIds.push(transaction.cardId);
      value.cardNames.push(transaction.cardName ?? transaction.cardId);
    }
    value.cents += transaction.amountCents;
    value.count += 1;
    duplicateMap.set(key, value);
  }
  const duplicates = [...duplicateMap.values()].filter((value) => value.cardIds.length > 1);
  duplicates.sort((a, b) => b.cents - a.cents || a.merchant.localeCompare(b.merchant));
  return {
    ...serverFields(server),
    partial,
    range: { from, to },
    totalCents: sankeyTotal,
    transactions: rows.sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    categories,
    sankey: sankey(categories, sankeyTotal, partial),
    duplicates,
  };
}

export async function brexCardsLimits(deps: BrexCardsDeps, actor: Actor): Promise<BrexLimits> {
  const server = (await connectionOf(deps, actor)).server;
  const [spendLimits, users] = await Promise.all([
    listSpendLimits(deps, server),
    listUsers(deps, server),
  ]);
  const limits: BrexSpendLimitView[] = spendLimits.map((limit) => {
    const used = limit.currentPeriodBalance?.amountSpentCents ?? null;
    const base = limit.baseLimitCents ?? null;
    return {
      spendLimitId: limit.id,
      name: limit.name ?? "",
      status: limit.status ?? null,
      period: limit.period ?? null,
      startDate: limit.startDate ?? null,
      endDate: limit.endDate ?? null,
      limitCents: base,
      currency: limit.currentPeriodBalance?.currency ?? limit.currency ?? null,
      usedCents: used,
      percent: used != null && base != null && base > 0 ? (used / base) * 100 : null,
      memberUserIds: limit.memberUserIds ?? [],
      members: (limit.memberUserIds ?? []).map((userId) => ({
        userId,
        name: userName(users, userId) ?? userId,
      })),
    };
  });
  return { ...serverFields(server), partial: false, limits };
}

export async function brexCardsPeople(deps: BrexCardsDeps, actor: Actor): Promise<BrexPeople> {
  const { server } = await connectionOf(deps, actor);
  const now = nowOf(deps);
  const window = window90(now);
  const [cards, users, spendLimits, transactions] = await Promise.all([
    listCards(deps, server),
    listUsers(deps, server),
    listSpendLimits(deps, server),
    listTransactions(deps, server, window.start),
  ]);
  const partial = transactions.incomplete;
  const monthStart = `${monthOf(now.toISOString().slice(0, 10))}-01`;
  const people: BrexPerson[] = users.map((user) => {
    const userCards = cards.filter((card) => card.ownerUserId === user.id);
    const limits = spendLimits.filter((limit) => (limit.memberUserIds ?? []).includes(user.id));
    const userTransactions = transactions.items.filter((transaction) => {
      const day = dayOf(transaction.postedAt);
      if (day < window.start || day > window.end) return false;
      const card = cards.find((candidate) => candidate.id === transaction.cardId);
      return card?.ownerUserId === user.id;
    });
    const monthSpendCents = userTransactions
      .filter((t) => {
        const day = dayOf(t.postedAt);
        return day >= monthStart && day <= window.end;
      })
      .reduce((sum, t) => sum + t.amountCents, 0);
    return {
      userId: user.id,
      name: user.name ?? user.id,
      email: user.email ?? null,
      status: user.status ?? null,
      cards: userCards.map((card) => ({
        cardId: card.id,
        name: card.name ?? "",
        lastFour: card.lastFour ?? "",
        status: card.status ?? "UNKNOWN",
      })),
      activeCardCount: userCards.filter((card) => card.status !== "TERMINATED").length,
      terminatedCardCount: userCards.filter((card) => card.status === "TERMINATED").length,
      spendLimitIds: limits.map((limit) => limit.id),
      spendLimitNames: limits.map((limit) => limit.name ?? limit.id),
      monthSpendCents,
      windowSpendCents: userTransactions.reduce((sum, t) => sum + t.amountCents, 0),
      partial,
    };
  });
  people.sort((a, b) => a.name.localeCompare(b.name));
  return { ...serverFields(server), partial, people };
}

function expenseView(
  expense: Expense,
  users: User[],
  cardByExpense: Map<string, string>,
): BrexExpenseView {
  const memo = expense.memo ?? null;
  return {
    expenseId: expense.id,
    purchasedAt: expense.purchasedAt ?? null,
    day: expense.purchasedAt ? dayOf(expense.purchasedAt) : null,
    userId: expense.userId ?? null,
    userName: userName(users, expense.userId ?? null),
    merchant: expense.merchant ?? null,
    memo,
    status: expense.status ?? null,
    paymentStatus: expense.paymentStatus ?? null,
    expenseType: expense.expenseType ?? null,
    category: expense.category ?? null,
    bucket: brexSpendBucket({ category: expense.category, mcc: expense.merchantMcc }),
    amountCents: expense.amountCents ?? null,
    currency: expense.currency ?? null,
    receipts: expense.receipts ?? [],
    missingReceipt: (expense.receipts ?? []).length === 0,
    missingMemo: !memo?.trim(),
    complianceStatus: expense.complianceStatus ?? null,
    cardId: cardByExpense.get(expense.id) ?? null,
  };
}

export async function brexCardsExpenses(deps: BrexCardsDeps, actor: Actor): Promise<BrexExpenses> {
  const server = (await connectionOf(deps, actor)).server;
  const now = nowOf(deps);
  const window = window90(now);
  const [expensePage, reimbursementPage, users, transactions] = await Promise.all([
    listExpenses(deps, server, window.start, window.end),
    callTool(deps, server, "list_reimbursements", {
      purchasedAtStart: window.start,
      purchasedAtEnd: endOfDay(window.end),
    }).then((value) =>
      parse(
        z.object({ reimbursements: z.array(ExpensePayload), incomplete: z.boolean().optional() }),
        value,
      ),
    ),
    listUsers(deps, server),
    listTransactions(deps, server, window.start),
  ]);
  const partial =
    expensePage.incomplete || reimbursementPage.incomplete === true || transactions.incomplete;
  const cardByExpense = new Map(
    transactions.items
      .filter((transaction) => transaction.expenseId && transaction.cardId)
      .map((transaction) => [transaction.expenseId as string, transaction.cardId as string]),
  );
  const sortRows = (rows: BrexExpenseView[]) =>
    rows.sort((a, b) => (b.purchasedAt ?? "").localeCompare(a.purchasedAt ?? ""));
  return {
    ...serverFields(server),
    partial,
    expenses: sortRows(
      expensePage.items.map((expense) => expenseView(expense, users, cardByExpense)),
    ),
    reimbursements: sortRows(
      reimbursementPage.reimbursements.map((expense) => expenseView(expense, users, cardByExpense)),
    ),
  };
}

export async function brexCardsAccounts(deps: BrexCardsDeps, actor: Actor): Promise<BrexAccounts> {
  const server = (await connectionOf(deps, actor)).server;
  const accounts = parse(
    z.object({ accounts: z.array(CashAccountPayload) }),
    await callTool(deps, server, "list_cash_accounts"),
  ).accounts;
  const statementsFor = async (cashAccountId?: string) =>
    parse(
      z.object({ statements: z.array(StatementPayload) }),
      await callTool(deps, server, "list_statements", cashAccountId ? { cashAccountId } : {}),
    ).statements;
  const [cardStatements, ...cashStatements] = await Promise.all([
    statementsFor(),
    ...accounts.map((account) => statementsFor(account.id)),
  ]);
  return {
    ...serverFields(server),
    accounts: accounts.map((account) => ({
      cashAccountId: account.id,
      name: account.name ?? null,
      status: account.status ?? null,
      currentBalanceCents: account.currentBalanceCents ?? null,
      availableBalanceCents: account.availableBalanceCents ?? null,
      currency: account.currency ?? null,
      primary: account.primary ?? null,
    })),
    statements: [
      ...cardStatements.map((statement) => ({
        statementId: statement.id,
        accountKind: "card" as const,
        cashAccountId: null,
        accountName: "Card account",
        startDate: statement.startDate ?? null,
        endDate: statement.endDate ?? null,
        startBalanceCents: statement.startBalanceCents ?? null,
        endBalanceCents: statement.endBalanceCents ?? null,
      })),
      ...accounts.flatMap((account, index) =>
        cashStatements[index]!.map((statement) => ({
          statementId: statement.id,
          accountKind: "cash" as const,
          cashAccountId: account.id,
          accountName: account.name ?? null,
          startDate: statement.startDate ?? null,
          endDate: statement.endDate ?? null,
          startBalanceCents: statement.startBalanceCents ?? null,
          endBalanceCents: statement.endBalanceCents ?? null,
        })),
      ),
    ],
  };
}

export async function brexCardsTrips(deps: BrexCardsDeps, actor: Actor): Promise<BrexTrips> {
  const server = (await connectionOf(deps, actor)).server;
  const [tripPage, users] = await Promise.all([
    callTool(deps, server, "list_trips").then(
      (value) => parse(z.object({ trips: z.array(TripPayload) }), value).trips,
    ),
    listUsers(deps, server),
  ]);
  const trips: BrexTrip[] = tripPage.map((trip) => ({
    tripId: trip.id,
    name: trip.name ?? null,
    status: trip.status ?? null,
    bookerUserId: trip.bookerUserId ?? null,
    bookerName: userName(users, trip.bookerUserId ?? null),
    startsAt: trip.startsAt ?? null,
    endsAt: trip.endsAt ?? null,
  }));
  trips.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  return { ...serverFields(server), trips };
}

function activityTarget(args: Record<string, unknown>) {
  for (const key of ["cardName", "spendLimitName", "name", "expenseId", "cardId", "spendLimitId"]) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

export async function brexCardsActivity(deps: BrexCardsDeps, actor: Actor): Promise<BrexActivity> {
  const server = (await connectionOf(deps, actor)).server;
  const effects = await deps.prisma.externalEffect.findMany({
    where: server.agentBotId
      ? { spaceId: actor.spaceId, run: { botId: server.agentBotId } }
      : { spaceId: actor.spaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const activities = effects.flatMap((effect) => {
    const bound = boundDirectApprovalDetails(effect.request, CATALOG_APPROVAL_TOOL);
    const catalog = catalogApprovalDetails(effect.request, CATALOG_APPROVAL_TOOL);
    let route: { connectorId: string; resourceId?: string; toolName: string } | undefined;
    let args: Record<string, unknown> = {};
    if (bound) {
      route = bound.route;
      args = bound.args;
    } else if (catalog) {
      route = catalog.route;
      args = catalogApprovalInnerArgs(catalog) ?? catalog.args;
      if (!route) {
        const target = parseCatalogApprovalTarget(catalog.args);
        if (target) {
          route = {
            connectorId: catalogApprovalConnectorId(catalog.toolName),
            resourceId: target.resourceId,
            toolName: target.toolName,
          };
        }
      }
    }
    if (
      route?.connectorId !== "mcp" ||
      route.resourceId !== server.id ||
      !WRITE_TOOLS.has(route.toolName)
    )
      return [];
    return [
      {
        effectId: effect.id,
        at: effect.createdAt.toISOString(),
        action: route.toolName,
        target: activityTarget(args),
        status: effect.status,
      },
    ];
  });
  return { ...serverFields(server), activities };
}
