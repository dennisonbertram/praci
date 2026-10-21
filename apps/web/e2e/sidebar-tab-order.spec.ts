import { expect, test } from "@playwright/test";
import { completeOnboarding, signup } from "./helpers";

test("Tab walks the sidebar header to Create, and Settings gives focus back to the user menu", async ({
  page,
}) => {
  await signup(page, `tab-order-${Date.now()}@rakazo.test`, "password12", "Tab Order");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  // Opening and closing the Create menu used to leave focus guards behind that trapped Tab.
  await page.getByTestId("create-menu-trigger").click();
  await expect(page.getByTestId("bot-create-picker")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("bot-create-picker")).toHaveCount(0);

  await page.getByTestId("sidebar-search").locator("input").focus();
  let reached = 0;
  for (let press = 1; press <= 6 && !reached; press += 1) {
    await page.keyboard.press("Tab");
    const onCreate = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") === "create-menu-trigger",
    );
    if (onCreate) reached = press;
  }
  expect(reached).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Hide sidebar" })).toHaveCount(1);

  await page.getByTestId("user-menu-trigger").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("user-settings")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("user-settings")).toHaveCount(0);
  await expect(page.getByTestId("user-menu-trigger")).toBeFocused();
});
