import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

const api = () => process.env.API_URL ?? "http://127.0.0.1:3110";

type Snapshot = Record<string, { sent: { raw: string }[] }>;

/** The decoded plain-text part of a raw message the Gmail emulator holds. */
function plainText(raw: string): string {
  const part = /Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/i.exec(raw)?.[1] ?? "";
  return Buffer.from(part.replace(/\s+/g, ""), "base64").toString("utf8");
}

/** The path and fragment of a portal link in a message, so it opens on this run's web origin. */
function portalPath(text: string): string {
  const link = /https?:\/\/[^\s"<>()]+\/portal\/open#[\w-]+/.exec(text)?.[0];
  if (!link) throw new Error("no portal link in the message");
  const url = new URL(link);
  return `${url.pathname}${url.hash}`;
}

async function founder(page: Page, label: string) {
  await signup(page, `${label}-${Date.now()}@rakazo.test`, "password12", "Portal Founder");
  await completeOnboarding(page);
}

async function addInvestor(page: Page, email: string) {
  return rpc<{ id: string }>(page, "contacts/save", {
    name: "Ada Example",
    email,
    kind: "investor",
  });
}

async function draftUpdate(page: Page, subject: string) {
  const update = await rpc<{ id: string }>(page, "investors/updates/save", {
    audience: "investors",
    subject,
    body: "## Highlights\n\n- Shipped the first release",
  });
  return update.id;
}

/** An investor's browser: a fresh context with no app session. Records every request URL. */
async function investorBrowser(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  const urls: string[] = [];
  context.on("request", (request) => urls.push(request.url()));
  return { context, page: await context.newPage(), urls };
}

test("an emailed update opens in the portal with only that update, and Revoke kills the link", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  const email = `ada-${Date.now()}@example.test`;
  const subject = `Example Co update ${Date.now()}`;
  await founder(page, "portal-send");
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true }).click();
  // The emulated Gmail account is connected once the sign-in window has run; the Send button needs it.
  await expect
    .poll(async () => (await rpc<unknown[]>(page, "investors/updates/accounts", {})).length)
    .toBeGreaterThan(0);
  await addInvestor(page, email);
  const updateId = await draftUpdate(page, subject);

  await page.goto(`/app/investors/updates/${updateId}`);
  const main = page.getByRole("main");
  await expect(main.getByLabel("Subject")).toHaveValue(subject);
  await main.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/investors$/);

  // The Gmail emulator holds the message, and the link is in it.
  const { userId } = await rpc<{ userId: string }>(page, "me", {});
  let link = "";
  await expect
    .poll(async () => {
      const snapshot = (await (
        await page.request.get(`${api()}/__e2e/gmail?userId=${userId}`)
      ).json()) as Snapshot;
      const sent = Object.values(snapshot).flatMap((account) => account.sent);
      const message = sent.find((m) => m.raw.includes(email));
      link = message ? portalPath(plainText(message.raw)) : "";
      return link;
    })
    .toContain("/portal/open#");
  const token = link.split("#")[1] ?? "";

  const investor = await investorBrowser(browser, baseURL);
  await investor.page.goto(link);
  // The landing page: an Open button and nothing that names the company.
  await expect(investor.page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(investor.page.getByText("Example Co")).toHaveCount(0);
  await captureScreenshot(investor.page, testInfo, "investor-portal-open");
  await investor.page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(investor.page).toHaveURL(/\/portal\/home$/);
  await expect(investor.page.getByRole("heading", { name: subject })).toBeVisible();
  await expect(investor.page.getByText("Shipped the first release")).toBeVisible();
  await expect(investor.page.getByText("Nothing shared yet.")).toHaveCount(0);
  await captureScreenshot(investor.page, testInfo, "investor-portal");
  // The token travelled only in the fragment and the Open POST body, never in a request line.
  expect(investor.urls.filter((url) => url.includes(token))).toEqual([]);

  // The founder sees the link was opened, then revokes it.
  await page.goto("/app/investors");
  const row = page.locator("[data-contact-id]", { hasText: "Ada Example" });
  await expect(row.locator("[data-portal-state]")).toContainText("Opened");
  await row.getByRole("button", { name: "Actions for Ada Example" }).click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  await expect(row.locator("[data-portal-state]")).toHaveText("Revoked");

  // The open session and the old link both refuse at once.
  await investor.page.reload();
  await expect(investor.page.getByText("This link no longer works.")).toBeVisible();
  const second = await investorBrowser(browser, baseURL);
  await second.page.goto(link);
  await second.page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(second.page.getByText("This link no longer works.")).toBeVisible();
  await investor.context.close();
  await second.context.close();
});

test("without Gmail, Post to portal lists the update and emails a portal notice", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  const email = `bo-${Date.now()}@example.test`;
  const subject = `Posted update ${Date.now()}`;
  await founder(page, "portal-post");
  await addInvestor(page, email);
  const updateId = await draftUpdate(page, subject);

  await page.goto(`/app/investors/updates/${updateId}`);
  const main = page.getByRole("main");
  await expect(main.getByLabel("Subject")).toHaveValue(subject);
  await main.getByRole("button", { name: "Post to portal" }).click();
  await expect(page).toHaveURL(/\/app\/investors$/);
  await expect(page.getByRole("alert").getByText("Posted · 1 notified")).toBeVisible();
  await expect(
    main.getByRole("region", { name: "Updates" }).getByText("Posted", { exact: true }),
  ).toBeVisible();

  const emails = (await (await page.request.get(`${api()}/__e2e/emails`)).json()) as {
    to: string;
    text: string;
  }[];
  const notice = emails.find((message) => message.to === email);
  expect(notice).toBeDefined();
  const investor = await investorBrowser(browser, baseURL);
  await investor.page.goto(portalPath(notice?.text ?? ""));
  await investor.page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(investor.page.getByRole("heading", { name: subject })).toBeVisible();
  await investor.context.close();
});
