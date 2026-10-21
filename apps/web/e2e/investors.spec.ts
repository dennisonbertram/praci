import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Investors lists contacts added through the dialog", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `investors-${Date.now()}@rakazo.test`, "password12", "Investors User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  await expect(page).toHaveURL(/\/app\/investors$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Investors", level: 1 })).toBeVisible();
  await expect(main.getByText("See who owns your company", { exact: false })).toBeVisible();
  await expect(main.getByRole("button", { name: "Connect Carta" })).toBeVisible();
  // Without Carta there is no agent, so no empty panel opens beside the page.
  await expect(page.getByTestId("carta-agent-panel")).toBeHidden();

  await main.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Ada Example");
  await dialog.getByLabel("Email").fill("ada@example.test");
  await dialog.getByLabel("Organization").fill("Example Ventures");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(main.getByRole("button", { name: "Ada Example" })).toBeVisible();
  await expect(main.getByRole("cell", { name: "ada@example.test" })).toBeVisible();
  await captureScreenshot(page, testInfo, "investors");

  await page.goto("/app/cap-table?kind=auditor");
  await expect(page).toHaveURL(/\/app\/investors\?kind=auditor$/);
});
