import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

// Every firm and person is invented.
const rows = [
  { firm: "Peak Example", people: [{ name: "Avery Example" }], group: "Wave 1" },
  { firm: "Riverside Example Fund", referrer: { name: "Sam Example" } },
];

test("a list becomes one card, then the Pipeline, and running it again adds nobody", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `list-import-${Date.now()}@rakazo.test`, "password12", "List Import");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-fundraising").click();
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Ask Investors agent" }).click();
  const panel = page.getByTestId("side-panel");
  const composer = panel.getByPlaceholder("Message Investors agent");
  await composer.fill(`pipeline import fixture ${JSON.stringify(rows)}`);
  await page.keyboard.press("Enter");

  const card = page.getByTestId("pipeline-import-card");
  await expect(card).toContainText("Add 2 prospects to Fundraising", { timeout: 60_000 });
  await expect(card).toContainText("2 new contacts");
  await expect(card).toContainText("1 prospect with no person yet");
  await expect(card.getByText(/always allow/i)).toHaveCount(0);
  await captureScreenshot(page, testInfo, "pipeline-import-card");

  await card.getByRole("button", { name: "Add 2 prospects" }).click();
  const result = page.getByTestId("pipeline-import-result");
  await expect(result).toContainText("Added 2 prospects to Fundraising", { timeout: 30_000 });
  await captureScreenshot(page, testInfo, "pipeline-import-result");
  await result.getByRole("link", { name: "View in Pipeline" }).click();
  await expect(main.getByText("Peak Example").first()).toBeVisible();
  await expect(main.getByText("Riverside Example Fund").first()).toBeVisible();
});
