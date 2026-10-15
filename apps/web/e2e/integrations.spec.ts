import { expect, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  finishConnectDialog,
  openIntegrations,
  signup,
} from "./helpers";

test("Integrations page: filter apps, connect Gmail, manage it on its detail page", async ({
  page,
}, testInfo) => {
  await signup(page, `integrations-${Date.now()}@rakazo.test`, "password12", "Integrations");
  await completeOnboarding(page);
  await openIntegrations(page);

  // Home: popular apps, Finance quick picks and the custom connection card.
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toBeVisible();
  await expect(page.getByTestId("finance-tile-mercury")).toBeVisible();
  await expect(page.getByTestId("finance-tile-brex")).toBeVisible();
  await expect(page.getByText("Add a custom connection", { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-home");

  // Category chips filter the grid; the search box narrows it further.
  await page
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Finance", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect Mercury", exact: true })).toBeVisible();
  // No empty Apps or Popular heading above the Finance section.
  await expect(page.getByText("Popular", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Apps", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByPlaceholder("Search apps").fill("zzz-no-such-app");
  await expect(page.getByTestId("no-apps")).toBeVisible();
  await page.getByPlaceholder("Search apps").fill("");

  // Connect dialog: sign-in, which agents, done.
  await page.getByRole("button", { name: "Connect Gmail", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Which agents can use Gmail?")).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-connect-agents");
  await finishConnectDialog(page, "Gmail");
  await expect(page.getByText("Connected", { exact: true }).first()).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-connected");

  // Detail page: accounts, agent access, tools grouped by read and write.
  await page.getByRole("link", { name: "Gmail", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gmail", level: 1 })).toBeVisible();
  await expect(page.getByTestId("tools-read")).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-app-detail");

  // Escape cancels an inline rename and nothing else.
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Account name").press("Escape");
  await expect(page.getByLabel("Account name")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gmail", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Disconnect Gmail", exact: true }).click();
  await captureScreenshot(page, testInfo, "integrations-disconnect-confirm");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect Gmail", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/integrations$/);
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toBeVisible();
});

test("Integrations page: the custom connection dialog has no finance quick picks", async ({
  page,
}, testInfo) => {
  await signup(page, `integrations-custom-${Date.now()}@rakazo.test`, "password12", "Custom");
  await completeOnboarding(page);
  await openIntegrations(page);

  await page.getByRole("button", { name: "Add custom connection", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Mercury", exact: true })).toHaveCount(0);
  await dialog.getByText("Advanced", { exact: true }).click();
  await expect(dialog.getByRole("button", { name: "OpenAPI", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-custom-dialog");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("Integrations page fits a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page, `integrations-phone-${Date.now()}@rakazo.test`, "password12", "Phone");
  await completeOnboarding(page);
  await page.goto("/app/integrations");
  await expect(page.getByRole("heading", { name: "Integrations", level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await captureScreenshot(page, testInfo, "integrations-phone");
});
