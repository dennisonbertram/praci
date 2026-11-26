import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("composer / picker inserts /goal and a set goal shows its line", async ({
  page,
}, testInfo) => {
  await signup(page, `goal-${Date.now()}@rakazo.test`, "password12", "Goal Web");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  const composer = page.getByRole("textbox", { name: /^Message/ });
  await composer.fill("/goa");
  await page.getByTestId("slash-picker").getByRole("option", { name: "Goal" }).click();
  await expect(composer).toHaveValue("/goal ");

  await composer.fill("/goal List three mug suppliers");
  await composer.press("Enter");
  const line = page.getByTestId("goal-line");
  await expect(line).toContainText("List three mug suppliers");
  await captureScreenshot(page, testInfo, "goal-line");

  await line.getByRole("button", { name: "Clear goal" }).click();
  await expect(line).toHaveCount(0);
});
