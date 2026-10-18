import { expect, type Page, test } from "@playwright/test";
import {
  balanceSeriesOf,
  connectedOverview,
  cryptoData,
  cryptoHistoryData,
  emptyOverview,
  monthData,
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
      month: monthData,
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
  // Category links carry the chosen period, so the category page opens on the same window.
  await expect(main.locator('a[href="/app/finance/category/payroll?period=year"]')).toBeVisible();
  await main.getByRole("button", { name: "Vendor", exact: true }).click();
  await expect(main.locator('a[href="/app/finance/vendor/globex-compute"]').first()).toBeVisible();
  await expect(main.locator('a[href^="/app/finance/category/payroll"]')).toHaveCount(0);

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
  // Opened from the dashboard's Breakdown card, so the trail says so (Acme Hosting is also a
  // subscription, but the user did not come from there).
  await expect(main.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
    "Finance/Breakdown/Acme Hosting",
  );
  await captureScreenshot(page, testInfo, "finance-vendor");

  // A charge without a receipt says so and offers no upload.
  await main.locator("tbody tr").filter({ hasText: "Pro plan" }).first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/app/finance/transaction/${withoutReceipt.id}$`));
  await expect(main.getByText("No receipt")).toBeVisible();
  await expect(main.getByRole("button", { name: /Upload/ })).toHaveCount(0);
  // The charge was opened from the vendor, which was opened from Breakdown; the trail keeps both.
  const trail = main.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.getByRole("link", { name: "Acme Hosting" })).toBeVisible();
  await trail.getByRole("link", { name: "Breakdown" }).click();
  await expect(page).toHaveURL(/\/app\/finance\?by=vendor#breakdown$/);

  // A charge with a receipt opens it.
  await page.goto(`/app/finance/transaction/${withReceipt.id}`);
  // The title names the merchant; the charge's own crumb carries its day and amount.
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Acme Hosting");
  await expect(main.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Oct 1 · $");
  await captureScreenshot(page, testInfo, "finance-transaction");
  await main.getByRole("link", { name: "Open receipt" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/finance/receipt/${withReceipt.id}$`));
  await expect(main.getByRole("img", { name: "Receipt" })).toBeVisible();
  // The back button names the previous crumb (the charge); its arrow is decoration.
  await main
    .getByRole("link", { name: /Oct 1 · \$/ })
    .first()
    .click();
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
  // The page title sits above the empty state, as on every other page.
  await expect(main.getByRole("heading", { name: "Finance", level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "No accounts yet", level: 2 })).toBeVisible();
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
  // The wallet's ENS name shows under its label, and a Wallet column names it in each holding row.
  await expect(main.getByText("alice.eth").first()).toBeVisible();
  await expect(main.getByRole("columnheader", { name: "Wallet" })).toBeVisible();
  await expect(main.getByRole("cell", { name: "alice.eth" }).first()).toBeVisible();
  await expect(main.getByRole("cell", { name: "$3,000", exact: true }).first()).toBeVisible();
  await expect(main.getByRole("cell", { name: "1.5", exact: true })).toBeVisible();
  // One level below the dashboard, the trail is a Back link rather than a breadcrumb.
  await expect(main.getByRole("link", { name: "Finance", exact: true })).toBeVisible();
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
  // Count crypto lives on the Runway page now, not on Accounts.
  await expect(main.getByRole("button", { name: "Count crypto" })).toHaveCount(0);
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

test("Blockscout tile: no server is ready without a key, Add API key opens the key modal", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockFinance(page, emptyOverview);
  let keyed = false;
  await page.route("**/rpc/finance/crypto", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: { ...cryptoData, connected: keyed, hasApiKey: keyed },
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
  // No key is needed: the tile is ready, offers Add wallet, and keeps the key in its menu.
  await expect(tile).toContainText("Ready");
  await expect(tile).toContainText("no key needed");
  await expect(tile).not.toContainText("Not connected");
  await expect(tile.getByRole("link", { name: "Add wallet" })).toBeVisible();
  await captureScreenshot(page, testInfo, "blockscout-tile-not-connected");
  await tile.getByRole("button", { name: "More Blockscout actions" }).click();
  await page.getByRole("menuitem", { name: "Add API key" }).click();
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
  await expect(tile).not.toContainText("Not connected");
  await expect(tile.getByRole("link", { name: "Open Finance" })).toBeVisible();
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
  // Bank only: the Cash card, the Bank breakdown row and the In runway row all read $75,000.
  await expect(main.getByText("$75,000", { exact: true })).toHaveCount(3);
  await expect(
    main.getByText("In runway", { exact: true }).locator("xpath=following-sibling::*[1]"),
  ).toHaveText("$75,000");
  await expect(main.getByText("$15,000 · not in runway", { exact: true })).toBeVisible();
  await expect(main.getByText("$8,000 · not in runway", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Count crypto" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await main.getByRole("button", { name: "Count crypto" }).click();
  // The Cash card and the In runway row both read the full total.
  await expect(main.getByText("$98,000", { exact: true })).toHaveCount(2);
  await expect(main.getByRole("button", { name: "Counting all crypto" })).toBeVisible();
});

test("Finance month groups transactions by vendor and expands a vendor", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockFinance(page);
  await signup(page, `finance-group-${Date.now()}@rakazo.test`, "password12", "Finance Group");
  await completeOnboarding(page);
  await page.goto("/app/finance/month/2026-10");
  const main = page.getByRole("main");
  const rows = main.locator("tbody tr");

  // The flat list is the default: five transactions.
  await expect(rows).toHaveCount(5);
  await captureScreenshot(page, testInfo, "finance-month-flat");

  // Grouped: one row per vendor, largest total first, spelled variants merged.
  await main.getByRole("button", { name: "By vendor", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Example Customer Inc");
  await expect(rows.nth(0)).toContainText("+$1,000");
  await expect(rows.nth(1)).toContainText("Acme Hosting");
  await expect(rows.nth(1)).toContainText("2 transactions");
  await expect(rows.nth(1)).toContainText("$620");
  await expect(rows.nth(2)).toContainText("Globex Compute");
  await expect(rows.nth(2)).toContainText("Mixed");
  await expect(rows.nth(2)).toContainText("$250");
  await captureScreenshot(page, testInfo, "finance-month-grouped");

  // Expanding a vendor lists its transactions in the flat row style.
  await main.getByRole("button", { name: "Acme Hosting" }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(2)).toContainText("Usage");
  await captureScreenshot(page, testInfo, "finance-month-grouped-expanded");

  // The same three states in the dark scheme. The grouped choice survives the reload.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(rows).toHaveCount(3);
  await captureScreenshot(page, testInfo, "finance-month-grouped-dark");
  await main.getByRole("button", { name: "Acme Hosting" }).click();
  await expect(rows).toHaveCount(5);
  await captureScreenshot(page, testInfo, "finance-month-grouped-expanded-dark");
  await main.getByRole("button", { name: "List", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await captureScreenshot(page, testInfo, "finance-month-flat-dark");
  await page.emulateMedia({ colorScheme: "light" });
  await main.getByRole("button", { name: "By vendor", exact: true }).click();

  // The choice is remembered on this device.
  await page.reload();
  await expect(rows).toHaveCount(3);
  await main.getByRole("button", { name: "List", exact: true }).click();
  await expect(rows).toHaveCount(5);
});
