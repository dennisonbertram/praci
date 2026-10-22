import { expect, test } from "@playwright/test";
import { page as gtmPage, overview } from "../src/pages/gtm/fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("GTM opens its plan and docked agent on desktop and phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/rpc/gtm/overview", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: overview, meta: [] }),
    }),
  );
  await page.route("**/rpc/pages/get", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: gtmPage, meta: [] }),
    }),
  );
  await signup(page, `gtm-${Date.now()}@rakazo.test`, "password12", "GTM Demo");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-gtm").click();
  await expect(page).toHaveURL(/\/app\/gtm$/);
  await expect(page.getByRole("heading", { name: "GTM", exact: true })).toBeVisible();
  await expect(page.getByTestId("gtm-agent-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Needs you/ })).toBeVisible();
  await expect(page.getByText("Find our first 50 design partners")).toBeVisible();
  await captureScreenshot(page, testInfo, "gtm-plan-desktop");
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.getByRole("button", { name: "Ask GTM agent" })).toBeVisible();
  await expect(page.getByTestId("gtm-agent-panel")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await captureScreenshot(page, testInfo, "gtm-plan-phone");
});
