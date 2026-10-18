import { expect, test } from "@playwright/test";
import {
  allowInboxAgentMail,
  captureScreenshot,
  completeOnboarding,
  connectMailFromInbox,
  signup,
} from "./helpers";

test("the Inbox agent cites mail as urgency-grouped cards that open the message", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `email-cards-${Date.now()}@rakazo.test`, "password12", "Email Cards");
  await completeOnboarding(page);

  await page.goto("/app/inbox");
  await connectMailFromInbox(page);
  await page.getByTestId("sidebar-inbox").click();
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();

  // The Inbox agent reads mail only with the AI data sharing consent the Inbox sorting needs.
  await allowInboxAgentMail(page);
  const panel = page.getByTestId("side-panel");
  await main.getByRole("button", { name: "Ask Inbox agent" }).click();
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
    "No rush",
  ]);
  await expect(cards.getByTestId("email-card")).toHaveCount(3);
  await expect(cards.getByTestId("email-row")).toHaveCount(2);
  await expect(cards.getByTestId("email-card").first()).toContainText("Offsite dates");
  const attached = cards.getByTestId("email-row").filter({ hasText: "Q3 report" });
  await expect(attached.getByLabel("Attachments: 2")).toBeVisible();
  await expect(
    cards
      .getByTestId("email-row")
      .filter({ hasText: "Weekend sale" })
      .getByLabel(/Attachments/),
  ).toHaveCount(0);
  await captureScreenshot(page, testInfo, "email-cards-in-chat");

  // Clicking a card opens the message in place, without leaving the Inbox.
  await cards.getByTestId("email-card").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Offsite dates")).toBeVisible();
  const body = dialog.locator("iframe").contentFrame().locator("#preview").contentFrame();
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  await captureScreenshot(page, testInfo, "email-cards-open-message");
  // The chevrons and j/k step through the cards in the order listed.
  const next = dialog.getByRole("button", { name: "Next message" });
  await expect(dialog.getByRole("button", { name: "Previous message" })).toBeDisabled();
  await next.click();
  await expect(dialog.getByRole("button", { name: "Previous message" })).toBeEnabled();
  await expect(dialog.getByText("Offsite dates")).toHaveCount(0);
  await page.keyboard.press("k");
  await expect(dialog.getByText("Offsite dates")).toBeVisible();
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
