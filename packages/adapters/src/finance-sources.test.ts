import { describe, expect, it } from "vitest";
import { createBrexFinanceSource } from "./brex-finance-source.js";
import {
  brexExpense,
  fakeBrex,
  fakeMercury,
  MERCURY_CHECKING,
  MERCURY_SAVINGS,
  mercuryAccountsResponse,
  mercuryRow,
} from "./finance-fake-tools.js";
import { FinanceShapeError } from "./finance-source-util.js";
import { createMercuryFinanceSource } from "./mercury-finance-source.js";

const manyMercury = (count: number, prefix = "m") =>
  Array.from({ length: count }, (_, i) =>
    mercuryRow(`${prefix}-${i}`, {
      date: `2026-09-${String(28 - (i % 28)).padStart(2, "0")}T01:00:00.000000Z`,
    }),
  );

describe("Mercury source", () => {
  it("maps cash accounts and Treasury to cents and skips credit and unknown kinds", async () => {
    const fake = fakeMercury({
      txns: {},
      accounts: mercuryAccountsResponse([
        {
          id: "crd-1",
          name: "Credit",
          status: "active",
          kind: "credit",
          isCredit: true,
          availableBalance: 9,
        },
        {
          id: "old-1",
          name: "Closed",
          status: "archived",
          kind: "checking",
          isCredit: false,
          availableBalance: 9,
        },
      ]),
    });
    const accounts = await createMercuryFinanceSource(fake.callTool).fetchAccounts();
    expect(accounts.map((a) => [a.externalId, a.kind, a.balanceCents, a.lastFour])).toEqual([
      [MERCURY_CHECKING, "checking", 100050, "1111"],
      [MERCURY_SAVINGS, "savings", 25000, "2222"],
      ["trs-3333", "treasury", 500025, null],
    ]);
  });

  it("reads every page without a page cursor, per account, and tags the account", async () => {
    const fake = fakeMercury({
      txns: { [MERCURY_CHECKING]: manyMercury(650), [MERCURY_SAVINGS]: [mercuryRow("s-1")] },
    });
    const txns = await createMercuryFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txns).toHaveLength(651);
    expect(txns.filter((t) => t.accountExternalId === MERCURY_CHECKING)).toHaveLength(650);
    expect(txns.find((t) => t.externalId === "s-1")?.accountExternalId).toBe(MERCURY_SAVINGS);
    // 650 rows at 300 a page is three pages (300, 300, 50) plus the pending query, for checking.
    const checking = fake.calls.filter(
      (c) =>
        c.name === "listTransactions" && (c.args.accountId as string[])[0] === MERCURY_CHECKING,
    );
    expect(checking.map((c) => c.args.order)).toEqual(Array(4).fill("desc"));
    expect(checking.filter((c) => c.args.postedStart === "2026-01-01")).toHaveLength(3);
  });

  it("follows page.nextPage when the server sends it", async () => {
    const fake = fakeMercury({
      txns: { [MERCURY_CHECKING]: manyMercury(320) },
      withNextPage: true,
    });
    const txns = await createMercuryFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txns).toHaveLength(320);
  });

  it("maps fields and reads pending rows even when the posted-date filter would hide them", async () => {
    const fake = fakeMercury({
      txns: {
        [MERCURY_CHECKING]: [
          mercuryRow("p-1", {
            status: "pending",
            date: "2025-01-01T00:00:00.000000Z",
            counterpartyName: "Brex Inc.",
            category: "Credit & Loan Payments",
            amount: -1234.56,
          }),
          mercuryRow("t-1", {
            counterpartyName: null,
            category: null,
            amount: 10,
            kind: "incomingDomesticWire",
          }),
        ],
      },
    });
    const txns = await createMercuryFinanceSource(fake.callTool).fetchTransactions(
      "2026-08-01T00:00:00.000Z",
    );
    const pending = txns.find((t) => t.externalId === "p-1");
    expect(pending).toMatchObject({
      status: "pending",
      amountCents: -123456,
      vendorKey: "brex",
      category: "Credit & Loan Payments",
      provider: "mercury",
      postedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(txns.find((t) => t.externalId === "t-1")).toMatchObject({
      status: "posted",
      counterparty: "Unknown",
      category: null,
      kind: "incomingDomesticWire",
      amountCents: 1000,
    });
  });

  it("halves the page size when the tool truncates a page", async () => {
    const fake = fakeMercury({ txns: { [MERCURY_CHECKING]: manyMercury(40) }, truncateAbove: 100 });
    const txns = await createMercuryFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txns).toHaveLength(40);
    const limits = fake.calls.filter((c) => c.name === "listTransactions").map((c) => c.args.limit);
    expect(limits.slice(0, 3)).toEqual([300, 150, 75]);
    expect(limits.slice(2).every((l) => l === 75)).toBe(true);
  });

  it("rejects a response in an unknown shape and names the tool and field", async () => {
    const source = createMercuryFinanceSource(async () => ({
      accounts: [
        { id: "x", name: "n", status: "active", kind: "checking", availableBalance: "12" },
      ],
    }));
    await expect(source.fetchAccounts()).rejects.toThrow(
      new FinanceShapeError("getAccounts", "accounts.0.availableBalance").message,
    );
  });

  it("maps Treasury months with a positive fee and reads Treasury once", async () => {
    const fake = fakeMercury({ txns: {} });
    const source = createMercuryFinanceSource(fake.callTool);
    await source.fetchAccounts();
    expect(await source.fetchTreasuryYield?.()).toEqual([
      {
        accountExternalId: "trs-3333",
        month: "2026-09",
        dividendsCents: 11050,
        feeCents: 2050,
        netCents: 9000,
      },
    ]);
    expect(fake.calls.filter((c) => c.name === "getTreasury")).toHaveLength(1);
  });

  it("finds a receipt link on demand, through getAttachment when the row has only an id", async () => {
    const withId = fakeMercury({ txns: {}, attachments: [{ id: "att-1" }] });
    expect(await createMercuryFinanceSource(withId.callTool).receiptUrl("m-1")).toEqual({
      url: "https://files.example.test/receipt.pdf?sig=1",
      mimeType: "application/pdf",
    });
    const none = fakeMercury({ txns: {}, attachments: [] });
    expect(await createMercuryFinanceSource(none.callTool).receiptUrl("m-1")).toBeNull();
  });
});

describe("Brex source", () => {
  it("maps cash accounts from decimal strings and skips card accounts", async () => {
    const fake = fakeBrex({ expenses: [] });
    expect(await createBrexFinanceSource(fake.callTool).fetchAccounts()).toEqual([
      {
        provider: "brex",
        externalId: "dpacc_1",
        name: "Acme business account",
        lastFour: null,
        kind: "checking",
        balanceCents: 30010,
        currency: "USD",
      },
    ]);
    expect(fake.calls[0]?.args.intent).toEqual(expect.any(String));
  });

  it("reads every page with receipts and an intent, and flags receipts", async () => {
    const expenses = Array.from({ length: 250 }, (_, i) =>
      brexExpense(`e-${i}`, {
        receipt_count: i === 3 ? 1 : 0,
        receipts: i === 3 ? [{ id: "r1", download_uri: "https://files.example.test/r.pdf" }] : [],
      }),
    );
    const fake = fakeBrex({ expenses });
    const txns = await createBrexFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txns).toHaveLength(250);
    expect(fake.calls).toHaveLength(3);
    expect(
      fake.calls.every(
        (c) => c.args.limit === 100 && (c.args.include as string[])[0] === "receipts",
      ),
    ).toBe(true);
    expect(txns.filter((t) => t.hasReceipt).map((t) => t.externalId)).toEqual(["e-3"]);
    expect(txns[0]).toMatchObject({
      provider: "brex",
      accountExternalId: "brex-card",
      amountCents: -4250,
      status: "posted",
      counterparty: "Globex Cloud",
      vendorKey: "globex-cloud",
      category: "Servers",
      kind: "CARD",
      cardLastFour: "4242",
      cardholder: "Ada Example",
      purchasedAt: "2026-09-10T12:00:00.000Z",
      postedAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("uses the USD billing amount of a foreign-currency expense", async () => {
    const fake = fakeBrex({
      expenses: [
        brexExpense("eur", {
          amount: { value: "100.00", currency: "EUR" },
          billing_amount: { value: "108.00", currency: "USD" },
        }),
      ],
    });
    const [txn] = await createBrexFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txn).toMatchObject({ amountCents: -10800, currency: "USD" });
  });

  it("drops declined and canceled card attempts and unsent bills, and keeps reimbursements", async () => {
    const fake = fakeBrex({
      expenses: [
        brexExpense("declined", {
          status: "CANCELED",
          payment_status: "DECLINED",
          amount: { value: "0.00", currency: "USD" },
        }),
        brexExpense("processing", {
          status: "APPROVED",
          payment_status: "PROCESSING",
          posted_at: null,
        }),
        brexExpense("unsent-bill", { type: "BILLPAY", payment_status: "SCHEDULED" }),
        brexExpense("paid-bill", { type: "BILLPAY", payment_status: "CLEARED" }),
        brexExpense("reimb", {
          type: "REIMBURSEMENT",
          status: "SUBMITTED",
          payment_status: null,
          receipts: null,
          vendor: undefined,
          merchant: undefined,
          card: undefined,
          memo: "Lunch",
        }),
      ],
    });
    const txns = await createBrexFinanceSource(fake.callTool).fetchTransactions(
      "2026-01-01T00:00:00.000Z",
    );
    expect(txns.map((t) => t.externalId).sort()).toEqual(["paid-bill", "processing", "reimb"]);
    const processing = txns.find((t) => t.externalId === "processing");
    expect(processing).toMatchObject({ status: "pending", postedAt: "2026-09-10T12:00:00.000Z" });
    expect(txns.find((t) => t.externalId === "reimb")).toMatchObject({
      status: "pending",
      counterparty: "Reimbursement",
      memo: "Lunch",
      hasReceipt: false,
      cardLastFour: null,
    });
  });

  it("maps open bills and skips a bill it cannot read", async () => {
    const fake = fakeBrex({
      expenses: [],
      bills: [
        {
          id: "b-1",
          status: "APPROVED",
          due_at: "2026-10-20T00:00:00.000Z",
          vendor: { name: "Initech LLC" },
          amount: { value: "1200.00", currency: "USD" },
        },
        { id: "b-2", status: "DRAFT" },
      ],
    });
    expect(await createBrexFinanceSource(fake.callTool).fetchBills?.()).toEqual([
      {
        provider: "brex",
        externalId: "b-1",
        vendorName: "Initech LLC",
        vendorKey: "initech",
        dueAt: "2026-10-20T00:00:00.000Z",
        amountCents: 120000,
        status: "APPROVED",
      },
    ]);
  });

  it("rejects a response in an unknown shape", async () => {
    const source = createBrexFinanceSource(async () => ({
      items: [{ id: "e", type: "CARD", amount: "5" }],
    }));
    await expect(source.fetchTransactions("2026-01-01T00:00:00.000Z")).rejects.toThrow(
      "Unexpected list_expenses response at items.0.amount",
    );
  });

  it("returns a fresh receipt link and null when there is none", async () => {
    const withReceipt = fakeBrex({
      expenses: [],
      receipts: [{ download_uri: "https://files.example.test/r.pdf?Expires=1" }],
    });
    expect(await createBrexFinanceSource(withReceipt.callTool).receiptUrl("e-1")).toEqual({
      url: "https://files.example.test/r.pdf?Expires=1",
      mimeType: "application/pdf",
    });
    const none = fakeBrex({ expenses: [], receipts: null });
    expect(await createBrexFinanceSource(none.callTool).receiptUrl("e-1")).toBeNull();
  });
});
