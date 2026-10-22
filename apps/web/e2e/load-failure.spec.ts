import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("a failed Integrations chunk keeps the shell, and a reload loads it", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `integrations-load-${stamp}@rakazo.test`, "password12", "Integrations Load");
  await completeOnboarding(page);

  const integrationsChunk = /\/pages\/Integrations\.tsx/;
  await page.route(integrationsChunk, (route) => route.fulfill({ status: 404 }));
  await page.getByTestId("sidebar-integrations").click();

  await expect(page.getByText("Could not load", { exact: true })).toBeVisible();
  await expect(page.getByTestId("sidebar-integrations")).toBeVisible();
  await captureScreenshot(page, testInfo, "integrations-load-failed");

  await page.unroute(integrationsChunk);
  await page.reload();
  await expect(page.getByPlaceholder("Search integrations")).toBeVisible();
});

test("a failed page chunk shows Refresh instead of a blank app", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `page-load-${stamp}@rakazo.test`, "password12", "Page Load");
  await completeOnboarding(page);

  // Artifacts opens inside the shell and keeps it on failure (see the Integrations test),
  // so use a page that renders outside the shell to reach the app-level Refresh fallback.
  const pageChunk = /\/pages\/Onboarding\.tsx/;
  await page.route(pageChunk, (route) => route.fulfill({ status: 404 }));
  await page.goto("/onboarding");

  await expect(page.getByText("Something went wrong. Try again.", { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "page-load-failed");

  await page.unroute(pageChunk);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator('[data-rakazo-app-state="ready"]')).toBeVisible();
  await expect(page.getByText("Something went wrong. Try again.", { exact: true })).toHaveCount(0);
});

for (const [failing, intact] of [
  ["ScratchpadSection", "bot-knowledge"],
  ["KnowledgeSection", "bot-scratchpad"],
] as const) {
  test(`a failed ${failing} chunk keeps the rest of the bot settings panel`, async ({ page }) => {
    const stamp = Date.now();
    await signup(page, `section-load-${stamp}@rakazo.test`, "password12", "Section Load");
    await completeOnboarding(page);

    const composer = page.getByRole("combobox", { name: "Message Chief" });
    await composer.fill("Keep this draft");

    await page.route(new RegExp(`/pages/${failing}\\.tsx`), (route) =>
      route.fulfill({ status: 404 }),
    );
    await page
      .locator("main")
      .getByRole("button", { name: /^Chief/ })
      .click();

    const settings = page.getByTestId("bot-settings");
    await settings.getByText("Advanced", { exact: true }).click();
    await expect(settings.getByText("Could not load", { exact: true })).toBeVisible();
    await expect(settings.getByTestId(intact)).toBeVisible();
    await expect(settings.getByText("Advanced", { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("Keep this draft");
  });
}
