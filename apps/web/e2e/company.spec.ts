import { expect, test } from "@playwright/test";
import { companyFixture } from "../src/pages/company-fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Company shows owner facts, precision and provenance with masked money", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const data = structuredClone(companyFixture);
  let editRequests = 0;
  data.edges[0]!.role = null;
  data.events[0]!.occursOn = { date: "2024-01-01", precision: "year" };
  await page.clock.setFixedTime(new Date("2024-07-01T12:00:00Z"));
  data.entities[0]!.attrs.description = "Raised $50,000 for warehouse robots.";
  await page.route("**/rpc/company/**", async (route) => {
    const method = new URL(route.request().url()).pathname.split("/").at(-1);
    if (method?.startsWith("edit")) editRequests++;
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
  await expect(page.getByRole("heading", { name: "Next dates" }).locator("..")).toContainText(
    data.events[0]!.title,
  );
  await page.getByTestId("hide-amounts-toggle").click();
  await expect(page.getByText("Raised $50,000 for warehouse robots.")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "company-overview");
  await page.getByRole("tab", { name: "People", exact: true }).click();
  await expect(page.getByRole("cell", { name: "2024", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  const personDetail = page.getByRole("dialog", { name: "Alex Reed" });
  await expect(personDetail).toContainText("Alex Reed joined as an engineer.");
  await expect(personDetail).toContainText("Roles over time");
  await captureScreenshot(page, testInfo, "company-fact-detail");
  await personDetail.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("hide-amounts-toggle").click();
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  await personDetail.getByRole("button", { name: "Edit", exact: true }).click();
  await personDetail.getByRole("button", { name: "Save", exact: true }).click();
  await expect(personDetail).toHaveCount(0);
  expect(editRequests).toBe(0);
  await page.getByRole("button", { name: "—", exact: true }).click();
  const relationship = page.getByRole("dialog", { name: "works at" });
  await relationship.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(relationship.getByLabel("Role", { exact: true })).toHaveValue("");
  await relationship.getByRole("button", { name: "Save", exact: true }).click();
  await expect(relationship).toHaveCount(0);
  expect(editRequests).toBe(0);
  data.entities = [];
  data.edges = [];
  data.events[0]!.entityIds = [];
  await page.goto("/app/company");
  await expect(page.getByRole("button", { name: new RegExp(data.events[0]!.title) })).toBeVisible();
  await expect(page.getByText("No company facts yet")).toHaveCount(0);
});
