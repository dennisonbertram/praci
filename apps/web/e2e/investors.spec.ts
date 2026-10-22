import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Investors opens from the sidebar and the old Cap table address redirects", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `investors-${Date.now()}@rakazo.test`, "password12", "Investors User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  await expect(page).toHaveURL(/\/app\/investors$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Investors", level: 1 })).toBeVisible();
  await expect(main.getByRole("button", { name: "Connect Carta" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Type it in" })).toBeVisible();
  // The panel opens only on Ask.
  await expect(page.getByTestId("investors-agent-panel")).toBeHidden();

  await captureScreenshot(page, testInfo, "investors-empty");

  await page.goto("/app/cap-table?kind=auditor");
  await expect(page).toHaveURL(/\/app\/investors\?kind=auditor$/);
});

test("A founder without Carta types the cap table in and it is saved", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `investors-native-${Date.now()}@rakazo.test`, "password12", "Native User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Type it in" }).click();
  await expect(main.getByRole("button", { name: /^Typed in · as of/ })).toBeVisible();
  await captureScreenshot(page, testInfo, "investors-typed-empty");

  const holder = main.getByLabel("Holder").first();
  await holder.fill("Ada Founder");
  await main.getByLabel("Shares").first().fill("6000000");
  await main.getByLabel("Shares").first().blur();
  await expect(main.getByText("Saved", { exact: true })).toBeVisible();
  await main.getByLabel("Pool shares").fill("1000000");
  await main.getByLabel("Pool shares").blur();
  await expect(main.getByText("85.7%").first()).toBeVisible();
  await captureScreenshot(page, testInfo, "investors-native");

  await page.reload();
  await expect(main.getByLabel("Holder").first()).toHaveValue("Ada Founder");
  await expect(main.getByLabel("Shares").first()).toHaveValue("6,000,000");
});

test("Audit requests wait in Action items, are closed from the row menu and reach Show done", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const audit = (over: Record<string, unknown>) => ({
    id: "a1",
    fund: "Example Audit LLP",
    asOf: "2026-09-30",
    asOfMatched: true,
    dueDate: "2026-11-15",
    status: "open",
    mailThreadId: "t1",
    connectionId: "k1",
    draftRef: null,
    senderKnown: false,
    notes: "",
    dataRoomItemId: null,
    drafting: false,
    newMail: false,
    createdAt: "2026-10-20T10:00:00.000Z",
    ...over,
  });
  const rows = [
    audit({}),
    audit({
      id: "a2",
      fund: "Sample Ventures Fund II",
      dueDate: "2026-11-30",
      status: "drafted",
      senderKnown: true,
      asOfMatched: false,
    }),
  ];
  const closed: unknown[] = [];
  await page.route("**/rpc/investors/audits/list", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: rows, meta: [] }),
    }),
  );
  await page.route("**/rpc/investors/audits/update", (route) => {
    const input = (route.request().postDataJSON() as { json: { id: string; status: string } }).json;
    closed.push(input);
    const row = rows.find((r) => r.id === input.id);
    if (row) row.status = input.status;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: row, meta: [] }),
    });
  });
  await signup(page, `audits-${Date.now()}@rakazo.test`, "password12", "Audits User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  const main = page.getByRole("main");
  const items = main.getByRole("region", { name: "Action items" });
  await expect(items.getByText("Audit request · Example Audit LLP")).toBeVisible();
  await expect(items.getByText("Sender not in Auditors")).toBeVisible();
  await expect(items.getByText("Holdings as of today, not Sep 30")).toBeVisible();
  await expect(items.getByText("Draft ready")).toBeVisible();
  await expect(items.getByRole("button", { name: "Draft reply" })).toHaveCount(1);
  await captureScreenshot(page, testInfo, "investors-audits");

  await items.getByRole("button", { name: "Actions for Example Audit LLP" }).click();
  await page.getByRole("menuitem", { name: "Mark done" }).click();
  await expect.poll(() => closed).toEqual([{ id: "a1", status: "done" }]);
  await expect(items.getByText("Audit request · Example Audit LLP")).toHaveCount(0);
  await main.getByRole("button", { name: "Show done" }).click();
  await expect(items.getByText("Audit request · Example Audit LLP")).toBeVisible();
});
