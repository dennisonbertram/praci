import { expect, test } from "@playwright/test";
import { completeOnboarding, signup } from "./helpers";

// The sidebar's rows (pages, folders, chats) are one Tab stop (plus the first page row);
// Up, Down, Home and End move between rows. Main defines no Escape behavior for the sidebar.
test("sidebar rows are one tab stop and arrows move through them, folder headers included", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signup(page, `keys-${Date.now()}@rakazo.test`, "password12", "Keys User");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  const sidebar = page.locator("aside").first();
  const chief = sidebar.getByRole("button", { name: /^Chief/ });
  await chief.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to", exact: true }).hover();
  await page.getByRole("menu", { name: "Move to", exact: true }).getByText("New folder").click();
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByLabel("Name").fill("Projects");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(sidebar.locator('[data-sidebar-group^="section:"]')).toContainText("Projects");

  const rows = sidebar.locator("[data-roster-row]");
  // The first row and the current stop are tabbable; every other row is not.
  await expect
    .poll(() => sidebar.locator("[data-roster-row][tabindex='0']").count())
    .toBeLessThanOrEqual(2);

  await expect(sidebar.locator('[data-roster-row^="folder:"]')).toBeVisible();
  await rows.first().focus();
  const count = await rows.count();
  let sawHead = false;
  for (let i = 1; i < count; i++) {
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(i)).toBeFocused();
    sawHead ||= await rows
      .nth(i)
      .evaluate((el) => el.dataset.rosterRow?.startsWith("folder:") === true);
  }
  expect(sawHead, "ArrowDown reaches the folder header").toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect(rows.nth(count - 2)).toBeFocused();
  await page.keyboard.press("End");
  await expect(rows.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(rows.first()).toBeFocused();
  await expect(sidebar.locator("[data-roster-row][tabindex='0']")).toHaveCount(1);
});
