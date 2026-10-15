import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openIntegrations, signup } from "./helpers";

test("a GraphQL endpoint is added from the custom connection dialog's Advanced section", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `graphql-source-${stamp}@rakazo.test`, "password12", `GraphQL ${stamp}`);
  await completeOnboarding(page);

  await openIntegrations(page);
  await expect(page.getByPlaceholder("Search apps")).toBeVisible();
  await expect(page.getByRole("button", { name: "GraphQL", exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Add custom connection", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Advanced", { exact: true }).click();
  for (const label of ["OpenAPI", "GraphQL", "Executor", "Treg", "Local command"]) {
    await expect(dialog.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await captureScreenshot(page, testInfo, "01-graphql-advanced");

  await dialog.getByRole("button", { name: "GraphQL", exact: true }).click();
  await dialog.getByPlaceholder("Display name").fill("Browser GraphQL");
  await dialog
    .getByPlaceholder("https://example.com/graphql")
    .fill("https://graphql.example.test/graphql");
  await dialog.getByRole("button", { name: "Verify and add", exact: true }).click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText(/GRAPHQL · graphql\.example\.test/)).toBeVisible();
  await captureScreenshot(page, testInfo, "02-graphql-installed");

  // The new tool source can be removed from its card.
  await page.getByRole("button", { name: "Remove Browser GraphQL", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText(/GRAPHQL · graphql\.example\.test/)).toHaveCount(0);
});
