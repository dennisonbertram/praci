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
  await captureScreenshot(page, testInfo, "inbox-message-open");

  // Links open in a new tab that cannot reach the app; a javascript: link has no target.
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

test("an opened message lists its attachments and downloads one", async ({ page }, testInfo) => {
  await signup(page, `inbox-attach-${Date.now()}@rakazo.test`, "password12", "Inbox Attach");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  // A message with no attachment shows no list.
  await main.getByRole("button", { name: /CI passed on main/ }).click();
  await expect(main.getByText("All checks have passed.")).toBeVisible();
  await expect(main.getByRole("list", { name: "Attachments" })).toHaveCount(0);
  await page.goBack();

  await main.getByRole("button", { name: /Q3 report/ }).click();
  const attachments = main.getByRole("list", { name: "Attachments" });
  await expect(attachments.getByRole("button")).toHaveCount(2);
  await expect(attachments.getByRole("button", { name: /budget\.csv/ })).toBeVisible();
  const report = attachments.getByRole("button", { name: /q3-report\.pdf/ });
  await expect(report).toContainText(/18\s?B/);
  await captureScreenshot(page, testInfo, "inbox-attachments");

  const downloading = page.waitForEvent("download");
  await report.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("q3-report.pdf");
  const path = await download.path();
  expect((await import("node:fs")).readFileSync(path, "utf8")).toBe("%PDF-1.4 Q3 report");
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
      json: {
        ...body,
        json: { ...body.json, rows, enabled: true, triageBlocked: null, triagePending: !triaged },
      },
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

test("Inbox narrows to Important and to a category, flags suspicious mail, and takes marks with undo", async ({
  page,
}, testInfo) => {
  await signup(page, `inbox-views-${Date.now()}@rakazo.test`, "password12", "Inbox Views");
  await completeOnboarding(page);

  // Real: the Gmail emulator, the sync into Postgres, and the real inbox.list, which validates every
  // request below (including view and category). Stubbed: the triage results and the server's view and
  // mark logic, because the e2e stack has no allowed model so the real list reports triage disabled.
  // The Postgres tests in apps/api cover that logic against the real endpoint.
  type ListInput = { connectionId?: string; view?: string; category?: string; filter?: string };
  type Row = {
    id: string;
    connectionId: string;
    subject: string;
    needsReply: boolean | null;
    priority: string | null;
    reason: string | null;
    category: string | null;
    feedback: string | null;
  };
  const triage: Record<string, Pick<Row, "needsReply" | "priority" | "category">> = {
    "Offsite dates": { needsReply: true, priority: "important", category: "reply" },
    "Invoice #1043": { needsReply: false, priority: "normal", category: "billing" },
    "CI passed on main": { needsReply: false, priority: "low", category: "notification" },
    "Verify your account": { needsReply: false, priority: "normal", category: "suspicious" },
  };
  const requests: ListInput[] = [];
  const feedbackBodies: Array<{ messageId: string; mark: string | null }> = [];
  const marks = new Map<string, string>();
  const subjects = new Map<string, string>();
  await page.route("**/rpc/inbox/list", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { json: { rows: Row[] } };
    const input = (route.request().postDataJSON() as { json?: ListInput }).json ?? {};
    requests.push(input);
    let rows = body.json.rows;
    const invoice = rows.find((row) => row.subject === "Invoice #1043");
    if (invoice && !input.filter) {
      rows = [...rows, { ...invoice, id: "stub-suspicious", subject: "Verify your account" }];
    }
    rows = rows.map((row) => {
      subjects.set(row.id, row.subject);
      const base = { ...row, ...triage[row.subject], reason: null };
      const mark = marks.get(row.id) ?? null;
      return {
        ...base,
        feedback: mark,
        ...(mark === "noise"
          ? { needsReply: base.needsReply === null ? null : false, priority: "low" }
          : {}),
      };
    });
    if (!input.filter) {
      if (input.connectionId) rows = rows.filter((row) => row.connectionId === input.connectionId);
      if (input.view === "important") {
        rows = rows.filter(
          (row) =>
            row.feedback !== "noise" &&
            (row.feedback === "important" ||
              row.needsReply === true ||
              ["critical", "important"].includes(row.priority ?? "")),
        );
      }
      if (input.category) rows = rows.filter((row) => row.category === input.category);
    }
    await route.fulfill({
      response,
      json: {
        json: { ...body.json, rows, enabled: true, triageBlocked: null, triagePending: false },
      },
    });
  });
  await page.route("**/rpc/inbox/feedback", (route) => {
    const input = (route.request().postDataJSON() as { json: (typeof feedbackBodies)[number] })
      .json;
    feedbackBodies.push(input);
    if (input.mark) marks.set(input.messageId, input.mark);
    else marks.delete(input.messageId);
    return route.fulfill({ json: { json: { mark: input.mark } } });
  });

  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  const row = (name: string | RegExp) => main.getByRole("button", { name });
  const important = main.getByRole("button", { name: "Important", exact: true });
  await expect(row(/Offsite dates/)).toBeVisible();

  // Suspicious mail carries a named warning and stays in the list.
  const warnings = main.getByRole("img", { name: "Suspicious" });
  await expect(row(/Verify your account/)).toBeVisible();
  await expect(warnings).toHaveCount(1);
  await expect(row(/Verify your account/).getByRole("img", { name: "Suspicious" })).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-suspicious-badge");

  // Important view: the server narrows the list; the URL and the account tab are kept.
  await expect(important).toHaveAttribute("aria-pressed", "false");
  await important.click();
  await expect(page).toHaveURL(/[?&]view=important/);
  await expect(important).toHaveAttribute("aria-pressed", "true");
  await expect(row(/Offsite dates/)).toBeVisible();
  await expect(row(/Invoice #1043/)).toHaveCount(0);
  await expect(row(/CI passed on main/)).toHaveCount(0);
  await expect.poll(() => requests.at(-1)).toMatchObject({ view: "important" });
  await captureScreenshot(page, testInfo, "inbox-important-view");
  await page.getByRole("tablist").getByRole("tab", { name: "Work" }).click();
  await expect(row(/Offsite dates/)).toHaveCount(0);
  await expect(main.getByText("No mail", { exact: true })).toBeVisible();
  await expect
    .poll(() => requests.at(-1))
    .toMatchObject({ view: "important", connectionId: expect.any(String) });
  await page.getByRole("tablist").getByRole("tab", { name: "All" }).click();
  await important.click();
  await expect(page).not.toHaveURL(/view=/);
  await expect(row(/Invoice #1043/)).toBeVisible();

  // A category from the filter menu replaces the Important view and shows in the trigger.
  const filterMenu = page.getByTestId("inbox-filter");
  await filterMenu.click();
  await expect(page.getByRole("menuitemradio", { name: "Bills", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-filter-menu");
  await page.getByRole("menuitemradio", { name: "Bills", exact: true }).click();
  await expect(page).toHaveURL(/[?&]category=billing/);
  await expect(filterMenu).toHaveText("Bills");
  await expect(row(/Invoice #1043/)).toBeVisible();
  await expect(row(/Offsite dates/)).toHaveCount(0);
  await expect.poll(() => requests.at(-1)).toMatchObject({ category: "billing" });
  await captureScreenshot(page, testInfo, "inbox-category-bills");

  // A Gmail filter replaces the category; Clear brings back the whole list.
  await filterMenu.click();
  await page.getByRole("menuitemradio", { name: "Unread", exact: true }).click();
  await expect(page).toHaveURL(/[?&]filter=unread/);
  await expect(page).not.toHaveURL(/category=/);
  await expect.poll(() => requests.at(-1)?.filter).toBe("unread");
  expect(requests.at(-1)?.category).toBeUndefined();
  await filterMenu.click();
  await page.getByRole("menuitem", { name: "Clear", exact: true }).click();
  await expect(row(/CI passed on main/)).toBeVisible();

  // Mark noise from the keyboard-reachable row menu: the row leaves Needs reply, stays listed, and
  // Undo restores it. Nothing is deleted.
  const needsReply = main
    .getByRole("heading", { name: "Needs reply", level: 2 })
    .locator("xpath=..");
  await expect(needsReply.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  const actions = needsReply
    .getByRole("button", { name: /Offsite dates/ })
    .locator("xpath=..")
    .getByRole("button", { name: "More", exact: true });
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemcheckbox", { name: "Mark important" })).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-feedback-menu");
  await page.getByRole("menuitemcheckbox", { name: "Mark noise" }).click();
  await expect.poll(() => feedbackBodies.at(-1)).toMatchObject({ mark: "noise" });
  const status = main.getByRole("status");
  await expect(status).toContainText("Marked noise");
  await expect(main.getByRole("heading", { name: "Needs reply" })).toHaveCount(0);
  await expect(row(/Offsite dates/)).toBeVisible();
  await expect(row(/Offsite dates/)).toHaveClass(/text-muted-foreground/);
  await captureScreenshot(page, testInfo, "inbox-marked-noise");
  await status.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => feedbackBodies.at(-1)).toMatchObject({ mark: null });
  await expect(status).toHaveCount(0);
  await expect(needsReply.getByRole("button", { name: /Offsite dates/ })).toBeVisible();

  // Marking a sender important from the menu shows its checked state next time.
  await actions.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitemcheckbox", { name: "Mark important" }).click();
  await expect.poll(() => feedbackBodies.at(-1)).toMatchObject({ mark: "important" });
  await actions.click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Mark important" })).toBeChecked();
});

test("Inbox asks before a model sorts the mail, and Allow starts triage", async ({
  page,
}, testInfo) => {
  await signup(page, `inbox-consent-${Date.now()}@rakazo.test`, "password12", "Inbox Consent");
  await completeOnboarding(page);

  // Real: signup, the Gmail emulator and the mail list. Stubbed: the e2e stack's scripted runtime
  // has no usable model, so the consent status and grant, and the list's triage state, are
  // answered here the way the API answers once a model is connected.
  const recipient = { key: "recipient-key", name: "OpenRouter" };
  let allowed = false;
  let allowBody: unknown;
  let refreshes = 0;
  const consentStatus = () => ({
    scope: "scope-1",
    version: "2026-09-14",
    recipients: [{ ...recipient, use: "model", detail: "vendor/model", allowed }],
  });
  await page.route("**/rpc/aiConsent/status", (route) =>
    route.fulfill({ json: { json: consentStatus() } }),
  );
  await page.route("**/rpc/aiConsent/allow", (route) => {
    allowBody = (route.request().postDataJSON() as { json: unknown }).json;
    allowed = true;
    return route.fulfill({ json: { json: consentStatus() } });
  });
  await page.route("**/rpc/inbox/refresh", (route) => {
    refreshes += 1;
    return route.continue();
  });
  await page.route("**/rpc/inbox/list", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { json: Record<string, unknown> };
    await route.fulfill({
      response,
      json: {
        json: {
          ...body.json,
          enabled: allowed,
          triageBlocked: allowed ? null : { reason: "needs_consent", recipient },
          triagePending: false,
        },
      },
    });
  });
  await page.route("**/rpc/inbox/todos/list", (route) =>
    route.fulfill({
      json: {
        json: {
          enabled: allowed,
          todos: allowed
            ? [
                {
                  id: "t1",
                  connectionId: "c",
                  messageId: null,
                  text: "Sign the vendor agreement",
                  detail: null,
                  from: null,
                  priority: null,
                  dueOn: null,
                  doneAt: null,
                },
              ]
            : [],
        },
      },
    }),
  );

  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  const prompt = main.getByRole("region", { name: "Let OpenRouter sort your mail" });
  await expect(prompt).toBeVisible();
  await expect(main.getByRole("region", { name: "To do" })).toHaveCount(0);
  expect(allowBody).toBeUndefined();
  await captureScreenshot(page, testInfo, "inbox-consent-prompt");

  // Allow grants exactly the listed recipient, then syncs again so triage runs.
  const before = refreshes;
  await prompt.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(main.getByRole("region", { name: "To do" })).toBeVisible();
  await expect(prompt).toHaveCount(0);
  expect(allowBody).toEqual({ scope: "scope-1", version: "2026-09-14", keys: ["recipient-key"] });
  expect(refreshes).toBeGreaterThan(before);
});

test("Inbox offers no consent prompt while there is no model to allow", async ({ page }) => {
  await signup(page, `inbox-nomodel-${Date.now()}@rakazo.test`, "password12", "Inbox No Model");
  await completeOnboarding(page);

  // The list's reason is stubbed; the mail is the real emulated Gmail.
  await page.route("**/rpc/inbox/list", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { json: Record<string, unknown> };
    await route.fulfill({
      response,
      json: { json: { ...body.json, enabled: false, triageBlocked: { reason: "no_model" } } },
    });
  });

  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  await expect(main.getByRole("button", { name: "Allow", exact: true })).toHaveCount(0);
  await expect(main.getByRole("region", { name: "To do" })).toHaveCount(0);
});
