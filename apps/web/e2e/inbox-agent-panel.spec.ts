import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("the Inbox agent chats in a collapsible side panel on /app/inbox", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `inbox-agent-${Date.now()}@rakazo.test`, "password12", "Inbox Agent");
  await completeOnboarding(page);

  // The URL stays on /app/inbox and the panel offers the only creation path.
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/app/inbox");
  const panel = page.getByTestId("side-panel");
  await panel.getByRole("button", { name: "Create Inbox agent", exact: true }).click();
  const composer = panel.getByPlaceholder(/Message/);
  await expect(composer).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/app/inbox");
  // It joins the roster, but the Inbox row, not the agent, is the current page.
  const rosterRow = page.locator("[data-roster-bot-id]").filter({ hasText: "Inbox agent" });
  await expect(rosterRow).toBeVisible();
  await expect(rosterRow).not.toHaveAttribute("aria-current", "page");

  // The chat is the ordinary bot chat.
  await composer.fill("write a file in your home called notes/result.txt that says isolation-ok");
  await page.keyboard.press("Enter");
  await expect(panel.getByText(/writing that into my home|handled/i).first()).toBeVisible({
    timeout: 30_000,
  });
  await captureScreenshot(page, testInfo, "inbox-agent-panel-open");

  // Collapse, reload, still collapsed, then reopen from the Inbox page.
  await panel.getByRole("button", { name: "Collapse Inbox agent", exact: true }).click();
  await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBe(0);
  const show = page.getByRole("main").getByRole("button", { name: "Show Inbox agent" });
  await expect(show).toBeVisible();
  await captureScreenshot(page, testInfo, "inbox-agent-panel-collapsed");
  await page.reload();
  await expect(show).toBeVisible();
  expect((await panel.boundingBox())?.width ?? 0).toBe(0);
  await show.click();
  await expect(panel.getByPlaceholder(/Message/)).toBeVisible();
  await expect(show).toHaveCount(0);

  // Resizing works and the width survives a reload.
  const separator = page.getByRole("separator", { name: "Resize panel" });
  const handle = (await separator.boundingBox())!;
  await page.mouse.move(handle.x + 3, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x - 200, handle.y + 100, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(550);
  const width = Math.round((await panel.boundingBox())!.width);
  await page.reload();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(width);

  // Opening the agent from the roster shows the same thread as a regular bot page.
  await rosterRow.click();
  await expect(page).toHaveURL(/\/app\/(?!inbox$)[^/?]+$/);
  await expect(page.getByText(/writing that into my home|handled/i).first()).toBeVisible();
});
