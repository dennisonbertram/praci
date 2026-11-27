import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { completeOnboarding, rpc, signup } from "./helpers";

test("Cap table keeps Fundraising SAFE actions reachable through scroll and keyboard", async ({
  page,
}, testInfo) => {
  const investor = "QA Scroll SAFE Holder";
  const holderName = "QA Scroll Holder Name With Several Long Words To Test Overflow Handling";
  const email = `cap-table-scroll-${Date.now()}@rakazo.test`;
  const issuedAt = new Date().toISOString();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signup(page, email, "password12", "Cap Table Scroll");
  await completeOnboarding(page);

  const round = await rpc<{ id: string }>(page, "fundraising/round/save", {
    name: "QA Scroll SAFE Round",
    targetCents: 10_000_000,
    capCents: 500_000_000,
  });
  const prospect = await rpc<{ id: string }>(page, "contacts/save", {
    name: investor,
    email,
    organization: investor,
    kind: "prospect",
    stage: "committed",
    checkSizeCents: 2_500_000,
    roundId: round.id,
  });
  const safe = await rpc<{ id: string }>(page, "fundraising/safes/save", {
    contactId: prospect.id,
    investorName: investor,
    investorEmail: email,
    amountCents: 2_500_000,
    capCents: 500_000_000,
    proRata: false,
    investmentDate: issuedAt,
  });
  for (const action of ["sent", "signed", "funded"] as const) {
    await rpc(page, "fundraising/safes/mark", { id: safe.id, action, at: issuedAt });
  }

  const holder = await rpc<{ id: string }>(page, "equity/stakeholders/create", {
    type: "organization",
    name: holderName,
    requestKey: randomUUID(),
  });
  for (let index = 0; index < 22; index += 1) {
    await rpc(page, "equity/convertibles/create", {
      label: `SAFE-${6000 + index}`,
      stakeholderId: holder.id,
      kind: "safe",
      principalCents: "10000",
      issueDate: "2020-01-01",
      requestKey: randomUUID(),
    });
  }

  await page.getByRole("link", { name: "Cap table", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/cap-table\/overview$/);
  await page.getByRole("tab", { name: "Securities" }).click();
  await page.getByRole("tab", { name: "SAFEs and convertibles" }).click();

  const add = page.getByRole("button", { name: `Add ${investor} to ledger` });
  await expect(add).toBeVisible();
  const initial = await add.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial!.y).toBeGreaterThan(1000);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  let tabReachedAdd = false;
  for (let index = 0; index < 300; index += 1) {
    await page.keyboard.press("Tab");
    if (await add.evaluate((element) => document.activeElement === element)) {
      tabReachedAdd = true;
      break;
    }
  }
  expect(tabReachedAdd).toBe(true);
  await expect(add).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("cap-table-scroll-keyboard.png") });

  const beforeWheelUp = await add.boundingBox();
  expect(beforeWheelUp).not.toBeNull();
  const main = page.getByRole("main");
  const mainBounds = await main.boundingBox();
  expect(mainBounds).not.toBeNull();
  const wheelX = mainBounds!.x + mainBounds!.width - 20;
  const wheelY = mainBounds!.y + mainBounds!.height / 2;
  await page.mouse.move(wheelX, wheelY);
  await page.mouse.wheel(0, -2_000);
  await expect
    .poll(async () => (await add.boundingBox())?.y ?? 0)
    .toBeGreaterThan(beforeWheelUp!.y);
  await page.mouse.move(wheelX, wheelY);
  await page.mouse.wheel(0, 1_200);
  await expect(add).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("cap-table-scroll-wheel.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  const beforeNarrowWheelUp = await add.boundingBox();
  expect(beforeNarrowWheelUp).not.toBeNull();
  const narrowMainBounds = await main.boundingBox();
  expect(narrowMainBounds).not.toBeNull();
  const narrowWheelX = narrowMainBounds!.x + narrowMainBounds!.width - 12;
  const narrowWheelY = narrowMainBounds!.y + narrowMainBounds!.height / 2;
  await page.mouse.move(narrowWheelX, narrowWheelY);
  await page.mouse.wheel(0, -2_000);
  await expect
    .poll(async () => (await add.boundingBox())?.y ?? 0)
    .toBeGreaterThan(beforeNarrowWheelUp!.y);
  await page.mouse.move(narrowWheelX, narrowWheelY);
  await page.mouse.wheel(0, 2_000);
  const fundraisingRegion = page.getByRole("region", { name: "Fundraising SAFEs" });
  const fundraisingWidth = await fundraisingRegion.evaluate((region) => ({
    client: region.clientWidth,
    scroll: region.scrollWidth,
  }));
  expect(fundraisingWidth.scroll).toBeGreaterThan(fundraisingWidth.client);
  const convertiblesRegion = page.getByRole("region", { name: "Convertibles" });
  const convertiblesWidth = await convertiblesRegion.evaluate((region) => ({
    client: region.clientWidth,
    scroll: region.scrollWidth,
  }));
  expect(convertiblesWidth.scroll).toBeGreaterThan(convertiblesWidth.client);
  const stakeholderCell = page
    .getByRole("row")
    .filter({ hasText: "SAFE-6021" })
    .locator("td")
    .nth(2);
  const stakeholderName = stakeholderCell.getByText(holderName, { exact: true });
  await expect(stakeholderName).toHaveAttribute("title", holderName);
  const stakeholderCellHeight = await stakeholderCell.evaluate((cell) => ({
    client: cell.clientHeight,
    scroll: cell.scrollHeight,
    clientWidth: cell.clientWidth,
    scrollWidth: cell.scrollWidth,
  }));
  expect(stakeholderCellHeight.scroll).toBeLessThanOrEqual(stakeholderCellHeight.client);
  expect(stakeholderCellHeight.scrollWidth).toBeLessThanOrEqual(stakeholderCellHeight.clientWidth);
  const mainWidth = await main.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(mainWidth.scroll).toBeLessThanOrEqual(mainWidth.client);
  const fundraisingBounds = await fundraisingRegion.boundingBox();
  expect(fundraisingBounds).not.toBeNull();
  await page.mouse.move(
    fundraisingBounds!.x + fundraisingBounds!.width / 2,
    fundraisingBounds!.y + fundraisingBounds!.height / 2,
  );
  await page.mouse.wheel(1_200, 0);
  await expect
    .poll(() => fundraisingRegion.evaluate((region) => region.scrollLeft))
    .toBeGreaterThan(0);
  await expect(add).toBeInViewport();

  await fundraisingRegion.evaluate((region) => {
    region.scrollLeft = 0;
  });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  let tabReachedFundraisingRegion = false;
  for (let index = 0; index < 300; index += 1) {
    await page.keyboard.press("Tab");
    if (await fundraisingRegion.evaluate((region) => document.activeElement === region)) {
      tabReachedFundraisingRegion = true;
      break;
    }
  }
  expect(tabReachedFundraisingRegion).toBe(true);
  const beforeArrow = await fundraisingRegion.evaluate((region) => region.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => fundraisingRegion.evaluate((region) => region.scrollLeft))
    .toBeGreaterThan(beforeArrow);
  await page.keyboard.press("Tab");
  expect(await add.evaluate((element) => document.activeElement === element)).toBe(true);
  await expect(add).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("cap-table-scroll-narrow.png") });

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "From Fundraising" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Securities" }).click();
  await page.getByRole("tab", { name: "SAFEs and convertibles" }).click();
  await expect(page.getByRole("heading", { name: "From Fundraising" })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: investor })).toHaveCount(1);
});
