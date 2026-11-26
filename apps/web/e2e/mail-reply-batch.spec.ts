import { expect, test } from "@playwright/test";
import {
  allowInboxAgentMail,
  captureScreenshot,
  completeOnboarding,
  connectMailFromInbox,
  signup,
} from "./helpers";

test("a reply batch waits on one card, and only the ticked replies go out", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `mail-batch-${Date.now()}@rakazo.test`, "password12", "Mail Batch");
  await completeOnboarding(page);
  await page.goto("/app/inbox");
  await connectMailFromInbox(page);
  await allowInboxAgentMail(page);
  await page.getByTestId("sidebar-inbox").click();
  const panel = page.getByTestId("side-panel");
  await page.getByRole("main").getByRole("button", { name: "Ask Inbox agent" }).click();
  await panel.getByRole("button", { name: "Create Inbox agent", exact: true }).click();

  await panel
    .getByPlaceholder(/Message/)
    .fill("reply batch card to e2e-a-1,e2e-a-2,e2e-a-3 from first@example.test");
  await page.keyboard.press("Enter");

  const card = page.getByTestId("mail-reply-batch-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText("3 replies");
  await expect(card).toContainText("customer@example.test");
  await captureScreenshot(page, testInfo, "mail-reply-batch-card");

  // The fixed test address took no part in these threads, so every row starts unticked.
  await expect(card.getByRole("button", { name: /Send selected \(0\)/ })).toBeDisabled();
  await card.getByRole("checkbox").first().click();
  await card.getByRole("button", { name: /Send selected \(1\)/ }).click();
  await expect(card).toContainText("1 sent", { timeout: 30_000 });
  await expect(card).toContainText("Skipped");
  await captureScreenshot(page, testInfo, "mail-reply-batch-card-sent");
});
