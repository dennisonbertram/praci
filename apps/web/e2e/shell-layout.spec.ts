import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { completeOnboarding, openUserSettings, signup } from "./helpers";

// VIS-01: the sidebar docks from 1024px and the right panel from 1280px. Below that they overlay,
// so chat never shrinks to a sliver.
async function boot(page: Page, width: number, height = 1024) {
  await page.setViewportSize({ width, height });
  await signup(page, `shell-layout-${Date.now()}@rakazo.test`, "password12", "Shell Layout");
  await completeOnboarding(page);
}

const openComputer = (page: Page) => page.getByTitle(/^(Computer and )?routines$/i).click();
const widthOf = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())!.width;

test("768px keeps chat wide with the panel open; sidebar and panel overlay", async ({ page }) => {
  await boot(page, 768);
  await openComputer(page);
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "computer");
  await expect(page.getByTestId("side-panel")).toHaveCSS("position", "absolute");
  await expect(page.getByTestId("bots-sidebar")).toHaveCSS("position", "absolute");
  expect(await widthOf(page, "main#main-content")).toBeGreaterThanOrEqual(480);
  expect(await widthOf(page, "main#main-content")).toBeGreaterThan(760);
  await page.setViewportSize({ width: 1023, height: 1024 });
  await expect(page.getByTestId("bots-sidebar")).toHaveCSS("position", "absolute");
  await expect(page.getByTestId("side-panel")).toHaveCSS("position", "absolute");
});

test("1280px docks sidebar and panel; End on the handle keeps chat at 480px", async ({ page }) => {
  await boot(page, 1280, 900);
  await openComputer(page);
  await expect(page.getByTestId("side-panel")).toHaveCSS("position", "relative");
  await expect(page.getByTestId("bots-sidebar")).toHaveCSS("position", "static");
  await page.setViewportSize({ width: 1440, height: 900 });
  const separator = page.getByRole("separator", { name: "Resize panel" });
  await separator.focus();
  await page.keyboard.press("End");
  const max = Number(await separator.getAttribute("aria-valuemax"));
  // The panel animates its width; wait until it reaches the maximum before measuring chat.
  await expect
    .poll(async () => Math.round(await widthOf(page, '[data-testid="side-panel"]')))
    .toBe(max);
  expect(max).toBeGreaterThan(384);
  expect(await widthOf(page, "main#main-content")).toBeGreaterThanOrEqual(480);
});

test("a saved panel is not restored open below 1280px and its width is clamped", async ({
  page,
}) => {
  await boot(page, 1440, 900);
  await openComputer(page);
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "computer");
  await page.evaluate(() => localStorage.setItem("rakazo:right-panel-width", "1000"));
  await page.reload();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "computer");
  await expect
    .poll(async () => Math.round((await page.getByTestId("side-panel").boundingBox())!.width))
    .toBeLessThanOrEqual(644);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => localStorage.setItem("rakazo:right-panel-width", "900"));
  await page.reload();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
  await openComputer(page);
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "computer");
  expect(await widthOf(page, '[data-testid="side-panel"]')).toBeLessThanOrEqual(384);
});

test("Models stacks below 1040px and splits into two columns from 1040px", async ({ page }) => {
  await boot(page, 1280, 900); // the user menu lives in the docked sidebar
  await openUserSettings(page, "models");
  const dialog = page.getByTestId("model-settings");
  await expect(dialog).toBeVisible();
  const stacked = async () => {
    const list = (await dialog.getByPlaceholder("Search providers").boundingBox())!;
    const detail = (await page.getByTestId("model-detail").boundingBox())!;
    return detail.y >= list.y + list.height - 1;
  };
  // Decision said 900px, but the 200px settings nav leaves only 270px for the detail pane there.
  for (const width of [375, 768, 900]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await stacked()).toBe(true);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `no horizontal overflow at ${width}`,
    ).toBe(true);
  }
  for (const width of [1040, 1080]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await stacked()).toBe(false);
    expect(await widthOf(page, '[data-testid="model-detail"]')).toBeGreaterThanOrEqual(400);
  }
});

test("768px has no horizontal page overflow in the app areas", async ({ page }) => {
  await boot(page, 768);
  for (const path of [
    "/app",
    "/app/artifacts",
    "/app/inbox",
    "/app/integrations",
    "/app/finance",
    "/app/legal",
    "/app/data-room",
    "/app/investors",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("shell-root")).toHaveAttribute("data-ready", "true");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `pageOverflowX at ${path}`).toBeLessThanOrEqual(0);
  }
});
