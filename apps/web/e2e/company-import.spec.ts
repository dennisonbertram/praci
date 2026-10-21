import { expect, test } from "@playwright/test";
import type { CompanyImportSession } from "@rakazo/contracts";
import { importCatalog, importConsent, importSession } from "../src/pages/company-import-fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Company Slack scope defaults public and requires each private channel choice", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const slackSource = {
    ...importCatalog.sources[2]!,
    available: true,
    reason: null,
    defaultScope: { after: "2023-10-21" },
  };
  let session: CompanyImportSession | null = null;
  let createInput: unknown;
  let privateListings = 0;
  await page.route("**/rpc/companyImport/**", async (route) => {
    const method = new URL(route.request().url()).pathname.split("/").at(-1);
    const input = route.request().postDataJSON()?.json;
    let result: unknown;
    if (method === "catalog") result = { sources: [slackSource], folders: [] };
    if (method === "session") result = session;
    if (method === "channels") {
      if (input.includePrivate) privateListings++;
      result = {
        channels: input.includePrivate
          ? [
              { id: "GSELECTED1", name: "project-planning", private: true, direct: false },
              { id: "DSELECTED1", name: "DSELECTED1", private: true, direct: true },
            ]
          : [
              { id: "CPUBLIC1", name: "general", private: false, direct: false },
              { id: "CPUBLIC2", name: "launches", private: false, direct: false },
            ],
        nextCursor: null,
      };
    }
    if (method === "create") {
      createInput = input;
      session = structuredClone(importSession);
      session.sources[0] = {
        ...session.sources[0]!,
        sourceKind: "slack",
        connectionId: slackSource.connectionId,
        label: "Slack",
        scope: input.sources[0].scope,
      };
      result = session.progress;
    }
    if (method === "consentStatus") result = { ...importConsent, allowed: false };
    if (method === "subscribe") {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: result, meta: [] }),
    });
  });
  await signup(page, `company-slack-${Date.now()}@rakazo.test`, "password12", "Slack Import User");
  await completeOnboarding(page);
  await page.goto("/app/company/import");
  await page.getByRole("button", { name: /Choose scope/ }).click();
  const sheet = page.getByRole("dialog", { name: /Choose scope/ });
  await expect(
    sheet.getByRole("checkbox", { name: "All public channels", exact: true }),
  ).toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "#general", exact: true })).toBeChecked();
  expect(privateListings).toBe(0);
  await sheet.getByRole("checkbox", { name: "All public channels", exact: true }).uncheck();
  await sheet.getByRole("checkbox", { name: "#launches", exact: true }).check();
  await sheet.getByRole("button", { name: "Private channels and DMs", exact: true }).click();
  await expect(
    sheet.getByRole("checkbox", { name: "#project-planning", exact: true }),
  ).not.toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "DSELECTED1", exact: true })).not.toBeChecked();
  await sheet.getByRole("checkbox", { name: "#project-planning", exact: true }).check();
  await captureScreenshot(page, testInfo, "company-slack-explicit-private-scope");
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /Choose scope/ }).click();
  await expect(
    sheet.getByRole("checkbox", { name: "#project-planning", exact: true }),
  ).toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "DSELECTED1", exact: true })).not.toBeChecked();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preview sample", exact: true })).toBeVisible();
  expect(createInput).toMatchObject({
    sources: [
      {
        sourceKind: "slack",
        scope: { channelIds: ["CPUBLIC2"], privateChannelIds: ["GSELECTED1"], after: "2023-10-21" },
      },
    ],
  });
});

test("Company import requires consent and restores sample, progress and owner controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  let session: CompanyImportSession | null = null;
  let allowed = false;
  let createInput: unknown;
  let starts = 0;
  let failFullImport = false;
  await page.route("**/rpc/companyImport/**", async (route) => {
    const method = new URL(route.request().url()).pathname.split("/").at(-1);
    const input = route.request().postDataJSON()?.json;
    let result: unknown;
    if (method === "catalog") result = importCatalog;
    if (method === "session") result = session;
    if (method === "consentStatus") result = { ...importConsent, allowed };
    if (method === "grantConsent") {
      allowed = true;
      result = { ...importConsent, allowed };
    }
    if (method === "create") {
      createInput = input;
      allowed = false;
      session = structuredClone(importSession);
      session.sources[0]!.scope = input.sources[0].scope;
      result = session.progress;
    }
    if (method === "start") {
      expect(allowed).toBe(true);
      starts++;
      session!.progress.status = "preview_ready";
      session!.progress.sources[0]!.itemsRead = session!.progress.sources[0]!.itemsDiscovered = 25;
      session!.progress.sources[0]!.factsFound = 1;
      result = session!.progress;
    }
    if (method === "action") {
      const statuses: Record<string, string> = {
        pause: "paused",
        resume: "running",
        continue: failFullImport ? "partial" : "running",
        cancel: "cancelled",
        discard: "discarded",
        retry_failed: "completed",
      };
      session!.progress.status = statuses[input.action]!;
      if (input.action === "continue") session!.mode = "full";
      result = session!.progress;
    }
    if (method === "sample")
      result = [
        {
          sourceId: "source-documents",
          items: [
            {
              sourceItemId: "synthetic-document",
              facts: [
                {
                  kind: "entity",
                  title: "Northwind Robotics",
                  quote: "Northwind Robotics builds warehouse robots.",
                  confidence: 0.94,
                },
              ],
            },
          ],
        },
      ];
    if (method === "subscribe") {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: result, meta: [] }),
    });
  });
  await signup(
    page,
    `company-import-${Date.now()}@rakazo.test`,
    "password12",
    "Company Import User",
  );
  await completeOnboarding(page);
  await page.goto("/app/company/import");
  await expect(page.getByRole("heading", { name: "Import company" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Slack", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Connect", exact: true })).toHaveAttribute(
    "href",
    /returnTo=%2Fapp%2Fcompany%2Fimport/,
  );
  await page.getByRole("button", { name: /Choose scope/ }).click();
  const scope = page.getByRole("dialog", { name: /Choose scope/ });
  await scope.getByRole("checkbox", { name: "All folders", exact: true }).uncheck();
  await scope.getByRole("checkbox", { name: "Company documents", exact: true }).check();
  await scope.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preview sample" })).toBeDisabled();
  expect(starts).toBe(0);
  expect(createInput).toMatchObject({
    mode: "sample",
    sources: [{ sourceKind: "data_room", scope: { folderIds: ["company-docs"] } }],
  });
  await captureScreenshot(page, testInfo, "company-import-consent");
  const consent = page.getByRole("checkbox", {
    name: "Allow Data room to Example model provider",
  });
  await consent.click();
  await expect(consent).toBeChecked();
  await page.getByRole("button", { name: "Preview sample" }).click();
  await expect(page.getByText("Northwind Robotics builds warehouse robots.")).toBeVisible();
  await captureScreenshot(page, testInfo, "company-import-sample");
  await page.getByRole("link", { name: "Open Company" }).click();
  await page.goto("/app/company/import");
  await expect(page.getByRole("button", { name: "Start import", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start import", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await captureScreenshot(page, testInfo, "company-import-progress");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("button", { name: "New import", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New import", exact: true }).click();
  failFullImport = true;
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const retryConsent = page.getByRole("checkbox", {
    name: "Allow Data room to Example model provider",
  });
  await retryConsent.click();
  await expect(retryConsent).toBeChecked();
  await page.getByRole("button", { name: "Preview sample" }).click();
  await page.getByRole("button", { name: "Start import", exact: true }).click();
  await page.getByRole("button", { name: "Retry failed", exact: true }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
});
