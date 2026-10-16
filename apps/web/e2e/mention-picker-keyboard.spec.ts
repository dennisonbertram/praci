import { expect, type Page, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  createNamedBot,
  openNewGroup,
  rpc,
  signup,
} from "./helpers";

async function createBot(page: Page, name: string) {
  return createNamedBot(page, name);
}

test("mention picker completes with Enter and Tab", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `mention-keys-${stamp}@rakazo.test`, "password12", "Mention Keys");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  const researcherId = await createBot(page, "Researcher");
  const writerId = await createBot(page, "Research Writer");
  expect(researcherId).toBeTruthy();
  expect(writerId).toBeTruthy();
  await rpc(page, "routines/create", {
    botId: researcherId,
    name: "Research digest",
    prompt: "Summarize today",
    crons: ["0 9 * * *"],
    timezone: "UTC",
    active: false,
    notify: false,
  });
  // Mention routines load with the roster, so reload to pick the new one up.
  await page.reload();

  await openNewGroup(page);
  await page.locator("label:has-text('Name') input").fill("Mention keys team");
  const panel = page.getByTestId("side-panel");
  await panel.getByRole("button", { name: "Researcher" }).click();
  await panel.getByRole("button", { name: "Research Writer" }).click();
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page.waitForURL(/\/app\/g\/[^/]+$/);

  const composer = page.getByRole("combobox", { name: "Message Mention keys team" });
  await expect(composer).toBeVisible();

  await composer.fill("@Res");
  const picker = page.getByTestId("mention-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await expect(composer).toHaveAttribute("aria-expanded", "true");
  await captureScreenshot(page, testInfo, "mention-picker-keyboard-open");

  await composer.press("ArrowDown");
  await expect(picker.getByRole("option", { name: "@Research Writer" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await composer.press("Enter");
  await expect(page.getByTestId("mention-picker")).toHaveCount(0);
  await expect(
    page.getByTestId("mention-chip").filter({ hasText: "Research Writer" }),
  ).toBeVisible();
  await expect(composer).toBeFocused();
  await expect(composer).toHaveAttribute("aria-expanded", "false");
  await captureScreenshot(page, testInfo, "mention-picker-keyboard-completed");

  await page.getByRole("button", { name: "Remove mention Research Writer" }).click();
  await composer.fill("@Res");
  await expect(page.getByTestId("mention-picker")).toBeVisible();
  await composer.press("Tab");
  await expect(page.getByTestId("mention-picker")).toHaveCount(0);
  await expect(page.getByTestId("mention-chip").filter({ hasText: "Researcher" })).toBeVisible();
  await expect(composer).toBeFocused();

  await page.getByRole("button", { name: "Remove mention Researcher" }).click();
  await composer.fill("@Res");
  await expect(page.getByTestId("mention-picker")).toBeVisible();
  await composer.press("Escape");
  await expect(page.getByTestId("mention-picker")).toHaveCount(0);
  await expect(composer).toHaveValue("@Res");
  await expect(page.getByTestId("mention-chip")).toHaveCount(0);
  await expect(composer).toBeFocused();

  await composer.fill("@dig");
  const routineOption = page.getByTestId("mention-picker").getByRole("option");
  await expect(routineOption).toHaveCount(1);
  await expect(routineOption).toContainText("Runs on send");
  await captureScreenshot(page, testInfo, "mention-picker-routine");

  await composer.fill("@Writer");
  await expect(page.getByTestId("mention-picker").getByRole("option")).toHaveCount(1);
  await composer.fill("@zz");
  await expect(page.getByTestId("mention-picker-empty")).toContainText("No matches");
  await captureScreenshot(page, testInfo, "mention-picker-no-matches");
  await composer.press("Enter");
  await expect(composer).toHaveValue("@zz");
  await composer.press("Escape");
  await expect(page.getByTestId("mention-picker-empty")).toHaveCount(0);

  await composer.fill("hello without a picker");
  await composer.press("Enter");
  await expect(page.getByTestId("transcript")).toContainText("hello without a picker", {
    timeout: 60_000,
  });
});
