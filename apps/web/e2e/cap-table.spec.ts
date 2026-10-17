import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Cap Table lists contacts added through the dialog", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `cap-table-${Date.now()}@rakazo.test`, "password12", "Cap Table User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-cap-table").click();
  await expect(page).toHaveURL(/\/app\/cap-table$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Cap table", level: 1 })).toBeVisible();
  await expect(main.getByRole("button", { name: "Connect Carta" })).toBeVisible();
  // Without Carta there is no Carta agent, so no empty side panel covers the page.
  await expect(page.getByTestId("carta-agent-panel")).toHaveCount(0);

  await main.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Ada Example");
  await dialog.getByLabel("Email").fill("ada@example.test");
  await dialog.getByLabel("Organization").fill("Example Ventures");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(main.getByRole("button", { name: "Ada Example" })).toBeVisible();
  await expect(main.getByText("ada@example.test")).toBeVisible();
  await captureScreenshot(page, testInfo, "cap-table");
});
