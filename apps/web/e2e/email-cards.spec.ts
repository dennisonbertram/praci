import { expect, test } from "@playwright/test";
import {
  allowInboxAgentMail,
  captureScreenshot,
  completeOnboarding,
  connectMailFromInbox,
  rpc,
  signup,
} from "./helpers";

test("the Inbox agent cites mail as urgency-grouped cards that open the message", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `email-cards-${Date.now()}@rakazo.test`, "password12", "Email Cards");
  await completeOnboarding(page);

  // The scripted runtime does not itself represent an AI data recipient. Give the E2E user an
  // explicit loopback-only OpenAI-compatible model identity so the consent fixture can grant the
  // same recipient the Inbox agent resolves, while the scripted runtime still supplies the reply.
  const consentModel = {
    provider: "openai-compatible",
    modelId: "rakazo-e2e-email-cards",
    baseUrl: "http://127.0.0.1:9/v1",
  };
  await rpc(page, "models/connect", {
    ...consentModel,
    apiKey: "fake-loopback-model-key",
  });
  await rpc(page, "models/setDefault", {
    provider: consentModel.provider,
    modelId: consentModel.modelId,
  });

  await page.goto("/app/inbox");
  await connectMailFromInbox(page);
  await page.getByTestId("sidebar-inbox").click();
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /Offsite dates/ })).toBeVisible();
  const skipTour = page.getByRole("button", { name: "Skip tour", exact: true });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
    await expect(skipTour).toBeHidden();
  }

  // The Inbox agent reads mail only with the AI data sharing consent the Inbox sorting needs.
  await allowInboxAgentMail(page);
  const panel = page.getByTestId("side-panel");
  await main.getByRole("button", { name: "Ask Inbox agent" }).click();
  const createAgent = panel.getByRole("button", { name: "Create Inbox agent", exact: true });
  if (await createAgent.isVisible().catch(() => false)) await createAgent.click();
  const composer = panel.getByPlaceholder(/Message/);
  await composer.fill(
    "show email cards e2e-a-1=today e2e-b-1=within_3_days e2e-a-2=this_week e2e-a-3=later e2e-a-4=later",
  );
  await page.keyboard.press("Enter");

  // One table row per email, most urgent first, with the attachment count.
  const cards = panel.getByTestId("email-cards");
  await expect(cards).toBeVisible({ timeout: 60_000 });
  await expect(cards.getByTestId("email-row")).toHaveCount(5);
  await expect(cards.getByTestId("email-row").first()).toContainText("Offsite dates");
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
  await cards.getByTestId("email-row").first().click();
  const dialog = page.getByRole("dialog");
  const messageTitle = dialog.getByRole("heading", { name: "Offsite dates", exact: true });
  await expect(messageTitle).toBeVisible();
  const body = dialog.locator("iframe").contentFrame().locator("#preview").contentFrame();
  await expect(body.locator("#probe")).toHaveText("Can you do the 14th or the 21st?");
  await captureScreenshot(page, testInfo, "email-cards-open-message");
  // The chevrons and j/k step through the cards in the order listed.
  const next = dialog.getByRole("button", { name: "Next message" });
  await expect(dialog.getByRole("button", { name: "Previous message" })).toBeDisabled();
  await next.click();
  await expect(dialog.getByRole("button", { name: "Previous message" })).toBeEnabled();
  await expect(messageTitle).toHaveCount(0);
  await page.keyboard.press("k");
  await expect(messageTitle).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(messageTitle).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/app/inbox");

  // The cards remain in the Inbox agent conversation, and a Later row opens too.
  await expect(cards).toBeVisible();
  await cards.getByTestId("email-row").filter({ hasText: "Weekend sale" }).click();
  await expect(page.getByRole("dialog").getByText("Everything is 20 percent off.")).toBeVisible();
});
