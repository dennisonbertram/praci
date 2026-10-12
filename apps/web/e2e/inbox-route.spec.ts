import { expect, test } from "@playwright/test";
import { activeBotId, completeOnboarding, signup } from "./helpers";

test("/app/inbox stays on its own route with no bot thread, and bot routes are unchanged", async ({
  page,
}) => {
  await signup(page, `inbox-route-${Date.now()}@rakazo.test`, "password12", "Inbox Route");
  await completeOnboarding(page);
  const botId = activeBotId(page);
  const composer = page.getByRole("combobox", { name: /Message/ });
  await expect(composer).toBeVisible();

  await page.goto("/app/inbox");
  await expect(page.getByTestId("shell-root")).toHaveAttribute("data-ready", "true");
  expect(new URL(page.url()).pathname).toBe("/app/inbox");
  await expect(composer).toHaveCount(0);

  await page.goto(`/app/${botId}`);
  await expect(page.getByTestId("shell-root")).toHaveAttribute("data-ready", "true");
  expect(new URL(page.url()).pathname).toBe(`/app/${botId}`);
  await expect(composer).toBeVisible();
});
