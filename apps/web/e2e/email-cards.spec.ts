import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Connects the two seeded Gmail accounts from the Integrations overlay that "Connect mail" opened. */
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
}

test("the Inbox agent cites mail as urgency-grouped cards that open the message", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `email-cards-${Date.now()}@rakazo.test`, "password12", "Email Cards");
  await completeOnboarding(page);

  await page.goto("/app/inbox");
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();

  const panel = page.getByTestId("side-panel");
  await panel.getByRole("button", { name: "Create Inbox agent", exact: true }).click();
  const composer = panel.getByPlaceholder(/Message/);
  await composer.fill(
    "show email cards e2e-a-1=today e2e-b-1=within_3_days e2e-a-2=this_week e2e-a-3=later e2e-a-4=later",
  );
  await page.keyboard.press("Enter");

  // Urgent mail is a card; Later is a compact row list with the attachment count.
  const cards = panel.getByTestId("email-cards");
  await expect(cards).toBeVisible({ timeout: 60_000 });
  await expect(cards.getByRole("heading")).toHaveText([
    "Today",
    "Within 3 days",
    "This week",
    "Later",
  ]);
  await expect(cards.getByTestId("email-card")).toHaveCount(3);
  await expect(cards.getByTestId("email-row")).toHaveCount(2);
  await expect(cards.getByTestId("email-card").first()).toContainText("Offsite dates");
  const attached = cards.getByTestId("email-row").filter({ hasText: "Q3 report" });
  await expect(attached.getByLabel("1 attachment")).toBeVisible();
  await expect(
    cards.getByTestId("email-row").filter({ hasText: "Weekend sale" }),
  ).not.toContainText("attachment");
  await captureScreenshot(page, testInfo, "email-cards-in-chat");

  // Clicking a card opens the message in place, without leaving the Inbox.
  await cards.getByTestId("email-card").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Offsite dates")).toBeVisible();
  const body = dialog.locator("iframe").contentFrame().locator("#preview").contentFrame();
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  await captureScreenshot(page, testInfo, "email-cards-open-message");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/app/inbox");

  // The same cards render in the ordinary bot chat, and a Later row opens too.
  await page.locator("[data-roster-bot-id]").filter({ hasText: "Inbox agent" }).click();
  await expect(page).toHaveURL(/\/app\/(?!inbox$)[^/?]+$/);
  const chatCards = page.getByTestId("email-cards");
  await expect(chatCards).toBeVisible();
  await chatCards.getByTestId("email-row").filter({ hasText: "Weekend sale" }).click();
  await expect(page.getByRole("dialog").getByText("Everything is 20 percent off.")).toBeVisible();
});
