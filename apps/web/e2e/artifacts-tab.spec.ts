import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("opens Artifacts from the sidebar and lists created files", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `artifacts-tab-${stamp}@rakazo.test`, "password12", "Artifacts Tab");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/(?!artifacts(?:\/|$))[^/]+$/);
  const chiefId = activeBotId(page);

  await expect(page.getByTestId("app-rail")).toHaveCount(0);
  const sidebar = page.getByTestId("bots-sidebar");
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())?.x).toBe(0);
  await expect(sidebar.getByTestId("sidebar-integrations")).toBeVisible();
  // Artifacts sits with the other pages in the sidebar, not in the account menu.
  const artifactsItem = sidebar.getByTestId("sidebar-artifacts");
  await expect(artifactsItem).toBeVisible();
  await page.getByTestId("user-menu-trigger").click();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Artifacts", exact: true })).toHaveCount(1);
  await page.keyboard.press("Escape");

  await artifactsItem.click();
  await expect(artifactsItem).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\/app\/artifacts$/);
  await expect(page.getByRole("heading", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(page.getByText("No artifacts yet")).toBeVisible();
  // Artifacts opens inside the app, with the sidebar still there.
  await expect(sidebar).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-empty");

  await page.setViewportSize({ width: 360, height: 700 });
  const narrowHeading = page.getByRole("heading", { name: "Artifacts", exact: true });
  const narrowGridView = page.getByRole("button", { name: "Grid view" });
  await expect(narrowHeading).toBeVisible();
  await expect(narrowGridView).toBeVisible();
  const headingBox = await narrowHeading.boundingBox();
  const gridViewBox = await narrowGridView.boundingBox();
  expect(headingBox?.width).toBeGreaterThan(40);
  expect(headingBox?.x).toBeGreaterThanOrEqual(0);
  expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual(360);
  expect(gridViewBox?.x).toBeGreaterThanOrEqual(0);
  expect((gridViewBox?.x ?? 0) + (gridViewBox?.width ?? 0)).toBeLessThanOrEqual(360);
  await page.setViewportSize({ width: 1280, height: 720 });

  await rpc(page, "artifacts/create", {
    botId: chiefId,
    name: "notes/artifacts-tab.md",
    mimeType: "text/markdown",
    contentBase64: Buffer.from("# Artifacts tab").toString("base64"),
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.getByText("notes/artifacts-tab.md")).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-list");
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.getByTestId("artifact-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Grid view" }).click();

  await page.getByRole("link", { name: /notes\/artifacts-tab\.md/ }).click();
  await expect(page).toHaveURL(/\/app\/artifacts\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "notes/artifacts-tab.md" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Artifacts tab" })).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-preview");

  await sidebar.getByRole("button", { name: /^Chief/ }).click();
  await expect(page).toHaveURL(/\/app\/(?!artifacts(?:\/|$))[^/]+$/);
  await expect(page.getByTestId("transcript")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("app-rail")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileSidebar = page.getByTestId("bots-sidebar");
  await expect(mobileSidebar.getByTestId("sidebar-artifacts")).toBeVisible();
  await captureScreenshot(page, testInfo, "sidebar-artifacts-mobile");
});
