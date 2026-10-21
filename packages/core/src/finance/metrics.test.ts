import { describe, expect, it } from "vitest";
import {
  accountBalanceHistory,
  averageMonthCents,
  balanceGrid,
  balanceHistory,
  breakdown,
  cashAtDays,
  cashHistory,
  cashSeries,
  cashSummary,
  classify,
  detectRecurring,
  earliestDay,
  excludedNonUsdCount,
  monthlyBurn,
  monthlySeries,
  monthlySpend,
  OVERLAP_GROUPS,
  projectCash,
  runway,
  spendTotals,
  subscriptions,
  upcoming,
} from "./metrics.js";
import type {
  ClassifyContext,
  FinanceAccount,
  FinanceBill,
  FinanceClassification,
  FinanceRawTxn,
  FinanceTransaction,
} from "./types.js";
import { categorySlug, vendorKey } from "./vendor.js";

// Wednesday 2026-10-14. Everything below is synthetic.
const NOW = new Date("2026-10-14T15:00:00Z");

let seq = 0;
function txn(
  date: string,
  dollars: number,
  counterpartyOrOver: string | Partial<FinanceTransaction> = "Acme",
  maybeOver: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  seq += 1;
  const counterparty = typeof counterpartyOrOver === "string" ? counterpartyOrOver : "Acme";
  const over = typeof counterpartyOrOver === "string" ? maybeOver : counterpartyOrOver;
  return {
    id: `t${seq}`,
    provider: "mercury",
    externalId: `x${seq}`,
    accountExternalId: "acct-checking",
    postedAt: `${date}T12:00:00.000Z`,
    purchasedAt: null,
    amountCents: Math.round(dollars * 100),
    currency: "USD",
    counterparty,
    vendorKey: vendorKey((over as Partial<FinanceTransaction>).counterparty ?? counterparty),
    category: null,
    status: "posted",
    kind: "other",
    classification: "spend",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: false,
    dashboardUrl: null,
    ...over,
  };
}
const as = (classification: FinanceClassification) => ({ classification });

function account(over: Partial<FinanceAccount>): FinanceAccount {
  return {
    id: "a1",
    provider: "mercury",
    externalId: "acct-checking",
    name: "Mercury Checking",
    lastFour: "1111",
    kind: "checking",
    balanceCents: 0,
    currency: "USD",
    ...over,
  };
}

describe("classify", () => {
  const ctx: ClassifyContext = { brexConnected: true, ownAccountNames: ["Mercury Savings"] };
  const raw = (over: Partial<FinanceRawTxn>): FinanceRawTxn => ({
    provider: "mercury",
    amountCents: -1000,
    counterparty: "Acme",
    kind: "other",
    category: null,
    ...over,
  });

  it("treats Treasury transfers as internal in both directions", () => {
    expect(classify(raw({ kind: "treasuryTransfer", amountCents: -500000 }), ctx)).toBe(
      "internal_transfer",
    );
    expect(classify(raw({ kind: "treasuryTransfer", amountCents: 500000 }), ctx)).toBe(
      "internal_transfer",
    );
  });
  it("treats a move to the user's own account as internal", () => {
    expect(classify(raw({ counterparty: "Mercury Savings" }), ctx)).toBe("internal_transfer");
    expect(classify(raw({ counterparty: "Mercury Savings xx1234" }), ctx)).toBe(
      "internal_transfer",
    );
    expect(
      classify(raw({ counterparty: "Mercury Savings Bank" }), { ...ctx, ownAccountNames: [] }),
    ).toBe("spend");
  });
  it("marks Brex payments as card payments only when Brex is connected", () => {
    const pay = raw({ counterparty: "Brex Inc.", category: "Credit & Loan Payments" });
    expect(classify(pay, ctx)).toBe("card_payment");
    expect(classify(raw({ counterparty: "BREX", category: null }), ctx)).toBe("card_payment");
    expect(classify(pay, { ...ctx, brexConnected: false })).toBe("spend");
    expect(classify(raw({ counterparty: "Brex", category: "Software" }), ctx)).toBe("spend");
  });
  it("classifies financing, revenue and refunds", () => {
    expect(
      classify(
        raw({
          amountCents: 9_000_000,
          category: "Financing Proceeds",
          kind: "incomingDomesticWire",
        }),
        ctx,
      ),
    ).toBe("financing");
    expect(classify(raw({ amountCents: 5000, counterparty: "STRIPE", category: null }), ctx)).toBe(
      "revenue",
    );
    expect(classify(raw({ amountCents: 5000, category: "Revenue" }), ctx)).toBe("revenue");
    expect(classify(raw({ amountCents: 5000, kind: "incomingDomesticWire" }), ctx)).toBe("revenue");
    expect(
      classify(raw({ amountCents: 1500, category: "Software", counterparty: "Vercel" }), ctx),
    ).toBe("spend");
    expect(classify(raw({ amountCents: 1500, kind: "debitCardTransaction" }), ctx)).toBe("spend");
  });
  it("keeps a transfer in from the owner's own account out of revenue", () => {
    expect(
      classify(
        raw({
          amountCents: 9_000_000,
          category: "Transfer",
          kind: "incomingDomesticWire",
          counterparty: "1/COINBASE, INC.",
        }),
        ctx,
      ),
    ).toBe("internal_transfer");
  });
  it("treats an uncategorized credit that is not a wire as a refund", () => {
    expect(
      classify(
        raw({ amountCents: 120000, counterparty: "Benefits Trust", kind: "other", category: null }),
        ctx,
      ),
    ).toBe("spend");
  });
  it("counts a deposit on an uploaded statement as revenue, never as a refund against spend", () => {
    const line = raw({ provider: "statement", kind: "statement", counterparty: "Customer Beta" });
    expect(classify({ ...line, amountCents: 120000 }, ctx)).toBe("revenue");
    expect(classify({ ...line, amountCents: -25000 }, ctx)).toBe("spend");
    expect(classify({ ...line, amountCents: 5000, counterparty: "Mercury Savings" }, ctx)).toBe(
      "internal_transfer",
    );
  });
  it("nets a statement refund off spend and keeps a deposit as revenue", () => {
    const line = raw({ provider: "statement", kind: "statement" });
    const buy = classify({ ...line, amountCents: -10000, counterparty: "Acme Store" }, ctx);
    const refund = classify(
      { ...line, amountCents: 10000, counterparty: "Acme Store REFUND" },
      ctx,
    );
    const deposit = classify({ ...line, amountCents: 10000, counterparty: "Customer Beta" }, ctx);
    expect([buy, refund, deposit]).toEqual(["spend", "spend", "revenue"]);
  });
  it("counts other outgoing money and every Brex expense as spend", () => {
    expect(classify(raw({ category: "Payroll" }), ctx)).toBe("spend");
    expect(classify(raw({ provider: "brex", amountCents: -2000, kind: "CARD" }), ctx)).toBe(
      "spend",
    );
    expect(classify(raw({ provider: "brex", amountCents: 2000, kind: "CARD" }), ctx)).toBe("spend");
  });
});

describe("cashSummary with stablecoins", () => {
  it("adds stablecoins to cash and keeps the bank figure apart", () => {
    const s = cashSummary([account({ kind: "checking", balanceCents: 1000 })], 250);
    expect(s).toMatchObject({ cashCents: 1250, bankCashCents: 1000, stablecoinCents: 250 });
  });
  it("runway on cash with stablecoins is longer than on bank cash alone", () => {
    const now = new Date("2026-10-14T00:00:00Z");
    expect(runway(1250, 100, now).months).toBe(12.5);
    expect(runway(1000, 100, now).months).toBe(10);
  });
});

describe("cashSummary", () => {
  it("adds checking, savings and Treasury, and keeps card balance owed apart", () => {
    const s = cashSummary([
      account({ kind: "checking", balanceCents: 100 }),
      account({ kind: "checking", balanceCents: 50 }),
      account({ kind: "savings", balanceCents: 20 }),
      account({ kind: "treasury", balanceCents: 1000 }),
      account({ provider: "brex", kind: "card", balanceCents: 400 }),
    ]);
    expect(s).toEqual({
      cashCents: 1170,
      bankCashCents: 1170,
      stablecoinCents: 0,
      checkingCents: 150,
      savingsCents: 20,
      treasuryCents: 1000,
      cardOwedCents: 400,
      cashAccountCount: 4,
    });
  });
  it("reports no card balance when there is no card account", () => {
    expect(cashSummary([account({ balanceCents: 5 })]).cardOwedCents).toBeNull();
    expect(cashSummary([])).toMatchObject({ cashCents: 0, cardOwedCents: null });
  });
});

describe("spendTotals", () => {
  const txns = [
    txn("2026-10-13", -10), // Tue this week
    txn("2026-10-12", -5), // Mon this week
    txn("2026-10-11", -20), // Sun, previous week
    txn("2026-10-06", -30), // Tue, previous week
    txn("2026-09-29", -99), // before the previous week
    txn("2026-10-12", -400, as("card_payment")),
    txn("2026-10-12", -400, as("internal_transfer")),
    txn("2026-10-12", 700, as("revenue")),
    txn("2026-10-12", 700, as("financing")),
    txn("2026-10-13", 2, { classification: "spend" }), // refund nets off
    txn("2026-10-13", -77, { status: "other" }),
  ];
  it("compares the week to date with the same weekdays of the previous week, starting Monday", () => {
    const prior = [
      ...txns,
      txn("2026-10-05", -100), // Mon, compared
      txn("2026-10-07", -50), // Wed, compared
      txn("2026-10-08", -900), // Thu, after the compared days
    ];
    expect(spendTotals(prior, "week", NOW)).toEqual({
      period: "week",
      currentCents: 1300,
      previousCents: 18000,
      changePct: -92.8,
      start: "2026-10-12",
      end: "2026-10-15",
      previousStart: "2026-10-05",
      previousEnd: "2026-10-08",
    });
  });
  it("covers month, quarter and year boundaries", () => {
    const all = [
      txn("2026-10-02", -1),
      txn("2026-09-14", -2),
      txn("2026-09-15", -64), // after the compared days
      txn("2026-07-14", -4),
      txn("2026-07-15", -128), // after the compared days
      txn("2026-06-30", -8),
      txn("2026-01-01", -16),
      txn("2025-12-31", -32),
      txn("2025-10-14", -256),
      txn("2025-10-15", -512),
    ];
    const month = spendTotals(all, "month", NOW);
    expect([month.currentCents, month.previousCents, month.start, month.previousStart]).toEqual([
      100,
      200,
      "2026-10-01",
      "2026-09-01",
    ]);
    const quarter = spendTotals(all, "quarter", NOW);
    expect([
      quarter.currentCents,
      quarter.previousCents,
      quarter.start,
      quarter.previousStart,
    ]).toEqual([100, 400, "2026-10-01", "2026-07-01"]);
    const year = spendTotals(all, "year", NOW);
    expect([year.currentCents, year.previousCents, year.start]).toEqual([
      22300,
      25600,
      "2026-01-01",
    ]);
  });
  it("clamps the comparison to the previous period's length", () => {
    const feb = [txn("2026-02-28", -5), txn("2026-02-01", -7), txn("2026-03-31", -1)];
    const t = spendTotals(feb, "month", new Date("2026-03-31T12:00:00Z"));
    expect([t.previousStart, t.previousEnd, t.previousCents]).toEqual([
      "2026-02-01",
      "2026-03-01",
      1200,
    ]);
    expect(spendTotals([], "month", new Date("2024-03-31T12:00:00Z")).previousEnd).toBe(
      "2024-03-01",
    );
  });
  it("uses the purchase date, in UTC, and gives a null change when nothing was spent before", () => {
    // Posted after midnight UTC on Tuesday the 6th but bought on Monday the 5th.
    const t = txn("2026-10-06", -10, { purchasedAt: "2026-10-05T23:30:00.000Z" });
    expect(spendTotals([t], "week", NOW)).toMatchObject({ currentCents: 0, previousCents: 1000 });
    expect(spendTotals([txn("2026-10-13", -10)], "week", NOW).changePct).toBeNull();
  });
  it("keeps Monday as the week start when now is Sunday or Monday", () => {
    expect(spendTotals([], "week", new Date("2026-10-18T23:59:00Z")).start).toBe("2026-10-12");
    expect(spendTotals([], "week", new Date("2026-10-19T00:00:00Z")).start).toBe("2026-10-19");
  });
});

describe("monthlySeries and monthlyBurn", () => {
  const txns = [
    txn("2026-10-02", -50), // current month, partial
    txn("2026-09-10", -1000),
    txn("2026-09-12", 400, as("revenue")),
    txn("2026-08-10", -2000),
    txn("2026-08-12", 500, as("revenue")),
    txn("2026-07-10", -3000),
    txn("2026-07-12", 600, as("revenue")),
    txn("2026-07-13", 9000, as("financing")),
    txn("2026-07-14", -777, as("internal_transfer")),
    txn("2026-06-10", -9999), // outside the burn window
    txn("2025-09-30", -123), // outside the 12 months
  ];
  it("returns 12 months, oldest first, with a partial last month", () => {
    const series = monthlySeries(txns, NOW);
    expect(series).toHaveLength(12);
    expect(series[0]?.month).toBe("2025-11");
    expect(series[11]).toEqual({
      month: "2026-10",
      outCents: 5000,
      revenueCents: 0,
      financingCents: 0,
      partial: true,
    });
    expect(series[10]).toMatchObject({
      month: "2026-09",
      outCents: 100000,
      revenueCents: 40000,
      partial: false,
    });
    expect(series[8]).toMatchObject({ month: "2026-07", financingCents: 900000 });
    expect(series.filter((p) => p.partial)).toHaveLength(1);
  });
  it("averages out minus revenue over the 3 full months before this one", () => {
    const burn = monthlyBurn(txns, NOW);
    expect(burn.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    // (3000-600 + 2000-500 + 1000-400) / 3 = 1500 dollars
    expect(burn.monthlyCents).toBe(150000);
  });
  it("is negative when revenue exceeds spend", () => {
    expect(monthlyBurn([txn("2026-09-10", 500, as("revenue"))], NOW).monthlyCents).toBeLessThan(0);
  });
  it("crosses a year boundary", () => {
    const burn = monthlyBurn([txn("2025-12-15", -300)], new Date("2026-02-10T00:00:00Z"));
    expect(burn.months).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(burn.monthlyCents).toBe(10000);
  });
});

describe("runway and projectCash", () => {
  it("divides cash by burn and dates the run-out", () => {
    expect(runway(1_200_000, 100_000, NOW)).toEqual({ months: 12, runOutDate: "2027-10-14" });
  });
  it("has no runway when not burning", () => {
    expect(runway(1_000, 0, NOW)).toEqual({ months: null, runOutDate: null });
    expect(runway(1_000, -5, NOW)).toEqual({ months: null, runOutDate: null });
  });
  it("is zero months with no cash", () => {
    expect(runway(0, 100, NOW)).toEqual({ months: 0, runOutDate: "2026-10-14" });
  });
  it("projects cash down to zero", () => {
    expect(projectCash(250, 100, NOW)).toEqual([
      { month: "2026-10", balanceCents: 250 },
      { month: "2026-11", balanceCents: 150 },
      { month: "2026-12", balanceCents: 50 },
      { month: "2027-01", balanceCents: 0 },
    ]);
  });
  it("stops at 24 months and returns [] when not burning", () => {
    expect(projectCash(1_000_000, 1, NOW)).toHaveLength(24);
    expect(projectCash(1_000, 0, NOW)).toEqual([]);
  });
});

describe("breakdown", () => {
  const range = { start: "2026-09-01", end: "2026-10-01" };
  const txns = [
    txn("2026-09-02", -100, { category: "Software", counterparty: "Vercel Inc" }),
    txn("2026-09-03", -50, { category: "software", counterparty: "VERCEL" }),
    txn("2026-09-04", -300, {
      category: "Payroll",
      counterparty: "Payroll Co",
      accountExternalId: "acct-2",
    }),
    txn("2026-09-05", -20, { counterparty: "Cafe" }),
    txn("2026-09-05", 5, { counterparty: "Cafe" }), // refund
    txn("2026-10-01", -999), // end is exclusive
    txn("2026-08-31", -999),
    txn("2026-09-06", -999, as("card_payment")),
    txn("2026-09-07", -999, as("internal_transfer")),
  ];
  it("groups by category slug, largest first, merging case variants", () => {
    expect(breakdown(txns, "category", range)).toEqual([
      { key: "payroll", label: "Payroll", cents: 30000 },
      { key: "software", label: "software", cents: 15000 },
      { key: "uncategorized", label: "Uncategorized", cents: 1500 },
    ]);
  });
  it("groups by vendor with the latest counterparty as label", () => {
    expect(breakdown(txns, "vendor", range)).toEqual([
      { key: "payroll", label: "Payroll Co", cents: 30000 },
      { key: "vercel", label: "VERCEL", cents: 15000 },
      { key: "cafe", label: "Cafe", cents: 1500 },
    ]);
  });
  it("groups by account", () => {
    expect(breakdown(txns, "account", range)).toEqual(
      [
        { key: "acct-checking", label: "acct-checking", cents: 16500 },
        { key: "acct-2", label: "acct-2", cents: 30000 },
      ].sort((a, b) => b.cents - a.cents),
    );
  });
});

describe("monthlySpend", () => {
  const txns = [
    txn("2026-10-01", -10, { category: "Software" }),
    txn("2026-08-15", -20, { category: "Software" }),
    txn("2026-08-16", -40, { category: "Meals" }),
  ];
  it("zero-fills months and applies the filters", () => {
    expect(monthlySpend(txns, {}, NOW, 3)).toEqual([
      { month: "2026-08", cents: 6000 },
      { month: "2026-09", cents: 0 },
      { month: "2026-10", cents: 1000 },
    ]);
    expect(monthlySpend(txns, { categorySlug: "software" }, NOW, 3).map((m) => m.cents)).toEqual([
      2000, 0, 1000,
    ]);
    expect(monthlySpend(txns, { vendorKey: "nobody" }, NOW, 2).map((m) => m.cents)).toEqual([0, 0]);
  });
});

describe("accountBalanceHistory", () => {
  it("starts at the month end before the account's first transaction", () => {
    const acct = account({ balanceCents: 10_500 });
    const history = accountBalanceHistory(
      acct,
      [txn("2026-09-18", -450), txn("2026-09-03", 1200)],
      NOW,
    );
    expect(history.map((p) => p.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(history[0]?.balanceCents).toBe(10_500 + 45_000 - 120_000);
  });
  it("keeps all 12 months for an account with no transactions", () => {
    expect(accountBalanceHistory(account({ balanceCents: 1 }), [], NOW)).toHaveLength(12);
  });
});

describe("balanceHistory", () => {
  it("rebuilds month-end balances backwards from today", () => {
    const acct = account({ balanceCents: 10_000 });
    const history = balanceHistory(
      acct,
      [
        txn("2026-10-05", -10), // this month
        txn("2026-09-20", 40, as("revenue")),
        txn("2026-08-10", -5),
        txn("2026-09-21", -99, { accountExternalId: "other-account" }),
      ],
      NOW,
      4,
    );
    expect(history).toEqual([
      { month: "2026-07", balanceCents: 10_000 + 1000 - 4000 + 500 },
      { month: "2026-08", balanceCents: 10_000 + 1000 - 4000 },
      { month: "2026-09", balanceCents: 10_000 + 1000 },
      { month: "2026-10", balanceCents: 10_000 },
    ]);
  });
  it("defaults to 12 months and flips the sign for a card's balance owed", () => {
    const card = account({
      provider: "brex",
      externalId: "card-acct",
      kind: "card",
      balanceCents: 5000,
    });
    const history = balanceHistory(
      card,
      [txn("2026-10-02", -8, { provider: "brex", accountExternalId: "card-acct" })],
      NOW,
    );
    expect(history).toHaveLength(12);
    expect(history[10]?.balanceCents).toBe(4200);
    expect(history[11]?.balanceCents).toBe(5000);
  });
});

describe("comparison coverage", () => {
  it("has no previous period that starts before the earliest synced day", () => {
    const txns = [txn("2025-03-20", -50), txn("2026-10-05", -10)];
    const since = earliestDay(txns);
    expect(since).toBe("2025-03-20");
    // Last year starts 2025-01-01, before the data; last month starts 2026-09-01, inside it.
    expect(spendTotals(txns, "year", NOW, since)).toMatchObject({
      previousCents: null,
      changePct: null,
    });
    expect(spendTotals(txns, "month", NOW, since)).toMatchObject({ previousCents: 0 });
    expect(spendTotals(txns, "year", NOW).previousCents).toBe(5000);
  });
});

describe("non-USD transactions", () => {
  it("are left out of the sums and counted", () => {
    const txns = [
      txn("2026-10-05", -10),
      txn("2026-10-06", -500, { currency: "EUR" }),
      txn("2026-10-07", -7, { currency: "EUR", status: "other" }),
    ];
    expect(spendTotals(txns, "month", NOW).currentCents).toBe(1000);
    expect(excludedNonUsdCount(txns)).toBe(1);
  });
});

describe("cashHistory", () => {
  it("does not double count a $100 transfer from checking to Treasury", () => {
    // Today: checking $900 after sending $100 to Treasury, which holds $100. Total cash was $1,000 before.
    const checking = account({ balanceCents: 90_000 });
    const treasury = account({
      id: "a2",
      externalId: "acct-treasury",
      kind: "treasury",
      balanceCents: 10_000,
    });
    const history = cashHistory(
      [checking, treasury],
      [txn("2026-09-20", -100, "Mercury Treasury", { classification: "internal_transfer" })],
      NOW,
    );
    expect(history.find((p) => p.month === "2026-08")?.balanceCents).toBe(100_000);
    expect(history.at(-1)?.balanceCents).toBe(100_000);
  });
});

describe("balanceGrid", () => {
  it("plots 7 or 30 daily points ending today, UTC", () => {
    const week = balanceGrid("week", NOW);
    expect(week).toHaveLength(7);
    expect([week[0], week[6]]).toEqual(["2026-10-08", "2026-10-14"]);
    const month = balanceGrid("month", NOW);
    expect(month).toHaveLength(30);
    expect([month[0], month[29]]).toEqual(["2026-09-15", "2026-10-14"]);
    // The 30 days cross a month boundary and a leap-free February.
    expect(balanceGrid("month", new Date("2026-03-05T01:00:00Z"))[0]).toBe("2026-02-04");
  });
  it("plots 13 weekly points back from today", () => {
    const quarter = balanceGrid("quarter", NOW);
    expect(quarter).toHaveLength(13);
    expect([quarter[0], quarter[1], quarter[12]]).toEqual([
      "2026-07-22",
      "2026-07-29",
      "2026-10-14",
    ]);
  });
  it("plots 11 month-ends plus today, across the year change", () => {
    const year = balanceGrid("year", NOW);
    expect(year).toHaveLength(12);
    expect([year[0], year[10], year[11]]).toEqual(["2025-11-30", "2026-09-30", "2026-10-14"]);
    expect(year.slice(0, 3)).toEqual(["2025-11-30", "2025-12-31", "2026-01-31"]);
    const early = balanceGrid("year", new Date("2026-01-10T00:00:00Z"));
    expect(early[0]).toBe("2025-02-28");
    expect(early.slice(-3)).toEqual(["2025-11-30", "2025-12-31", "2026-01-10"]);
  });
});

describe("cashAtDays", () => {
  const checking = account({ balanceCents: 90_000 });
  const treasury = account({
    id: "a2",
    externalId: "acct-treasury",
    kind: "treasury",
    balanceCents: 10_000,
  });
  const txns = [
    txn("2026-10-12", -20), // spent: undone before the 12th
    txn("2026-10-10", 50, "Client", as("revenue")),
    txn("2026-10-11", -100, "Treasury", as("internal_transfer")),
    txn("2026-10-09", -5, "Failed", { status: "other" }),
  ];
  it("undoes later transactions per day, skipping internal transfers and failed ones", () => {
    expect(
      cashAtDays(
        [checking, treasury],
        txns,
        ["2026-10-14", "2026-10-12", "2026-10-11", "2026-10-09"],
        NOW,
      ),
    ).toEqual([100_000, 100_000, 102_000, 97_000]);
  });
  it("leaves out cards and is zero without cash accounts", () => {
    const card = account({ id: "a3", externalId: "card", kind: "card", balanceCents: 5_000 });
    expect(cashAtDays([card], txns, ["2026-10-14"], NOW)).toEqual([0]);
    expect(cashAtDays([], txns, ["2026-10-14"], NOW)).toEqual([0]);
  });
  it("matches cashHistory at the month ends", () => {
    const months = cashHistory([checking, treasury], txns, NOW);
    const days = balanceGrid("year", NOW);
    const values = cashAtDays([checking, treasury], txns, days, NOW);
    expect(values).toEqual(months.map((m) => m.balanceCents));
  });
});

/** `n` monthly charges on the `day`th ending in the month before now's. */
function monthly(
  vendor: string,
  day: string,
  cents: number,
  n: number,
  over: Partial<FinanceTransaction> = {},
) {
  return Array.from({ length: n }, (_, i) => {
    const month = String(((9 - i - 1 + 12) % 12) + 1).padStart(2, "0");
    return txn(`2026-${month}-${day}`, -cents / 100, vendor, over);
  });
}

describe("detectRecurring", () => {
  it("finds a monthly charge with the next expected date and trend", () => {
    const [r] = detectRecurring(monthly("Notion Labs Inc", "05", 1000, 4), NOW);
    expect(r).toMatchObject({
      key: "notion-labs",
      name: "Notion Labs Inc",
      cadence: "monthly",
      amountCents: 1000,
      monthlyCents: 1000,
      variable: false,
      chargeCount: 4,
      classification: "spend",
      trendCents: [1000, 1000, 1000, 1000],
      nextExpectedAt: "2026-10-05T00:00:00.000Z",
    });
  });
  it("needs 3 charges", () => {
    expect(detectRecurring(monthly("Notion", "05", 1000, 2), NOW)).toEqual([]);
  });
  it("finds weekly, biweekly and annual cadences and normalizes to a month", () => {
    const weekly = ["2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07"].map((d) =>
      txn(d, -12, "Gym"),
    );
    const biweekly = ["2026-08-19", "2026-09-02", "2026-09-16", "2026-09-30", "2026-10-14"].map(
      (d) => txn(d, -2400, "Gusto Payroll", { category: "Payroll" }),
    );
    const annual = ["2024-10-10", "2025-10-09", "2026-10-11"].map((d) =>
      txn(d, -1200, "Domain Registrar"),
    );
    const byKey = Object.fromEntries(
      detectRecurring([...weekly, ...biweekly, ...annual], NOW).map((r) => [r.key, r]),
    );
    expect(byKey.gym).toMatchObject({
      cadence: "weekly",
      monthlyCents: 5218,
      nextExpectedAt: "2026-10-14T00:00:00.000Z",
    });
    expect(byKey["gusto-payroll"]).toMatchObject({
      cadence: "biweekly",
      amountCents: 240000,
      monthlyCents: 521786,
      nextExpectedAt: "2026-10-28T00:00:00.000Z",
    });
    expect(byKey["domain-registrar"]).toMatchObject({
      cadence: "annual",
      monthlyCents: 10000,
      nextExpectedAt: "2027-10-11T00:00:00.000Z",
    });
  });
  it("tolerates a charge that lands 3 days off and clamps month ends", () => {
    const shifted = ["2026-07-31", "2026-08-31", "2026-09-28"].map((d) => txn(d, -10, "Cloud Box"));
    const [r] = detectRecurring(shifted, NOW);
    expect(r?.cadence).toBe("monthly");
    expect(r?.nextExpectedAt).toBe("2026-10-28T00:00:00.000Z");
    const [feb] = detectRecurring(
      ["2026-11-30", "2026-12-31", "2027-01-31"].map((d) => txn(d, -10, "Edge Co")),
      new Date("2027-02-05T00:00:00Z"),
    );
    expect(feb?.nextExpectedAt).toBe("2027-02-28T00:00:00.000Z");
  });
  it("ignores irregular gaps and a vendor that stopped", () => {
    const irregular = ["2026-07-01", "2026-07-09", "2026-08-30", "2026-09-02"].map((d) =>
      txn(d, -10, "Corner Shop"),
    );
    expect(detectRecurring(irregular, NOW)).toEqual([]);
    const old = ["2026-03-05", "2026-04-05", "2026-05-05"].map((d) => txn(d, -10, "Old Tool"));
    expect(detectRecurring(old, NOW)).toEqual([]);
  });
  it("drops non-usage vendors whose amounts vary too much", () => {
    const wild = ["2026-07-05", "2026-08-05", "2026-09-05"].map((d, i) =>
      txn(d, -[10, 50, 200][i]!, "Restaurant Group"),
    );
    expect(detectRecurring(wild, NOW)).toEqual([]);
  });
  it("keeps usage-based vendors with varying amounts and flags them variable", () => {
    const usage = ["2026-07-05", "2026-08-05", "2026-09-05"].map((d, i) =>
      txn(d, -[100, 500, 2000][i]!, "OpenRouter"),
    );
    const [r] = detectRecurring(usage, NOW);
    expect(r).toMatchObject({ key: "openrouter", variable: true, amountCents: 86667 });
  });
  it("averages a usage-based vendor the way the vendor page does: full months since first seen", () => {
    const usage = [
      ["2026-05-05", 100],
      ["2026-06-05", 200],
      ["2026-07-05", 300],
      ["2026-08-05", 400],
      ["2026-09-05", 500],
    ].map(([d, c]) => txn(d as string, -(c as number), "OpenRouter"));
    const [r] = detectRecurring(usage, NOW);
    // May to September is 5 full months; April was before the first charge.
    expect(r).toMatchObject({ monthlyCents: 30000, windowMonths: 5 });
    expect(
      averageMonthCents(
        [
          { month: "2026-04", cents: 0 },
          { month: "2026-05", cents: 3000 },
          { month: "2026-06", cents: 3000 },
        ],
        "2026-05-05T00:00:00Z",
      ),
    ).toEqual({ cents: 3000, months: 2 });
  });
  it("ignores refunds, transfers, revenue and failed charges", () => {
    const noise = [
      ...monthly("Payroll Co", "01", 1000, 3, as("internal_transfer")),
      ...monthly("Customer", "01", 1000, 3, as("revenue")),
      ...monthly("Failed Co", "01", 1000, 3, { status: "other" }),
      ...monthly("Refunder", "01", -1000, 3),
    ];
    expect(detectRecurring(noise, NOW)).toEqual([]);
  });
  it("ignores extra charges from the same vendor that are off the rhythm", () => {
    const base = monthly("Cursor Pro", "05", 2000, 4);
    const extras = ["2026-09-07", "2026-09-20", "2026-08-12"].map((d) => txn(d, -5, "Cursor Pro"));
    const [r] = detectRecurring([...base, ...extras], NOW);
    expect(r).toMatchObject({
      key: "cursor-pro",
      cadence: "monthly",
      amountCents: 2000,
      chargeCount: 4,
      variable: false,
    });
  });
  it("uses the real rhythm for payments every 15 days", () => {
    const pay = [
      "2026-07-11",
      "2026-07-26",
      "2026-08-10",
      "2026-08-25",
      "2026-09-09",
      "2026-09-24",
      "2026-10-09",
    ].map((d) => txn(d, -1000, "Gusto"));
    const [r] = detectRecurring(pay, NOW);
    expect(r).toMatchObject({
      cadence: "biweekly",
      chargeCount: 7,
      monthlyCents: Math.round((100000 * 30.4375) / 15),
      nextExpectedAt: "2026-10-23T00:00:00.000Z",
    });
  });
  it("counts a usage-based vendor billed in many top-ups as one monthly cost", () => {
    const topUps = [
      "2026-07-02",
      "2026-07-20",
      "2026-08-03",
      "2026-08-04",
      "2026-08-30",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-10-02",
    ].map((d, i) => txn(d, -(100 + i * 40), "Claude"));
    const [r] = detectRecurring(topUps, NOW);
    expect(r).toMatchObject({ key: "claude", cadence: "monthly", variable: true });
    expect(r?.trendCents).toEqual([0, 24000, 66000, 102000]);
    expect(r?.amountCents).toBe(Math.round((24000 + 66000 + 102000) / 3));
  });
  it("drops a usage-based vendor that skipped one of the last 3 months", () => {
    const gap = ["2026-06-05", "2026-07-05", "2026-09-05"].map((d) => txn(d, -50, "OpenAI"));
    expect(detectRecurring(gap, NOW)).toEqual([]);
  });
  it("merges same-day charges into one occurrence", () => {
    const twice = monthly("Seats Inc", "05", 1000, 3).flatMap((t) => [
      t,
      txn(t.postedAt.slice(0, 10), -10, "Seats Inc"),
    ]);
    expect(detectRecurring(twice, NOW)[0]).toMatchObject({ amountCents: 2000, chargeCount: 3 });
  });
  it("lists the accounts and cards that paid, most used first", () => {
    const accounts = [
      account({ externalId: "acct-checking", name: "Mercury Checking", lastFour: "1111" }),
    ];
    const charges = [
      ...monthly("Vercel", "05", 2000, 2, {
        provider: "brex",
        accountExternalId: "brex-main",
        cardLastFour: "0003",
      }),
      txn("2026-07-05", -20, "Vercel"),
      txn("2026-06-05", -20, "Vercel", {
        provider: "brex",
        accountExternalId: "brex-main",
        cardLastFour: "9999",
      }),
    ];
    const [r] = detectRecurring(charges, NOW, accounts);
    expect(r?.paidWith).toEqual([
      { provider: "brex", kind: "card", name: "Brex card", lastFour: "0003" },
      { provider: "brex", kind: "card", name: "Brex card", lastFour: "9999" },
      { provider: "mercury", kind: "account", name: "Mercury Checking", lastFour: "1111" },
    ]);
  });
  it("detects the Brex card payment as its own recurring card_payment", () => {
    const [r] = detectRecurring(monthly("Brex Inc.", "03", 500000, 4, as("card_payment")), NOW);
    expect(r).toMatchObject({ key: "brex", classification: "card_payment" });
  });
});

describe("upcoming", () => {
  const recurring = detectRecurring(
    [
      ...monthly("Notion", "20", 1000, 4),
      ...monthly("Brex", "03", 500000, 4, as("card_payment")),
      ...["2026-08-17", "2026-09-17", "2026-10-02"].map((d) => txn(d, -45, "Weekly Thing")),
    ],
    NOW,
  );
  const bill = (over: Partial<FinanceBill>): FinanceBill => ({
    provider: "brex",
    externalId: "bill-1",
    vendorName: "Landlord LLC",
    vendorKey: "landlord",
    dueAt: "2026-10-30T00:00:00.000Z",
    amountCents: 300000,
    status: "APPROVED",
    ...over,
  });
  it("predicts recurring charges and bills, and leaves out card payments and pending charges", () => {
    // A pending charge already counts as spend, so Upcoming leaves it out rather than count it twice.
    const pending = [txn("2026-10-13", -15, "Coffee Cart", { status: "pending" })];
    const result = upcoming(recurring, pending, [bill({})], NOW);
    expect(result.items.map((i) => [i.kind, i.key, i.dates])).toEqual([
      ["recurring", "notion", ["2026-10-20"]],
      ["bill", "bill-1", ["2026-10-30"]],
    ]);
    expect(result.totalCents).toBe(1000 + 300000);
  });
  it("drops a prediction that a pending charge (already spent) covers", () => {
    const pending = [txn("2026-10-19", -10, "Notion", { status: "pending" })];
    const result = upcoming(recurring, pending, [], NOW);
    expect(result.items.filter((i) => i.name.startsWith("Notion"))).toHaveLength(0);
  });
  it("lists every occurrence inside the window and respects its end", () => {
    const weekly = detectRecurring(
      ["2026-09-23", "2026-09-30", "2026-10-07"].map((d) => txn(d, -10, "Weekly Gym")),
      NOW,
    );
    const item = upcoming(weekly, [], [], NOW, 30).items[0];
    expect(item?.dates).toEqual([
      "2026-10-14",
      "2026-10-21",
      "2026-10-28",
      "2026-11-04",
      "2026-11-11",
    ]);
    expect(upcoming(weekly, [], [], NOW, 7).items[0]?.dates).toEqual(
      ["2026-10-14", "2026-10-21"].slice(0, 1),
    );
  });
  it("includes overdue bills today and skips bills past the window", () => {
    const result = upcoming(
      [],
      [],
      [
        bill({ dueAt: "2026-10-01T00:00:00.000Z" }),
        bill({ externalId: "late", dueAt: "2026-12-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(result.items.map((i) => [i.key, i.dates])).toEqual([["bill-1", ["2026-10-14"]]]);
  });
  it("is empty with nothing expected", () => {
    expect(upcoming([], [], [], NOW)).toEqual({ items: [], totalCents: 0 });
  });
});

describe("subscriptions", () => {
  const recurring = detectRecurring(
    [
      ...monthly("Anthropic", "06", 70000, 4),
      ...monthly("OpenAI", "04", 68000, 4),
      ...monthly("Notion", "20", 1000, 4),
      ...monthly("Perplexity", "09", 5000, 4),
      ...monthly("Brex", "03", 500000, 4, as("card_payment")),
      ...["2026-08-01", "2026-09-01", "2026-10-01"].map((d) => txn(d, -8, "Cursor Pro")),
    ],
    NOW,
  );
  it("lists spend subscriptions largest first, without card payments, with overlaps tagged", () => {
    const subs = subscriptions(recurring);
    expect(subs.items.map((s) => s.key)).toEqual([
      "anthropic",
      "openai",
      "perplexity",
      "notion",
      "cursor-pro",
    ]);
    expect(Object.fromEntries(subs.items.map((s) => [s.key, s.overlapGroup]))).toEqual({
      anthropic: "ai-models",
      openai: "ai-models",
      "cursor-pro": "ai-models",
      perplexity: "ai-models",
      notion: null,
    });
    expect(subs.totalMonthlyCents).toBe(70000 + 68000 + 800 + 5000 + 1000);
  });
  it("leaves payroll and rent out: they recur but are fixed costs, not subscriptions", () => {
    const fixed = detectRecurring(
      [
        ...monthly("Paylodex Payroll", "15", 5_840_000, 4, { category: "Payroll" }),
        ...monthly("Landlord Placeholder LLC", "01", 750_000, 4),
        ...monthly("Office Space Co", "02", 300_000, 4, { category: "Rent" }),
        ...monthly("Notion", "20", 1000, 4, { category: "Software" }),
        // A Brex bill paid from Mercury while Brex is not connected: still spend, not a subscription.
        ...monthly("Brex", "05", 1_120_000, 4, { category: "Credit & Loan Payments" }),
      ],
      NOW,
    );
    expect(fixed.filter((r) => r.fixedCost).map((r) => r.key)).toEqual([
      "paylodex-payroll",
      "brex",
      "landlord-placeholder",
      "office-space",
    ]);
    expect(subscriptions(fixed).items.map((s) => s.key)).toEqual(["notion"]);
    // Upcoming calls it a card bill, not a recurring vendor.
    const next = upcoming(fixed, [], [], NOW).items;
    expect(next.find((i) => i.key === "brex")?.cardBill).toBe(true);
    expect(next.find((i) => i.key === "notion")?.cardBill).toBeUndefined();
  });
  it("tags no overlap when only one vendor of a group is subscribed", () => {
    const only = subscriptions(detectRecurring(monthly("Anthropic", "06", 70000, 4), NOW));
    expect(only.items[0]?.overlapGroup).toBeNull();
  });
  it("maps the AI, model and coding tools vendors into one group", () => {
    expect(OVERLAP_GROUPS["ai-models"]).toEqual(
      expect.arrayContaining([
        "openai",
        "chatgpt",
        "anthropic",
        "claude",
        "openrouter",
        "perplexity",
        "cursor",
        "devin",
        "cognition",
        "moonshot",
        "cerebras",
        "replit",
        "together",
        "groq",
      ]),
    );
  });
});

describe("fixture sanity", () => {
  it("uses the same vendor and category helpers the sync does", () => {
    expect(vendorKey("Brex Inc.")).toBe(vendorKey("Brex"));
    expect(categorySlug("Credit & Loan Payments")).toBe("credit-loan-payments");
  });
});

describe("cashSeries", () => {
  // 2026-10-14 is a Wednesday.
  const today = new Date("2026-10-14T15:00:00Z");
  const txns = [
    txn("2026-10-14", -100), // today, partial
    txn("2026-10-14", 70, as("revenue")),
    txn("2026-10-13", -200),
    txn("2026-10-13", 5000, as("financing")),
    txn("2026-10-13", -999, as("internal_transfer")),
    txn("2026-10-12", -300), // Monday
    txn("2026-10-11", -400), // Sunday: the previous week
    txn("2026-10-08", -500),
    txn("2026-10-07", -600), // outside 7 days
    txn("2026-09-30", -700),
  ];
  it("buckets days, oldest first, zero-filled, with today partial", () => {
    const days = cashSeries(txns, { granularity: "day", buckets: 7, now: today });
    expect(days.map((d) => d.start)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(days.map((d) => d.outCents)).toEqual([50000, 0, 0, 40000, 30000, 20000, 10000]);
    expect(days[5]).toMatchObject({ financingCents: 500000, end: "2026-10-13" });
    expect(days[6]).toMatchObject({ revenueCents: 7000, partial: true });
    expect(days.filter((d) => d.partial)).toHaveLength(1);
  });
  it("starts weeks on Monday and keeps Sunday in the earlier week", () => {
    const weeks = cashSeries(txns, { granularity: "week", buckets: 3, now: today });
    expect(weeks.map((w) => [w.start, w.end])).toEqual([
      ["2026-09-28", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
    ]);
    expect(weeks.map((w) => w.outCents)).toEqual([70000, 150000, 60000]);
    expect(weeks[2]?.partial).toBe(true);
  });
  it("covers exactly the period to date when given its first day", () => {
    // Quarter to date from Wed Oct 1: the first week bucket starts on Oct 1, not Monday Sep 29.
    const quarter = cashSeries(txns, { granularity: "week", from: "2026-10-01", now: today });
    expect(quarter.map((w) => [w.start, w.end])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
    ]);
    // Sep 30 is before the quarter, so it is not in the first bucket.
    expect(quarter[0]?.outCents).toBe(0);
    const month = cashSeries(txns, { granularity: "day", from: "2026-10-01", now: today });
    expect(month).toHaveLength(14);
    expect(month[0]?.start).toBe("2026-10-01");
    const year = cashSeries(txns, { granularity: "month", from: "2026-01-01", now: today });
    expect(year.map((m) => m.start.slice(0, 7))).toEqual(
      Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`),
    );
  });
  it("is on the same Monday for a Sunday and the next Monday", () => {
    const sunday = cashSeries([], {
      granularity: "week",
      buckets: 1,
      now: new Date("2026-10-18T23:59:00Z"),
    });
    const monday = cashSeries([], {
      granularity: "week",
      buckets: 1,
      now: new Date("2026-10-19T00:00:00Z"),
    });
    expect(sunday[0]?.start).toBe("2026-10-12");
    expect(monday[0]?.start).toBe("2026-10-19");
  });
  it("buckets calendar months and matches monthlySeries", () => {
    const months = cashSeries(txns, { granularity: "month", buckets: 2, now: today });
    expect(months.map((m) => [m.start, m.end])).toEqual([
      ["2026-09-01", "2026-09-30"],
      ["2026-10-01", "2026-10-31"],
    ]);
    expect(months.map((m) => m.outCents)).toEqual([70000, 210000]);
    const series = monthlySeries(txns, today);
    expect(series[11]).toMatchObject({ month: "2026-10", outCents: 210000, partial: true });
  });
  it("buckets quarters and years, the current one partial, and covers a period from its first day", () => {
    const quarters = cashSeries(txns, { granularity: "quarter", buckets: 2, now: today });
    expect(quarters.map((q) => [q.start, q.end])).toEqual([
      ["2026-07-01", "2026-09-30"],
      ["2026-10-01", "2026-12-31"],
    ]);
    expect(quarters.map((q) => q.outCents)).toEqual([70000, 210000]);
    expect(quarters[1]?.partial).toBe(true);
    const years = cashSeries(txns, { granularity: "year", buckets: 2, now: today });
    expect(years.map((y) => [y.start, y.end])).toEqual([
      ["2025-01-01", "2025-12-31"],
      ["2026-01-01", "2026-12-31"],
    ]);
    expect(years.map((y) => y.outCents)).toEqual([0, 280000]);
    const sinceApril = cashSeries(txns, { granularity: "quarter", from: "2026-04-01", now: today });
    expect(sinceApril.map((q) => q.start)).toEqual(["2026-04-01", "2026-07-01", "2026-10-01"]);
  });
});
