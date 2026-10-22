import { expect, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  createBotFromPicker,
  openNewBot,
  rpc,
  signup,
} from "./helpers";

test("create opens a greeted chat; picker lists bots; sidebar collapses", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `new-bot-ux-${stamp}@rakazo.test`, "password12", "New Bot UX");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await page.getByTestId("create-menu-trigger").click();
  const picker = page.getByTestId("bot-create-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId("create-new-bot")).toBeVisible();
  await expect(picker.getByText("Chief", { exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "plus-picker-bots");

  await picker.getByTestId("create-new-bot").click();
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(page.getByTestId("create-bot-form")).toHaveCount(0);
  await expect(page.getByTestId("message-bot-bubble").getByText(/I'm a blank slate/)).toBeVisible();
  // Settings open with the name selected, so the new bot is named first.
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
  await expect(page.getByText("What should I work on first?", { exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "create-chat-name-focused");

  await page.getByTestId("minimize-bots-sidebar").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "true");
  const edge = page.getByTestId("bots-sidebar-edge");
  await expect(edge).toBeVisible();
  const restore = page.getByTestId("restore-bots-sidebar");
  await expect(restore).toBeVisible();
  await captureScreenshot(page, testInfo, "bots-sidebar-collapsed");

  await restore.click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "false");
  await expect(restore).toHaveCount(0);

  await page.getByTestId("minimize-bots-sidebar").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "true");

  const box = await edge.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "false");
  await captureScreenshot(page, testInfo, "bots-sidebar-expanded");

  // The tour card is as wide as the sidebar, so the tour expands a collapsed rail.
  await page.getByTestId("minimize-bots-sidebar").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "true");
  await page.getByTestId("user-menu-trigger").click();
  await page.getByTestId("take-tour").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "false");
});

test("picker rows explain groups and spaces", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `picker-info-${stamp}@rakazo.test`, "password12", "Picker Info");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await page.getByTestId("create-menu-trigger").click();
  const picker = page.getByTestId("bot-create-picker");
  await expect(picker).toBeVisible();

  await picker.getByTestId("create-new-group").hover();
  const groupInfo = picker.getByTestId("picker-info-group");
  await expect.poll(() => groupInfo.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await captureScreenshot(page, testInfo, "picker-group-info-hover");
  await groupInfo.click();
  const dialog = page.getByTestId("picker-info-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Groups", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("same thread");
  await expect(page.getByTestId("side-panel")).not.toHaveAttribute("data-panel", "create-group");
  await captureScreenshot(page, testInfo, "picker-group-info-dialog");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.getByTestId("create-menu-trigger").click();
  const spaceInfo = picker.getByTestId("picker-info-space");
  await expect.poll(() => spaceInfo.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await picker.getByTestId("create-new-space").hover();
  await expect.poll(() => spaceInfo.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await spaceInfo.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Spaces", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("own bots and groups");
  await captureScreenshot(page, testInfo, "picker-space-info-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("plus picker can create a Private computer bot", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `new-bot-private-${stamp}@rakazo.test`, "password12", "New Bot Private");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await createBotFromPicker(page, { computerMode: "dedicated" });
  await captureScreenshot(page, testInfo, "create-private-computer-bot");

  const botId = page.url().split("/").pop()!;
  const bots = await rpc<Array<{ id: string; computerMode: string }>>(page, "bots/list", {});
  expect(bots.find((bot) => bot.id === botId)?.computerMode).toBe("dedicated");
});

test("second bot from plus is created immediately with a greeting", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `second-bot-${stamp}@rakazo.test`, "password12", "Second Bot");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  const create = page.waitForResponse(
    (response) => response.url().includes("/rpc/bots/create") && response.ok(),
  );
  await openNewBot(page);
  await create;
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(
    page.getByTestId("message-bot-bubble").getByText(/Hi Second\. I'm a blank slate/),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "second-bot-created");
});
