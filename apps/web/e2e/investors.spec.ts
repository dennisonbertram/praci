import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Investors opens from the sidebar and the old Cap table address redirects", async ({
  page,
}, testInfo) => {
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

  await captureScreenshot(page, testInfo, "investors");

  await page.goto("/app/cap-table?kind=auditor");
  await expect(page).toHaveURL(/\/app\/investors\?kind=auditor$/);
});
