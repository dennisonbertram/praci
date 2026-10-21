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
  await page.getByRole("tab", { name: "History", exact: true }).click();
  const timeline = page.getByRole("region", { name: "History timeline; plus or minus to zoom" });
  const historyBar = timeline.getByRole("button", { name: /Alex Reed/ });
  await expect(timeline.getByText("Not confirmed", { exact: true }).first()).toBeVisible();
  await historyBar.focus();
  await page.keyboard.press("+");
  await expect(page.getByRole("button", { name: "Quarter", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await captureScreenshot(page, testInfo, "company-history");
  await page.keyboard.press("Enter");
  const keyboardDetail = page.getByRole("dialog", { name: "works at" });
  await expect(keyboardDetail).toBeVisible();
  await keyboardDetail.getByRole("button", { name: "Close", exact: true }).click();

  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await page.setViewportSize({ width: 390, height: 844 });
  await timeline.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await historyBar.scrollIntoViewIfNeeded();
  const barBounds = await historyBar.boundingBox();
  const timelineBounds = await timeline.boundingBox();
  if (!barBounds || !timelineBounds) throw new Error("History bar or timeline is not rendered");
  const left = Math.max(timelineBounds.x + 8, barBounds.x + 8);
  const right = Math.min(
    timelineBounds.x + timelineBounds.width - 8,
    barBounds.x + barBounds.width - 8,
  );
  const top = Math.max(timelineBounds.y + 8, barBounds.y + 8);
  const bottom = Math.min(
    timelineBounds.y + timelineBounds.height - 8,
    barBounds.y + barBounds.height - 8,
  );
  if (right - left < 80 || bottom <= top) throw new Error("History bar is not touchable");
  const startX = Math.min(right - 8, left + 100);
  const startY = (top + bottom) / 2;
  const initialScrollLeft = await timeline.evaluate((element) => element.scrollLeft);
  expect(
    await timeline.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeGreaterThan(0);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY, id: 1 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX - 40, y: startY, id: 1 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX - 80, y: startY, id: 1 }],
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(() => timeline.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(initialScrollLeft);
  await expect(page.getByRole("dialog", { name: "works at" })).toHaveCount(0);

  await historyBar.scrollIntoViewIfNeeded();
  const tapBounds = await historyBar.boundingBox();
  const tapTimelineBounds = await timeline.boundingBox();
  if (!tapBounds || !tapTimelineBounds) throw new Error("History bar or timeline is not rendered");
  const tapLeft = Math.max(tapTimelineBounds.x + 8, tapBounds.x + 8);
  const tapRight = Math.min(
    tapTimelineBounds.x + tapTimelineBounds.width - 8,
    tapBounds.x + tapBounds.width - 8,
  );
  const tapTop = Math.max(tapTimelineBounds.y + 8, tapBounds.y + 8);
  const tapBottom = Math.min(
    tapTimelineBounds.y + tapTimelineBounds.height - 8,
    tapBounds.y + tapBounds.height - 8,
  );
  if (tapRight <= tapLeft || tapBottom <= tapTop) throw new Error("History bar is not touchable");
  const tapX = (tapLeft + tapRight) / 2;
  const tapY = (tapTop + tapBottom) / 2;
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: tapX, y: tapY, id: 1 }],
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const touchDetail = page.getByRole("dialog", { name: "works at" });
  await expect(touchDetail).toBeVisible();
  await touchDetail.getByRole("button", { name: "Close", exact: true }).click();
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await touch.detach();
  await page.setViewportSize({ width: 1500, height: 1000 });
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
