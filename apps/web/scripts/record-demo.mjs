// Records the RPC answers the homepage demo replays. Start a mock stack first
// (`DEMO_SLOT=6 pnpm demo:up` from the repo root), then run `pnpm --filter @rakazo/web record:demo`.
// It signs in as the invented demo founder, walks every page a visitor can open, and writes
// src/demo/fixture.json. Re-run it whenever the app's data shapes or the demo data change.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ORIGIN = process.env.DEMO_WEB ?? "http://127.0.0.1:5379";
const SHOTS = process.env.DEMO_SHOTS; // optional directory for debugging screenshots
const creds = Object.fromEntries(
  readFileSync(new URL("../../../.demo-credentials.local", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
// Buttons the walk never presses: they change data or leave the app.
const SKIP =
  /delete|remove|archive|disconnect|sign out|log out|send|approve|reject|deny|upload|connect|reset|revoke|cancel|stop|retry|new |create|invite|import|export|download|refresh|unsubscribe|spam|trash|forward|reply|snooze|clean|hide amounts|mute|unpin|mark /i;

let recording = false; // answers before sign-in are 401s the demo must not replay
const rpc = {};
const streams = new Set();
const meta = { session: null, capabilities: null, recordedAt: 0 };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
const page = await context.newPage();
page.on("response", async (response) => {
  const url = new URL(response.url());
  if (url.origin !== ORIGIN || !recording) return;
  const type = response.headers()["content-type"] ?? "";
  try {
    if (url.pathname.startsWith("/rpc/")) {
      const key = url.pathname.slice("/rpc".length);
      if (type.includes("text/event-stream")) return void streams.add(key);
      const input = response.request().postData() ?? "";
      // The first answer per input is the app's state when the demo opens; later ones reflect the walk.
      rpc[key] ??= [];
      const list = rpc[key];
      if (!list.some((entry) => entry.input === input))
        list.push({ input, status: response.status(), body: await response.text() });
    } else if (url.pathname === "/api/auth/get-session") meta.session ??= await response.json();
    else if (url.pathname === "/api/auth/capabilities") meta.capabilities ??= await response.json();
  } catch {
    // A request cancelled by navigation has no body.
  }
});

const settle = (ms = 1200) => page.waitForTimeout(ms);
let shot = 0;
const snap = async (name) => {
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/${String(shot++).padStart(2, "0")}-${name}.png` });
};
const safe = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    console.warn(`skipped ${label}: ${String(error.message).split("\n")[0]}`);
  }
};

await page.goto(`${ORIGIN}/sign-in`);
await page.getByLabel("Email").fill(creds.email);
await page.locator("input[type=password]").fill(creds.password);
await page.keyboard.press("Enter");
await page.waitForURL(/\/app/);
recording = true;
await page.goto(`${ORIGIN}/app/finance`);
await settle(3000);

/** Presses every harmless control in the main area, one at a time, returning to `home` between presses. */
async function pressControls(home, limit = 14) {
  const labels = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        "main button, main [role=tab], main [role=button], main a[href^='/app']",
      ),
    ];
    return nodes.map((n, i) => {
      n.dataset.demoIdx = String(i);
      const visible = n.offsetParent && !n.disabled;
      return visible
        ? (n.getAttribute("aria-label") || n.textContent || "").trim().replace(/\s+/g, " ")
        : "";
    });
  });
  let pressed = 0;
  for (const [i, label] of labels.entries()) {
    if (!label || label.length > 70 || SKIP.test(label) || pressed >= limit) continue;
    pressed++;
    await safe(label, async () => {
      await page.locator(`[data-demo-idx="${i}"]`).click({ timeout: 1500 });
      await settle(700);
      await page.keyboard.press("Escape");
    });
    await home();
    // `home` re-renders the page, so the tags are gone: tag again before the next press.
    await page.evaluate(() => {
      [
        ...document.querySelectorAll(
          "main button, main [role=tab], main [role=button], main a[href^='/app']",
        ),
      ].forEach((n, i) => {
        n.dataset.demoIdx = String(i);
      });
    });
  }
}

const tap = (name) =>
  page
    .getByRole("tab", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first()
    .click({ timeout: 4000 });
const sidebar = (id) => page.getByTestId(id).click();
const homeOf = (testId) => async () => {
  await sidebar(testId);
  await settle(900);
};

// Finance: every range and breakdown, then the cards below.
await settle(1000);
for (const range of ["Week", "Month", "Quarter", "Year"]) {
  await safe(range, async () => {
    await tap(range);
    await settle(900);
    for (const by of ["Vendor", "Category"]) {
      await tap(by);
      await settle(700);
    }
  });
}
await tap("Month");
await snap("finance");
await pressControls(homeOf("sidebar-finance"), 24);

for (const id of [
  "sidebar-inbox",
  "sidebar-legal",
  "sidebar-cap-table",
  "sidebar-data-room",
  "sidebar-artifacts",
]) {
  await safe(id, async () => {
    await sidebar(id);
    await settle(2000);
    await snap(id);
    await pressControls(homeOf(id));
  });
}

// Every agent chat and group.
const bots = JSON.parse(rpc["/bots/list"][0].body).json.filter((bot) => !bot.archivedAt);
for (const bot of bots) {
  await safe(bot.name, async () => {
    await page.getByTestId("bots-sidebar").getByText(bot.name, { exact: true }).first().click();
    await settle(2000);
    await snap(`bot-${bot.name}`);
    await pressControls(async () => {
      await page.getByTestId("bots-sidebar").getByText(bot.name, { exact: true }).first().click();
      await settle(900);
    }, 8);
  });
}

await browser.close();

// The demo clock starts just after the first Finance sync, so "Updated just now" reads as it did live.
meta.recordedAt = Date.parse(JSON.parse(rpc["/finance/overview"][0].body).json.lastSyncedAt) + 3000;

// The recorded session carries a throwaway local token; replace it with an obvious placeholder.
const text = JSON.stringify({ ...meta, streams: [...streams], rpc });
const clean = text
  .replaceAll(ORIGIN, "https://demo.invalid")
  .replaceAll(/"token":"[^"]*"/g, '"token":"demo"');
writeFileSync(new URL("../src/demo/fixture.json", import.meta.url), clean);
console.log(
  `recorded ${Object.keys(rpc).length} procedures, ${(clean.length / 1024).toFixed(0)} KB`,
);
