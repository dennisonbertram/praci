import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Fundraising: add a prospect, start a round, commit, close and reopen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `fundraising-${Date.now()}@rakazo.test`, "password12", "Fundraising User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-fundraising").click();
  await expect(page).toHaveURL(/\/app\/fundraising$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Fundraising", level: 1 })).toBeVisible();
  // With no round the card only offers Start a round; Pipeline and SAFEs are already there.
  await expect(main.getByRole("button", { name: "Start a round" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "SAFEs" })).toBeVisible();

  // Add prospect works with no round.
  await main.getByRole("button", { name: "Add prospect" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Example Ventures");
  await dialog.getByLabel("Check size").fill("250000");
  await dialog.getByLabel("Next step").fill("Send the deck");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(main.getByText("Example Ventures")).toBeVisible();
  await expect(main.getByText("$250,000")).toBeVisible();

  // Start a round, then move the prospect to Committed: it counts as Pending.
  await main.getByRole("button", { name: "Start a round" }).click();
  const round = page.getByRole("dialog");
  await round.getByLabel("Name").fill("Seed");
  await round.getByLabel("Target").fill("2000000");
  await round.getByLabel("Post-money cap").fill("10000000");
  await round.getByRole("button", { name: "Start a round" }).click();
  await expect(main.getByRole("heading", { name: "Seed" })).toBeVisible();

  await main.getByRole("button", { name: "Actions for Example Ventures" }).click();
  await page.getByRole("menuitem", { name: "Move to" }).click();
  await page.getByRole("menuitem", { name: "Committed" }).click();
  await expect(main.getByText("Pending").locator("..")).toContainText("$250,000");
  await captureScreenshot(page, testInfo, "fundraising");

  // Send SAFE (no Mercury): the Draft takes the prospect out of the pipeline; the bar does not move.
  await main.getByRole("button", { name: "Send SAFE" }).click();
  const safe = page.getByRole("dialog");
  await expect(safe.getByLabel("Amount")).toHaveValue("250000");
  await safe.getByRole("button", { name: "Send SAFE" }).click();
  await expect(page.getByRole("link", { name: "YC documents ›" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Mark sent" }).click();
  const safes = main.getByRole("heading", { name: "SAFEs" }).locator("..");
  await expect(safes.getByText("Example Ventures")).toBeVisible();
  await expect(safes.getByText("Sent", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Send SAFE" })).toHaveCount(0);
  await expect(main.getByText("Pending").locator("..")).toContainText("$250,000");
  await captureScreenshot(page, testInfo, "fundraising-safe");

  // Close: the commitment counts nowhere. Reopen: it counts again.
  await main.getByRole("button", { name: "Round actions" }).click();
  await page.getByRole("menuitem", { name: "Close round" }).click();
  await expect(main.getByText(/^Closed /)).toBeVisible();
  await expect(main.getByText("Pending")).toHaveCount(0);
  await main.getByRole("button", { name: "Round actions" }).click();
  await page.getByRole("menuitem", { name: "Reopen" }).click();
  await expect(main.getByText("Pending").locator("..")).toContainText("$250,000");
});
