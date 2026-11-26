import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Scanner lists only scans and hides USB controls in a browser", async ({ page }, testInfo) => {
  const sources: unknown[] = [];
  await page.route("**/rpc/dataRoom/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/dataRoom/")[1];
    const input = route.request().postDataJSON()?.json ?? {};
    const answers: Record<string, unknown> = {
      folders: [],
      imports: [],
      facetValues: { types: [], sources: ["scan"], parties: [], hasDates: false },
      processing: { reading: 0, indexing: 0, tagging: 0, failed: 0, current: null },
      "items/list": { items: [], nextCursor: null },
    };
    if (name === "items/list") sources.push(input.source);
    if (!name || !(name in answers)) return route.continue();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  await signup(page, `scanner-${Date.now()}@rakazo.test`, "password12", "Scanner User");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-scanner").click();
  await expect(page.getByRole("heading", { name: "Scanner", exact: true })).toBeVisible();
  await expect(page.getByText("No scans yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scanner settings" })).toHaveCount(0);
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.every((source) => source === "scan")).toBe(true);
  await captureScreenshot(page, testInfo, "scanner-browser");
});
