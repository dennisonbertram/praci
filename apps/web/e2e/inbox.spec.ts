import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

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
