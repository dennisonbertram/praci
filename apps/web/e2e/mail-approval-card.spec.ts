import { expect, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  connectTwoGmailAccounts,
  rpc,
  signup,
} from "./helpers";

test("a mail send waits in the chat as an editable card and approving it runs the edited call", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `mail-approval-${Date.now()}@rakazo.test`, "password12", "Mail Approval");
  await completeOnboarding(page);

  await page.goto("/app/inbox");
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  // Actions run without asking by default; the card appears once the person asks to review email.
  await rpc(page, "approvalRules/set", {
    effect: "require_approval",
    matchKind: "category",
    matchValue: "email",
  });
  await page.getByTestId("sidebar-inbox").click();
  const panel = page.getByTestId("side-panel");
  await page.getByRole("main").getByRole("button", { name: "Ask Inbox agent" }).click();
  await panel.getByRole("button", { name: "Create Inbox agent", exact: true }).click();

  await panel.getByPlaceholder(/Message/).fill("send email card");
  await page.keyboard.press("Enter");

  const card = page.getByTestId("mail-approval-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText("Needs approval", { exact: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Offsite dates" })).toBeVisible();
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
  // A finished card folds to its header; the chevron opens it again.
  const toggle = card.getByRole("button", { expanded: false });
  await expect(toggle).toBeVisible();
  await captureScreenshot(page, testInfo, "mail-approval-card-sent-collapsed");
  await toggle.click();
  await expect(card).toContainText("Offsite dates, confirmed");
  await expect(card.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "mail-approval-card-sent-expanded");
});
