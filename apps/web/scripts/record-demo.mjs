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
      // Keep the fullest answer per input: an early one can be a loading-state empty list.
      rpc[key] ??= [];
      const list = rpc[key];
      const body = await response.text();
      const known = list.find((entry) => entry.input === input);
      if (!known) list.push({ input, status: response.status(), body });
      else if (body.length > known.body.length)
        Object.assign(known, { status: response.status(), body });
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
// A first visit opens a product tour over the sidebar.
await safe("tour", () => page.getByRole("button", { name: "Skip tour" }).click({ timeout: 3000 }));

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
    if (!label || label.length > 160 || SKIP.test(label) || pressed >= limit) continue;
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
    if (id === "sidebar-inbox") {
      // Mail is sorted into piles a little after it syncs; give it time so each pile has its mail.
      await settle(20000);
      for (const name of [
        "Updates",
        "Newsletters",
        "Founder mail",
        "Sales mail",
        "Important",
        "All",
      ]) {
        await safe(name, async () => {
          await tap(name);
          await settle(1200);
        });
      }
    }
    await pressControls(homeOf(id), 20);
  });
}

// Integrations, Activity and search.
await safe("integrations", async () => {
  await page.goto(`${ORIGIN}/app/integrations`);
  await settle(2200);
  await snap("integrations");
  await pressControls(async () => {
    await page.goto(`${ORIGIN}/app/integrations`);
    await settle(1200);
  }, 10);
});
await safe("activity", async () => {
  await page.goto(`${ORIGIN}/app/finance`);
  await settle(1500);
  await page.getByRole("button", { name: "Activity" }).first().click();
  await settle(1500);
  await snap("activity");
  await page
    .getByText(/finished runs?/)
    .first()
    .click({ timeout: 2000 });
  await settle(1200);
  await snap("activity-finished");
});
await safe("search", async () => {
  await page.goto(`${ORIGIN}/app/finance`);
  await settle(1500);
  for (const query of ["Halcyon", "runway", "invoice"]) {
    await page.getByTestId("sidebar-search").click();
    await page.keyboard.type(query);
    await settle(1800);
    await snap(`search-${query}`);
    await page.keyboard.press("Escape");
    await page
      .getByTestId("sidebar-search")
      .fill("")
      .catch(() => undefined);
  }
});

// Every agent chat and group, opened by address so each loads from a cold start.
const nav = JSON.parse(
  rpc["/bootstrap"].reduce((a, b) => (b.body.length > a.body.length ? b : a)).body,
).json;
const chats = [
  ...nav.bots
    .filter((bot) => !bot.archivedAt)
    .map((bot) => ({ name: bot.name, path: `/app/${bot.id}` })),
  ...nav.groups.map((group) => ({ name: group.name, path: `/app/g/${group.id}` })),
];
for (const chat of chats) {
  // As a visitor would: from another page, click the chat in the sidebar (which loads its thread).
  const open = async () => {
    await page.getByTestId("sidebar-finance").click();
    await settle(700);
    await page.getByTestId("bots-sidebar").getByText(chat.name, { exact: true }).first().click();
    await settle(2200);
  };
  await safe(chat.name, async () => {
    await open();
    await snap(`chat-${chat.name}`);
    await pressControls(open, 12);
  });
}

// A chat opened while the page was busy may not have loaded its thread; open it again until it has.
const loaded = () =>
  new Set(
    (rpc["/threads/get"] ?? []).map((entry) => {
      const input = JSON.parse(entry.input).json;
      return input.botId ?? input.groupId;
    }),
  );
for (let attempt = 0; attempt < 3; attempt++) {
  const have = loaded();
  const missing = chats.filter((chat) => !have.has(chat.path.split("/").at(-1)));
  if (!missing.length) break;
  for (const chat of missing) {
    await safe(chat.name, async () => {
      await page.getByTestId("sidebar-finance").click();
      await settle(1500);
      await page.getByTestId("bots-sidebar").getByText(chat.name, { exact: true }).first().click();
      await settle(4000);
    });
  }
}
if (chats.some((chat) => !loaded().has(chat.path.split("/").at(-1))))
  console.warn("some chats never loaded a thread");

// Every artifact.
const artifacts = JSON.parse(rpc["/artifacts/listSpace"][0].body).json.items ?? [];
for (const artifact of artifacts) {
  await safe(artifact.name, async () => {
    await page.goto(`${ORIGIN}/app/artifacts/${artifact.id}`);
    await settle(2200);
    await snap(`artifact-${artifact.id}`);
  });
}

await browser.close();

// The stack also holds spaces made for testing other states (empty, mail needs reconnecting); the
// demo shows only the company.
for (const key of ["/spaces/list", "/bootstrap"]) {
  for (const entry of rpc[key] ?? []) {
    const parsed = JSON.parse(entry.body);
    if (Array.isArray(parsed.json?.spaces)) {
      parsed.json.spaces = parsed.json.spaces.filter((space) => space.isDefault);
      entry.body = JSON.stringify(parsed);
    }
  }
}

// The demo clock starts just after the first Finance sync, so "Updated just now" reads as it did live.
meta.recordedAt = Date.parse(JSON.parse(rpc["/finance/overview"][0].body).json.lastSyncedAt) + 3000;

// The recorded session carries a throwaway local token; replace it with an obvious placeholder.
const text = JSON.stringify({ ...meta, streams: [...streams], rpc });
const clean = text
  .replaceAll(/"ipAddress":"[^"]*"/g, '"ipAddress":""')
  .replaceAll(/"userAgent":"[^"]*"/g, '"userAgent":""')
  .replaceAll(/http:\/\/127\.0\.0\.1:\d+/g, "https://demo.invalid")
  .replaceAll(/"token":"[^"]*"/g, '"token":"demo"');
writeFileSync(new URL("../src/demo/fixture.json", import.meta.url), clean);
console.log(
  `recorded ${Object.keys(rpc).length} procedures, ${(clean.length / 1024).toFixed(0)} KB`,
);
