import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Omi page shows Connect pendant before a pendant is paired", async ({ page }, testInfo) => {
  // Headless Chromium has no Bluetooth; a stub makes the page offer the connect button.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "bluetooth", {
      value: { requestDevice: () => Promise.reject(new DOMException("", "NotFoundError")) },
      configurable: true,
    });
  });
  await signup(page, `omi-${Date.now()}@rakazo.test`, "password12", "Omi");
  await completeOnboarding(page);
  await page.goto("/app/integrations/omi");
  await expect(page.getByRole("heading", { name: "Omi", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect pendant", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "omi-not-connected");
});
