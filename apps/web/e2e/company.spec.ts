import { expect, test } from "@playwright/test";
import { companyFixture } from "../src/pages/company-fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Company shows owner facts, precision and provenance with masked money", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const data = structuredClone(companyFixture);
  data.entities[0]!.attrs.description = "Raised $50,000 for warehouse robots.";
  await page.route("**/rpc/company/**", async (route) => {
    const method = new URL(route.request().url()).pathname.split("/").at(-1);
    if (method === "confirm") data.entities[0]!.status = "confirmed";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: method === "page" ? data : { ok: true }, meta: [] }),
    });
  });
  await signup(page, `company-${Date.now()}@rakazo.test`, "password12", "Company User");
  await completeOnboarding(page);
  await page.goto("/app/company");
  await expect(page.getByRole("heading", { name: "Company", exact: true })).toBeVisible();
  await expect(page.getByText("Raised $50,000 for warehouse robots.")).toBeVisible();
  await page.getByTestId("hide-amounts-toggle").click();
  await expect(page.getByText("Raised $50,000 for warehouse robots.")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "company-overview");
  await page.getByRole("tab", { name: "People", exact: true }).click();
  await expect(page.getByRole("cell", { name: "2024", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Alex Reed joined as an engineer.");
  await expect(page.getByRole("dialog")).toContainText("Roles over time");
  await captureScreenshot(page, testInfo, "company-fact-detail");
});
