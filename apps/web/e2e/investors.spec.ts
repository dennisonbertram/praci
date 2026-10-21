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
  await expect(main.getByRole("button", { name: "Connect Carta" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Type it in" })).toBeVisible();
  // The panel opens only on Ask.
  await expect(page.getByTestId("investors-agent-panel")).toBeHidden();

  await captureScreenshot(page, testInfo, "investors");

  await page.goto("/app/cap-table?kind=auditor");
  await expect(page).toHaveURL(/\/app\/investors\?kind=auditor$/);
});

test("A founder without Carta types the cap table in and it is saved", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `investors-native-${Date.now()}@rakazo.test`, "password12", "Native User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Type it in" }).click();
  await expect(main.getByRole("button", { name: /^Typed in · as of/ })).toBeVisible();

  const holder = main.getByLabel("Holder").first();
  await holder.fill("Ada Founder");
  await main.getByLabel("Shares").first().fill("6000000");
  await main.getByLabel("Shares").first().blur();
  await expect(main.getByText("Saved", { exact: true })).toBeVisible();
  await main.getByLabel("Pool shares").fill("1000000");
  await main.getByLabel("Pool shares").blur();
  await expect(main.getByText("85.7%").first()).toBeVisible();
  await captureScreenshot(page, testInfo, "investors-native");

  await page.reload();
  await expect(main.getByLabel("Holder").first()).toHaveValue("Ada Founder");
  await expect(main.getByLabel("Shares").first()).toHaveValue("6,000,000");
});
