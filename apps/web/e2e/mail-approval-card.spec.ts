import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

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

test("a mail send waits in the chat as an editable card and approving it runs the edited call", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `mail-approval-${Date.now()}@rakazo.test`, "password12", "Mail Approval");
  await completeOnboarding(page);

  await page.goto("/app/inbox");
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByRole("button", { name: "Close integrations" }).click();
  await page.getByTestId("side-panel").getByRole("button", { name: "Create Inbox agent" }).click();
  await page.locator("[data-roster-bot-id]").filter({ hasText: "Inbox agent" }).click();
  await expect(page).toHaveURL(/\/app\/(?!inbox$)[^/?]+$/);

  await page.getByPlaceholder(/Message/).fill("send email card");
  await page.keyboard.press("Enter");

  const card = page.getByTestId("mail-approval-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByRole("heading", { name: "New email" })).toBeVisible();
  await expect(card).toContainText("first@example.test");
  await expect(card).toContainText("Sam Rivera <sam@example.test>");
  await expect(card).toContainText("Offsite dates");
  await expect(card).toContainText("The 14th works for us.");
  await captureScreenshot(page, testInfo, "mail-approval-card");

  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(card).toHaveAttribute("data-editing", "true");
  await card.getByLabel("Subject").fill("Offsite dates, confirmed");
  await captureScreenshot(page, testInfo, "mail-approval-card-editing");

  await card.getByRole("button", { name: "Send", exact: true }).click();
  await expect(card.getByText("Sent", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Offsite dates, confirmed");
  await expect(card.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "mail-approval-card-approved");
});
