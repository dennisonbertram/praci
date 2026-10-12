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

  // A message opens under its row, keeps ?mail= (not ?m=) in the URL, and Back closes it.
  const row = main.getByRole("button", { name: /Offsite dates/ });
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const url = new URL(page.url());
  expect(url.searchParams.get("mail")).toBeTruthy();
  expect(url.searchParams.has("m")).toBe(false);
  // The message carries a script that would rewrite #probe; the text staying put means it did not run.
  const body = page.frameLocator('iframe[title="Offsite dates"]').frameLocator("#preview");
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  await captureScreenshot(page, testInfo, "inbox-message-open");
  await page.goBack();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  expect(new URL(page.url()).searchParams.has("mail")).toBe(false);
});

test("Inbox filters and searches the whole mailbox through Gmail", async ({ page }, testInfo) => {
  await signup(page, `inbox-filter-${Date.now()}@rakazo.test`, "password12", "Inbox Filter");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  const tabs = page.getByRole("tablist");
  const filterMenu = page.getByTestId("inbox-filter");
  const choose = async (name: string) => {
    await filterMenu.click();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
  };
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();

  // Starred: the 40-day-old message is outside the 14-day sync window, so only Gmail has it.
  await choose("Starred");
  await expect(page).toHaveURL(/[?&]filter=starred/);
  await expect(main.getByRole("button", { name: /Signed contract/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Q3 report/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Earlier", level: 2 })).toBeVisible();
  await expect(filterMenu).toHaveText("Starred");
  const url = new URL(page.url());
  expect(url.searchParams.has("m")).toBe(false);
  expect(url.searchParams.has("mail")).toBe(false);
  await captureScreenshot(page, testInfo, "inbox-filter-starred");

  // A filtered row still opens in place.
  await main.getByRole("button", { name: /Signed contract/ }).click();
  await expect(main.getByText("The signed contract is filed.")).toBeVisible();
  await page.goBack();

  await choose("Has attachment");
  await expect(main.getByRole("button", { name: /Q3 report/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Signed contract/ })).toHaveCount(0);

  await choose("Promotions");
  await expect(main.getByRole("button", { name: /Weekend sale/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Q3 report/ })).toHaveCount(0);

  // Unread respects the account tab.
  await choose("Unread");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Invoice #1043/ })).toBeVisible();
  await tabs.getByRole("tab", { name: "Work" }).click();
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /Invoice #1043/ })).toBeVisible();
  await tabs.getByRole("tab", { name: "All" }).click();

  // Clearing the filter brings back the cached Inbox.
  await filterMenu.click();
  await page.getByRole("menuitem", { name: "Clear", exact: true }).click();
  await expect(page).not.toHaveURL(/filter=/);
  await expect(main.getByRole("button", { name: /CI passed on main/ })).toBeVisible();

  // Search passes Gmail syntax through, alone and with a filter.
  const search = main.getByRole("searchbox", { name: "Search mail" });
  await search.fill("from:northwind");
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=from%3Anorthwind/);
  await expect(main.getByRole("button", { name: /Invoice #1043/ })).toBeVisible();
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "inbox-search");
  await choose("Starred");
  await expect(main.getByText("No mail", { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-search-empty");

  // Gmail rejecting the query shows the error and its retry button, not an empty list.
  await main.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await search.fill("has:drive");
  await search.press("Enter");
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(main.getByText("No mail", { exact: true })).toHaveCount(0);
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
