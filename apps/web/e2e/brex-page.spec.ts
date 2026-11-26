import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

const SERVER_ID = "44444444-4444-4444-8444-444444444444";
const AGENT_ID = "55555555-5555-4555-8555-555555555555";

const overview = {
  serverId: SERVER_ID,
  agentBotId: AGENT_ID,
  writesEnabled: true,
  partial: false,
  cash: { totalCents: 1_234_500, availableCents: 1_100_000, accountCount: 1 },
  cardSpend: {
    partial: false,
    monthToDateCents: 412_000,
    previousMonthToDateCents: 375_000,
    changePercent: 9.9,
    sparkline: [{ day: "2026-11-05", cents: 61_000 }],
  },
  cards: { active: 3, locked: 0, terminated: 0 },
  nearLimit: { partial: false, count: 0, items: [] },
  sankey: { partial: false, totalCents: 0, categories: [] },
  topVendors: [],
};

const expense = (over: Record<string, unknown>) => ({
  expenseId: "exp_e2e",
  purchasedAt: "2026-11-04T16:40:00.000Z",
  day: "2026-11-04",
  userId: "user_1",
  userName: "Ada Lovelace",
  merchant: "LinkedIn Ads",
  memo: null,
  status: "SUBMITTED",
  paymentStatus: "SETTLED",
  expenseType: "CARD",
  category: "Advertising",
  bucket: "marketing",
  amountCents: 45_000,
  currency: "USD",
  receipts: [{ id: "rcpt_1" }],
  missingReceipt: false,
  missingMemo: true,
  complianceStatus: null,
  cardId: "card_ops",
  ...over,
});

const expenses = {
  serverId: SERVER_ID,
  agentBotId: AGENT_ID,
  writesEnabled: true,
  partial: false,
  expenses: [
    expense({ expenseId: "exp_memo", merchant: "LinkedIn Ads" }),
    expense({
      expenseId: "exp_receipt",
      merchant: "Blue Bottle",
      userName: "Grace Hopper",
      memo: "Coffee with a candidate",
      receipts: [],
      missingReceipt: true,
      missingMemo: false,
      amountCents: 8_400,
      bucket: "meals",
    }),
  ],
  reimbursements: [
    expense({
      expenseId: "exp_reimb",
      expenseType: "REIMBURSEMENT",
      merchant: "Harbor Hotel",
      memo: "Hotel for the Austin offsite",
      receipts: [{ id: "rcpt_2" }],
      missingReceipt: false,
      missingMemo: false,
      amountCents: 21_300,
      bucket: "travel",
    }),
  ],
};

const accounts = {
  serverId: SERVER_ID,
  agentBotId: AGENT_ID,
  writesEnabled: true,
  accounts: [
    {
      cashAccountId: "ca_operating",
      name: "Operating",
      status: "ACTIVE",
      currentBalanceCents: 1_234_500,
      availableBalanceCents: 1_100_000,
      currency: "USD",
      primary: true,
    },
  ],
  statements: [
    {
      statementId: "st_cash_1",
      accountKind: "cash",
      cashAccountId: "ca_operating",
      accountName: "Operating",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      startBalanceCents: 1_100_000,
      endBalanceCents: 1_234_500,
    },
    {
      statementId: "st_card_1",
      accountKind: "card",
      cashAccountId: null,
      accountName: "Card account",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      startBalanceCents: 0,
      endBalanceCents: 31_000,
    },
  ],
};

const trips = {
  serverId: SERVER_ID,
  agentBotId: AGENT_ID,
  writesEnabled: true,
  trips: [
    {
      tripId: "trip_offsite",
      name: "Team offsite, Austin",
      status: "UPCOMING",
      bookerUserId: "user_1",
      bookerName: "Ada Lovelace",
      startsAt: "2026-12-01T09:00:00.000Z",
      endsAt: "2026-12-04T17:00:00.000Z",
    },
    {
      tripId: "trip_conference",
      name: "Conference, Las Vegas",
      status: "CANCELLED",
      bookerUserId: "user_2",
      bookerName: "Grace Hopper",
      startsAt: "2026-09-14T08:00:00.000Z",
      endsAt: "2026-09-17T18:00:00.000Z",
    },
  ],
};

const activity = {
  serverId: SERVER_ID,
  agentBotId: AGENT_ID,
  writesEnabled: true,
  activities: [
    {
      effectId: "eff_1",
      at: "2026-11-06T14:22:00.000Z",
      action: "lock_card",
      target: "Ops card",
      status: "succeeded",
    },
    {
      effectId: "eff_2",
      at: "2026-11-05T09:00:00.000Z",
      action: "update_spend_limit",
      target: "Cloud budget",
      status: "denied",
    },
  ],
};

const json = (value: unknown) => ({
  contentType: "application/json",
  body: JSON.stringify({ json: value, meta: [] }),
});

/** Answers the Brex page RPCs and thread sends with synthetic data; the rest is the real stack. */
async function mockBrexPage(page: Page) {
  const state = { sent: [] as string[] };
  const answers: Record<string, unknown> = {
    overview,
    expenses,
    accounts,
    trips,
    activity,
  };
  await page.route("**/rpc/brexCards/**", (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/brexCards/")[1] ?? "";
    const value = answers[name];
    return value === undefined
      ? route.fulfill({ status: 404, body: "not mocked" })
      : route.fulfill(json(value));
  });
  await page.route("**/rpc/threads/send", (route) => {
    const body = route.request().postDataJSON() as {
      json: { text: string; botId: string; clientNonce?: string };
    };
    state.sent.push(`${body.json.botId}: ${body.json.text}`);
    return route.fulfill(json({ taskId: "t1", runId: "r1", seq: 1 }));
  });
  return state;
}

test("the Brex page shows expenses, accounts, travel and activity, and Edit memo sends one fixed message", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const state = await mockBrexPage(page);
  await signup(page, `brex-page-${Date.now()}@rakazo.test`, "password12", "Brex Page");
  await completeOnboarding(page);

  const main = page.getByRole("main");
  await page.goto("/app/brex/expenses");
  await expect(main.getByText("Needs a receipt or memo")).toBeVisible();
  await expect(main.getByText("2 expenses")).toBeVisible();
  // The receipt-only row has no Edit memo; the memo row does.
  const memoRow = main.locator("tbody tr").filter({ hasText: "LinkedIn Ads" });
  const receiptRow = main.locator("tbody tr").filter({ hasText: "Blue Bottle" });
  await expect(memoRow.getByRole("button", { name: "Edit memo" })).toBeVisible();
  await expect(receiptRow.getByRole("button", { name: "Edit memo" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Reimbursements waiting" })).toBeVisible();
  await expect(main.getByText("Hotel for the Austin offsite")).toBeVisible();
  await expect(main.getByRole("link", { name: "Approve in Brex" }).first()).toHaveAttribute(
    "href",
    "https://dashboard.brex.com/expenses",
  );
  await captureScreenshot(page, testInfo, "brex-page-expenses");

  // Edit memo opens the agent chat with exactly the fixed message; the memo stays data.
  await memoRow.getByRole("button", { name: "Edit memo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Memo").fill("Q4 brand campaign");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${AGENT_ID}$`));
  expect(state.sent).toEqual([
    `${AGENT_ID}: Set the memo of expense exp_memo to Q4 brand campaign.`,
  ]);

  await page.goto("/app/brex/accounts");
  await expect(main.getByRole("heading", { name: "Cash accounts" })).toBeVisible();
  await expect(
    main.locator("tbody tr").filter({ hasText: "Operating" }).filter({ hasText: "Primary" }),
  ).toContainText("$12,345");
  await expect(main.getByRole("heading", { name: "Statements" })).toBeVisible();
  await expect(main.getByText("Card account")).toBeVisible();
  await expect(main.getByRole("link", { name: "Download in Brex" }).first()).toHaveAttribute(
    "href",
    "https://dashboard.brex.com/statements-and-documents",
  );
  await captureScreenshot(page, testInfo, "brex-page-accounts");

  await page.goto("/app/brex/travel");
  await expect(main.getByRole("heading", { name: "Trips" })).toBeVisible();
  await expect(main.locator("tbody tr").filter({ hasText: "Team offsite" })).toContainText(
    "Ada Lovelace",
  );
  await expect(main.locator("tbody tr").filter({ hasText: "Team offsite" })).toContainText(
    "Upcoming",
  );
  // No cost column: the trips RPC does not expose one.
  await expect(main.getByRole("columnheader", { name: "Cost" })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "brex-page-travel");

  await page.goto("/app/brex/activity");
  await expect(main.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(main.locator("tbody tr").filter({ hasText: "Ops card" })).toContainText("Lock card");
  await expect(main.locator("tbody tr").filter({ hasText: "Cloud budget" })).toContainText(
    "Declined",
  );
  // The plan removed the approver column.
  await expect(main.getByRole("columnheader", { name: "Approved by" })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "brex-page-activity");
});
