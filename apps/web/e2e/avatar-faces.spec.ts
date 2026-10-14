import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { AVATAR_MOODS } from "@rakazo/core";
import { captureScreenshot } from "./helpers";

const FIXTURE = "/e2e/fixtures/avatar-faces.html";

/** `d` and `transform` of every eye path in avatars showing the idle mood. */
async function idleEyes(page: Page) {
  return page
    .locator('[data-mood="idle"] path[transform][d]')
    .evaluateAll((paths) =>
      paths
        .filter((path) => path.closest("[data-mood]")?.querySelector("path") !== null)
        .map((path) => `${path.getAttribute("d")}|${path.getAttribute("transform")}`),
    );
}

test("every mood renders on every avatar variant", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${FIXTURE}?t=1500`);
  for (const mood of AVATAR_MOODS) {
    await expect(page.locator(`[data-mood="${mood}"]`).first()).toBeVisible();
    // 2 robot + 6 organic + 8 shape rows, plus the size row for idle.
    await expect(page.locator(`[data-mood="${mood}"]`)).toHaveCount(mood === "idle" ? 16 + 8 : 16);
  }
  await captureScreenshot(page, testInfo, "avatar-faces-gallery");
});

test("eyes move and blink over time", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(FIXTURE);
  await expect(page.locator('[data-mood="idle"]').first()).toBeVisible();
  const first = await idleEyes(page);
  await page.waitForTimeout(600);
  const second = await idleEyes(page);
  expect(first.length).toBeGreaterThan(0);
  expect(second).not.toEqual(first);
});

test("eyes stay still with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(FIXTURE);
  await expect(page.locator('[data-mood="idle"]').first()).toBeVisible();
  const first = await idleEyes(page);
  await page.waitForTimeout(600);
  expect(await idleEyes(page)).toEqual(first);
  expect(first.length).toBeGreaterThan(0);
});
