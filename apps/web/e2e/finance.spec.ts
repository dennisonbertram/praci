import { expect, type Page, test } from "@playwright/test";
import {
  balanceSeriesOf,
  connectedOverview,
  cryptoData,
  cryptoHistoryData,
  emptyOverview,
  receiptPng,
  runwayData,
  transactionOf,
  vendor,
  withoutReceipt,
  withReceipt,
} from "./fixtures/finance";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Answers the Finance RPCs with synthetic data; everything else (sign-up, bots) is the real stack. */
async function mockFinance(page: Page, overview = connectedOverview) {
  const calls: string[] = [];
  await page.route("https://files.example.test/**", (route) =>
    route.fulfill({ contentType: "image/png", body: receiptPng }),
  );
  await page.route("**/rpc/finance/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/finance/")[1] ?? "";
    calls.push(name);
    const input = (route.request().postDataJSON() as { json?: Record<string, unknown> } | null)
      ?.json;
    const answers: Record<string, unknown> = {
      overview,
      refresh: { ok: true },
      preferences: { runwayCrypto: "bank" },
      balanceSeries: balanceSeriesOf(String(input?.range)),
      vendor,
      transaction: transactionOf(String(input?.id)),
      receiptUrl: { url: "https://files.example.test/receipt.png", mimeType: "image/png" },
      connect: { status: "already_connected", serverId: "11111111-1111-4111-8111-111111111111" },
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  return calls;
}

test("Finance shows the dashboard and drills down to a vendor, a charge and its receipt", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const calls = await mockFinance(page);
  await signup(page, `finance-${Date.now()}@rakazo.test`, "password12", "Finance User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-finance").click();
  await expect(page).toHaveURL(/\/app\/finance$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Finance", level: 1 })).toBeVisible();
  await expect(main.getByText("$75,000")).toBeVisible();
  await expect(main.getByText("8.3 mo")).toBeVisible();
  await expect(main.getByText("Until June 2027")).toBeVisible();
  // Opening the page syncs once, then reads the stored data again.
  await expect.poll(() => calls.filter((c) => c === "refresh").length).toBe(1);

  // The agent panel starts closed; the header button opens it and hides while it is open.
  const ask = main.getByRole("button", { name: "Ask Finance agent", exact: true });
  await expect(page.getByTestId("finance-agent-panel")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "finance-dashboard");

  // The period chips change the number.
  const strip = main.getByRole("tablist", { name: "Period" });
  await strip.getByRole("tab", { name: "Week" }).click();
  await expect(main.getByRole("link", { name: "$875" })).toBeVisible();
  await strip.getByRole("tab", { name: "Year" }).click();
  await expect(main.getByRole("link", { name: "$117,250" })).toBeVisible();

  // Breakdown toggles between categories and vendors.
  await expect(main.locator('a[href="/app/finance/category/payroll"]')).toBeVisible();
  await main.getByRole("button", { name: "Vendor", exact: true }).click();
  await expect(main.locator('a[href="/app/finance/vendor/globex-compute"]').first()).toBeVisible();
  await expect(main.locator('a[href="/app/finance/category/payroll"]')).toHaveCount(0);

  // Subscription rows show what paid them on hover and on keyboard focus.
  const row = main.locator("tbody tr").filter({ hasText: "Umbrella AI" });
  const pill = row.getByRole("tooltip");
  await expect(pill).toBeHidden();
  await row.hover();
  await expect(pill).toHaveText("Brex ••0001 + Mercury Checking ••0002");
  await main.getByRole("heading", { name: "Subscriptions" }).hover();
  await expect(pill).toBeHidden();
  await row.getByRole("link").focus();
  await expect(pill).toBeVisible();

  // Ask agent opens the panel and is hidden while it is open.
  await ask.click();
  const panel = page.getByTestId("finance-agent-panel");
  await expect(panel).toBeVisible();
  await expect(ask).toHaveCount(0);
  // The panel narrows the page; the charts redraw at the new width.
  await expect
    .poll(() =>
      main
        .locator("svg[role=img]")
        .first()
        .evaluate((svg) => Number(svg.getAttribute("width")) === svg.parentElement?.clientWidth),
    )
    .toBe(true);
  await captureScreenshot(page, testInfo, "finance-agent-panel");
  await panel.getByRole("button", { name: "Collapse Finance agent" }).click();
  await expect(page.getByTestId("finance-agent-panel")).toHaveCount(0);
  await expect(ask).toBeVisible();

  // Vendor page, with a breadcrumb and Back.
  await main.getByRole("link", { name: "Acme Hosting" }).first().click();
  await expect(page).toHaveURL(/\/app\/finance\/vendor\/acme-hosting$/);
  await expect(main.getByRole("heading", { name: "Acme Hosting", level: 1 })).toBeVisible();
  await expect(main.getByText("↑ 40%")).toBeVisible();
  await expect(main.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Subscriptions");
  await captureScreenshot(page, testInfo, "finance-vendor");

  // A charge without a receipt says so and offers no upload.
  await main.locator("tbody tr").filter({ hasText: "Pro plan" }).first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/app/finance/transaction/${withoutReceipt.id}$`));
  await expect(main.getByText("No receipt")).toBeVisible();
  await expect(main.getByRole("button", { name: /Upload/ })).toHaveCount(0);
  await main
    .getByRole("link", { name: /Subscriptions/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/finance$/);

  // A charge with a receipt opens it.
  await page.goto(`/app/finance/transaction/${withReceipt.id}`);
  await expect(main.getByRole("heading", { level: 1 })).toContainText("Oct 1, 2026");
  await captureScreenshot(page, testInfo, "finance-transaction");
  await main.getByRole("link", { name: "Open receipt" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/finance/receipt/${withReceipt.id}$`));
  await expect(main.getByRole("img", { name: "Receipt" })).toBeVisible();
  // The back button names the previous crumb (the charge); its arrow is decoration.
  await main.getByRole("link", { name: "Oct 1, 2026" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/app/finance/transaction/${withReceipt.id}$`));

  // Refresh runs another sync.
  await page.goto("/app/finance");
  await main.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => calls.filter((c) => c === "refresh").length).toBeGreaterThan(1);
});

test("Finance with nothing connected offers Add account", async ({ page }, testInfo) => {
  await mockFinance(page, emptyOverview);
  await signup(page, `finance-empty-${Date.now()}@rakazo.test`, "password12", "Finance Empty");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-finance").click();
  const main = page.getByRole("main");
  await expect(main.getByText("Add an account to see cash, burn, runway and spend.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Ask Finance agent" })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "finance-empty");
  await main.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("dialog")).toContainText("Upload statements");
});

test("Finance fits a phone and works in dark mode", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await mockFinance(page);
  await signup(page, `finance-phone-${Date.now()}@rakazo.test`, "password12", "Finance Phone");
  await completeOnboarding(page);
  await page.goto("/app/finance");
  const main = page.getByRole("main");
  await expect(main.getByText("$75,000")).toBeVisible();
  // The charts are drawn at the container's width, so nothing may force a sideways scroll.
  const overflow = () =>
    page.evaluate(() => {
      const scroller = document.querySelector("main .rk-scroll");
      return scroller ? scroller.scrollWidth - scroller.clientWidth : -1;
    });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await captureScreenshot(page, testInfo, "finance-phone-dark");
  await page.goto(`/app/finance/vendor/acme-hosting`);
  await expect(main.getByRole("heading", { name: "Acme Hosting", level: 1 })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("Finance crypto card and page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const overview = { ...connectedOverview, crypto: cryptoData.summary };
  await mockFinance(page, overview);
  // mockFinance 404s unknown calls; answer the crypto ones after it (later routes win).
  const added: unknown[] = [];
  await page.route("**/rpc/finance/wallet*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/finance/")[1];
    if (name === "walletAdd") {
      added.push(route.request().postDataJSON());
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          json: {
            defined: true,
            code: "CONFLICT",
            status: 409,
            message: "That wallet is already added",
            data: {},
          },
        }),
      });
    }
    return route.fulfill({ status: 404, body: "not mocked" });
  });
  await page.route("**/rpc/finance/crypto", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: cryptoData, meta: [] }),
    }),
  );
  await signup(page, `finance-crypto-${Date.now()}@rakazo.test`, "password12", "Finance Crypto");
  await completeOnboarding(page);
  await page.goto("/app/finance");
  const main = page.getByRole("main");
  // The Crypto card sits apart from the cash figures.
  await expect(main.getByText("$75,000")).toBeVisible();
  const card = main.locator('a[href="/app/finance/crypto"]');
  await expect(card).toContainText("$3,003");
  await expect(card).toContainText("1 unpriced");
  await captureScreenshot(page, testInfo, "finance-crypto-card");

  await card.click();
  await expect(page).toHaveURL(/\/app\/finance\/crypto$/);
  await expect(main.getByRole("heading", { name: "Crypto", level: 1 })).toBeVisible();
  await expect(main.getByText("Safe · 2 of 3")).toBeVisible();
  await expect(main.getByText("alice.eth")).toBeVisible();
  await expect(main.getByRole("cell", { name: "$3,000.00" }).first()).toBeVisible();
  await expect(main.getByRole("cell", { name: "1.5", exact: true })).toBeVisible();
  await expect(main.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Finance");
  await captureScreenshot(page, testInfo, "finance-crypto-page");

  await main.getByRole("button", { name: "Add wallet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Address or ENS").fill("alice.eth");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("That wallet is already added");
  expect(JSON.stringify(added[0])).toContain("alice.eth");
  await captureScreenshot(page, testInfo, "finance-crypto-add-error");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await main.getByRole("button", { name: "Actions for Treasury" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Remove Treasury?");
});

test("Finance hides the Crypto card without crypto data", async ({ page }) => {
  await mockFinance(page);
  await signup(page, `finance-nocrypto-${Date.now()}@rakazo.test`, "password12", "No Crypto");
  await completeOnboarding(page);
  await page.goto("/app/finance");
  await expect(page.getByRole("main").getByText("$75,000")).toBeVisible();
  await expect(page.locator('a[href="/app/finance/crypto"]')).toHaveCount(0);
});

test("Finance Accounts lists wallets apart from cash and adds one from the menu", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockFinance(page, { ...connectedOverview, crypto: cryptoData.summary });
  const reply = (name: string, body: unknown) =>
    page.route(`**/rpc/finance/${name}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ json: body, meta: [] }),
      }),
    );
  await reply("crypto", cryptoData);
  await reply("accounts", {
    totalCashCents: 7_500_000,
    cardOwedCents: null,
    history: [],
    cash: [
      {
        id: "acc-1",
        name: "Mercury Checking",
        lastFour: "0002",
        balanceCents: 7_500_000,
        annualYieldPct: null,
      },
    ],
    cards: [],
  });
  await signup(page, `finance-accts-${Date.now()}@rakazo.test`, "password12", "Finance Accounts");
  await completeOnboarding(page);
  await page.goto("/app/finance/accounts");
  const main = page.getByRole("main");
  await expect(main.getByText("Mercury Checking")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Crypto" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Count crypto" })).toBeVisible();
  await expect(main.getByRole("img", { name: "Total balance" })).toBeVisible();
  const quarterRequest = page.waitForRequest(
    (r) => r.url().includes("/rpc/finance/balanceSeries") && !!r.postData()?.includes("quarter"),
  );
  await main.getByRole("tab", { name: "Quarter" }).click();
  await quarterRequest;
  await expect(main.locator('a[href="/app/finance/crypto"]').first()).toHaveText("Treasury");
  await expect(main.getByText("$75,000", { exact: true }).first()).toBeVisible();
  await captureScreenshot(page, testInfo, "finance-accounts-crypto-group");

  await main.getByRole("button", { name: "Add account" }).click();
  const options = page.getByRole("dialog");
  await expect(options).toContainText("Upload statements");
  await captureScreenshot(page, testInfo, "finance-accounts-add-menu");
  await options.getByRole("button", { name: /^Wallet/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Add wallet");
  await captureScreenshot(page, testInfo, "finance-accounts-add-wallet");
});

test("Blockscout tile: a keyless server is not connected, Connect opens the key modal", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockFinance(page, emptyOverview);
  let keyed = false;
  await page.route("**/rpc/finance/crypto", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: { ...cryptoData, connected: true, hasApiKey: keyed },
        meta: [],
      }),
    }),
  );
  await page.route("**/rpc/finance/cryptoConnect", (route) => {
    const body = route.request().postDataJSON() as { json?: { apiKey?: string } } | null;
    if (body?.json?.apiKey !== "good-key") {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          json: { defined: false, code: "BAD_REQUEST", status: 400, message: "Invalid API key" },
        }),
      });
    }
    keyed = true;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: { serverId: "11111111-1111-4111-8111-111111111111", hasApiKey: true },
        meta: [],
      }),
    });
  });
  await signup(page, `finance-bs-${Date.now()}@rakazo.test`, "password12", "Finance Blockscout");
  await completeOnboarding(page);
  await page.goto("/app/integrations?category=finance");
  const tile = page.getByTestId("finance-tile-crypto");
  await expect(tile).toContainText("Not connected");
  await captureScreenshot(page, testInfo, "blockscout-tile-not-connected");
  await tile.getByRole("button", { name: "Connect Blockscout" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Get an API key" })).toHaveAttribute(
    "href",
    "https://dev.blockscout.com",
  );
  await dialog.getByLabel("API key").fill("bad-key");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Invalid API key");
  await captureScreenshot(page, testInfo, "blockscout-modal-error");
  await dialog.getByLabel("API key").fill("good-key");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(tile).toContainText("Connected");
  await expect(tile.getByRole("link", { name: "Open" })).toBeVisible();
  await captureScreenshot(page, testInfo, "blockscout-tile-connected");
});

test("Finance runway shows crypto and switches what counts", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockFinance(page, { ...connectedOverview, crypto: cryptoData.summary });
  let scope = runwayData.runwayCrypto;
  const reply = (name: string, body: () => unknown) =>
    page.route(`**/rpc/finance/${name}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ json: body(), meta: [] }),
      }),
    );
  await reply("runway", () => ({
    ...runwayData,
    runwayCrypto: scope,
    cashCents: { bank: 7_500_000, stablecoins: 9_000_000, all: 9_800_000 }[scope],
  }));
  await reply("preferences", () => ({ runwayCrypto: scope }));
  await page.route("**/rpc/finance/setPreferences", (route) => {
    const input = route.request().postDataJSON() as { json: { runwayCrypto: typeof scope } };
    scope = input.json.runwayCrypto;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: input.json, meta: [] }),
    });
  });
  await reply("cryptoHistory", () => cryptoHistoryData);
  await signup(page, `finance-runway-${Date.now()}@rakazo.test`, "password12", "Finance Runway");
  await completeOnboarding(page);
  await page.goto("/app/finance/runway");
  const main = page.getByRole("main");
  // Bank only: the Cash card and the Bank breakdown row both read $75,000.
  await expect(main.getByText("$75,000", { exact: true })).toHaveCount(2);
  await expect(main.getByText("$15,000", { exact: true })).toBeVisible();
  await expect(main.getByText("$8,000", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Count crypto" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await main.getByRole("button", { name: "Count crypto" }).click();
  await expect(main.getByText("$98,000", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Counting all crypto" })).toBeVisible();
});
