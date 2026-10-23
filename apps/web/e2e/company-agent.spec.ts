import { expect, test } from "@playwright/test";
import type { Bot } from "@rakazo/contracts";
import { captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("Company pages open their separate durable restricted agents", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `company-agent-${Date.now()}@rakazo.test`, "password12", "Company Owner");
  await completeOnboarding(page);
  await page.goto("/app/company");
  await page.getByRole("button", { name: "Ask Company agent", exact: true }).click();
  const historian = page.getByTestId("company-agent-panel");
  await expect(
    historian.getByRole("button", { name: "Open Company agent full screen" }),
  ).toBeVisible();
  const first = await rpc<Bot>(page, "company/agent", {});
  expect(first.spawnKey).toMatch(/^company-agent:/);
  const again = await rpc<Bot>(page, "company/agent", {});
  expect(again.id).toBe(first.id);
  await captureScreenshot(page, testInfo, "company-agent-panel");
  await historian.getByRole("button", { name: "Collapse Company agent" }).click();
  await expect(historian).toHaveCount(0);

  await page.goto("/app/company/import");
  await page.getByRole("button", { name: "Ask Company importer", exact: true }).click();
  const importer = page.getByTestId("company-importer-panel");
  await expect(
    importer.getByRole("button", { name: "Open Company importer full screen" }),
  ).toBeVisible();
  const second = await rpc<Bot>(page, "companyImport/agent", {});
  expect(second.spawnKey).toMatch(/^company-importer:/);
  expect(second.id).not.toBe(first.id);
  await captureScreenshot(page, testInfo, "company-importer-panel");
  await page.goto("/app/company");
  await expect(page.getByTestId("company-importer-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Ask Company agent", exact: true }).click();
  await expect(
    historian.getByRole("button", { name: "Open Company agent full screen" }),
  ).toBeVisible();
  expect((await rpc<Bot>(page, "company/agent", {})).id).toBe(first.id);
});

test("Company route changes can create the other agent while creation is pending", async ({
  page,
}) => {
  await signup(page, `company-race-${Date.now()}@rakazo.test`, "password12", "Company Owner");
  await completeOnboarding(page);
  let releaseCreation!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseCreation = resolve;
  });
  let startedCreation!: () => void;
  const started = new Promise<void>((resolve) => {
    startedCreation = resolve;
  });
  await page.route("**/rpc/company/agent", async (route) => {
    startedCreation();
    await held;
    await route.continue();
  });
  try {
    await page.goto("/app/company");
    await page.getByRole("button", { name: "Ask Company agent", exact: true }).click();
    await started;
    await page.getByRole("link", { name: "Import", exact: true }).click();
    await page.getByRole("button", { name: "Ask Company importer", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open Company importer full screen" }),
    ).toBeVisible();
    releaseCreation();
    await page.getByRole("link", { name: "Company", exact: true }).click();
    await page.getByRole("button", { name: "Ask Company agent", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open Company agent full screen" }),
    ).toBeVisible();
    await expect(page.getByTestId("company-importer-panel")).toHaveCount(0);
  } finally {
    releaseCreation();
  }
});
