import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Adds two Gmail accounts from the Integrations overlay that "Connect mail" opened. */
async function connectTwoGmailAccounts(page: Page) {
  const gmailRow = page
    .getByRole("dialog")
    .getByText("Gmail", { exact: true })
    .first()
    .locator("xpath=ancestor::*[.//button][1]");
  await gmailRow.getByRole("button", { name: "Add", exact: true }).click();
  await gmailRow.getByRole("button", { name: "Added", exact: true }).click();
  const detail = page.getByTestId("connection-detail");
  await detail.getByRole("button", { name: "Add another", exact: true }).click();
  await expect(detail.getByLabel("Account label")).toHaveCount(2);
  const renamed = page.waitForResponse(
    (response) => response.url().includes("connections/rename") && response.ok(),
  );
  await detail.getByLabel("Account label").nth(1).fill("Work");
  await detail.getByLabel("Account label").nth(1).blur();
  await renamed;
}

test("Inbox lists mail from every account, groups it, and opens a message in place", async ({
  page,
}, testInfo) => {
  await signup(page, `inbox-${Date.now()}@rakazo.test`, "password12", "Inbox User");
  await completeOnboarding(page);

  // No account yet: one button, which opens Integrations already filtered to Gmail.
  await page.getByTestId("sidebar-inbox").click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.getByRole("heading", { name: "Inbox", level: 1 })).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-empty");
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await expect(page.getByPlaceholder("Search apps")).toHaveValue("gmail");

  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  // Closing the overlay reloads the page: both accounts sync and the list fills in.
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab", { name: "Work" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Earlier", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Needs reply" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Invoice #1043/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /CI passed on main/ })).toBeVisible();
  await expect(
    page.getByTestId("sidebar-inbox").getByRole("img", { name: "2 unread" }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-list");

  // An account tab shows only that account's mail.
  await tabs.getByRole("tab", { name: "Work" }).click();
  await expect(main.getByRole("button", { name: /Invoice #1043/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toHaveCount(0);
  await tabs.getByRole("tab", { name: "All" }).click();
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();

  // The message's remote image and link point at hosts the test serves itself, so it stays offline.
  const bannerSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96"><rect width="320" height="96" fill="#d97706"/><text x="16" y="56" font-size="28" fill="#fff" font-family="sans-serif">Offsite Oct 14</text></svg>';
  await page
    .context()
    .route("https://example.invalid/**", (route) =>
      route.request().url().endsWith("/agenda")
        ? route.fulfill({ contentType: "text/html", body: "<h1>Agenda</h1>" })
        : route.fulfill({ contentType: "image/svg+xml", body: bannerSvg }),
    );

  // A message opens under its row, keeps ?mail= (not ?m=) in the URL, and Back closes it.
  const row = main.getByRole("button", { name: /Offsite dates/ });
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const url = new URL(page.url());
  expect(url.searchParams.get("mail")).toBeTruthy();
  expect(url.searchParams.has("m")).toBe(false);
  // The message carries a script that would rewrite #probe; the text staying put means it did not run.
  const frame = page.locator('iframe[title="Offsite dates"]');
  const body = frame.contentFrame().locator("#preview").contentFrame();
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  // Both the https image and the inline cid: image load.
  for (const selector of ["img#remote", "img#inline"]) {
    await expect
      .poll(() =>
        body.locator(selector).evaluate((img) => {
          const image = img as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
  }
  // The frame fits the content instead of filling the old fixed box.
  await expect.poll(async () => (await frame.boundingBox())?.height ?? 0).toBeGreaterThan(150);
  expect((await frame.boundingBox())?.height ?? 0).toBeLessThan(400);
  await captureScreenshot(page, testInfo, "inbox-message-open");

  // Links open in a new tab that cannot reach the app; a javascript: link is dropped.
  await expect(body.locator("a#unsafe")).not.toHaveAttribute("href", /./);
  const popupOpened = page.waitForEvent("popup");
  await body.locator("a#agenda").click();
  const popup = await popupOpened;
  await expect(popup).toHaveURL("https://example.invalid/agenda");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  await page.goBack();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  expect(new URL(page.url()).searchParams.has("mail")).toBe(false);
});

test("on a phone the Inbox page still has a way to open the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signup(page, `inbox-phone-${Date.now()}@rakazo.test`, "password12", "Inbox Phone");
  await completeOnboarding(page);
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByTestId("sidebar-inbox")).toBeVisible();
  await page.getByTestId("sidebar-inbox").click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
});

const localDate = (daysFromToday: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
};

test("Inbox fills in Needs reply and the To do card once triage has run", async ({
  page,
}, testInfo) => {
  await signup(page, `inbox-todo-${Date.now()}@rakazo.test`, "password12", "Inbox Todo");
  await completeOnboarding(page);

  // The e2e stack has no allowed model, so triage cannot run. Report what the API would return
  // after it ran: lists say triage is pending for 4 seconds after mail first appears, then carry
  // the results, so the page's own 5-second refetch is what shows them.
  let mailSeenAt = 0;
  let triaged = false;
  let lists = 0;
  let setDoneBody: { id: string; done: boolean } | undefined;
  const todo = (id: string, text: string, dueOn: string | null, extra = {}) => ({
    id,
    connectionId: "c",
    messageId: null,
    text,
    detail: null,
    from: null,
    priority: null,
    dueOn,
    doneAt: null,
    ...extra,
  });
  const todos = [
    todo("t1", "Sign the vendor agreement", localDate(0), {
      from: "Acme Legal",
      detail: "DocuSign request, not completed",
    }),
    todo("t2", "Reply to Sam about the Q4 offsite dates", localDate(2), {
      detail: "Asked a direct question 2 days ago",
    }),
    todo("t3", "Pay the October invoice", localDate(4), { from: "Northwind Hosting" }),
  ];
  await page.route("**/rpc/inbox/list", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { json: { rows: Array<{ subject: string }> } };
    lists += 1;
    if (!mailSeenAt && body.json.rows.length > 0) mailSeenAt = Date.now();
    triaged = mailSeenAt > 0 && Date.now() - mailSeenAt >= 4_000;
    const rows = body.json.rows.map((row) =>
      triaged && row.subject === "Offsite dates"
        ? { ...row, needsReply: true, priority: "important", reason: "Asked a direct question" }
        : { ...row, priority: null, reason: null },
    );
    await route.fulfill({
      response,
      json: { ...body, json: { ...body.json, rows, enabled: true, triagePending: !triaged } },
    });
  });
  await page.route("**/rpc/inbox/todos/list", (route) =>
    route.fulfill({ json: { json: { enabled: true, todos: triaged ? todos : [] } } }),
  );
  await page.route("**/rpc/inbox/todos/setDone", (route) => {
    setDoneBody = (route.request().postDataJSON() as { json: typeof setDoneBody }).json;
    const done = todos.find((item) => item.id === setDoneBody?.id);
    return route.fulfill({
      json: { json: { ...done, doneAt: setDoneBody?.done ? new Date().toISOString() : null } },
    });
  });

  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  // Nothing triaged yet: no card, no Needs reply group.
  await expect(main.getByRole("region", { name: "To do" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Needs reply" })).toHaveCount(0);

  // The page refetches on its own while the list reports triage pending.
  const card = main.getByRole("region", { name: "To do" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Sign the vendor agreement")).toBeVisible();
  await expect(card.getByText("Acme Legal · DocuSign request, not completed")).toBeVisible();
  await expect(card.getByText("Today", { exact: true })).toBeVisible();
  const needsReply = main.getByRole("heading", { name: "Needs reply", level: 2 });
  await expect(needsReply).toBeVisible();
  await expect(
    needsReply.locator("xpath=..").getByRole("button", { name: /Offsite dates/ }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-todo-card");

  // Checking a to-do sends the change and keeps the item visible, struck through.
  const checkbox = card.getByRole("checkbox", { name: "Pay the October invoice" });
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  expect(setDoneBody).toEqual({ id: "t3", done: true });
  await expect(card.getByText("Pay the October invoice").first()).toHaveClass(/line-through/);

  // Polling stopped once the list stopped reporting triage pending.
  const seen = lists;
  await page.waitForTimeout(6_000);
  expect(lists).toBe(seen);
});
