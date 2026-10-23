import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { companyFixture } from "../src/pages/company-fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("Company owner can share, export, exclude, disconnect and erase with confirmation", async ({
  page,
}, testInfo) => {
  const data = structuredClone(companyFixture);
  const person = data.entities.find((entity) => entity.id === "person")!;
  const source = {
    sourceKind: "data_room",
    connectionId: null,
    mcpServerId: null,
    label: "Data room",
    evidenceCount: 3,
    blocked: false,
  };
  let exclusions = 0;
  let erasures = 0;
  await page.route("**/rpc/company/**", async (route) => {
    const method = new URL(route.request().url()).pathname.split("/").at(-1);
    const input = route.request().postDataJSON()?.json;
    let result: unknown = { ok: true };
    if (method === "page") result = data;
    if (method === "privacy") result = { sources: [source] };
    if (method === "confirm") {
      expect(input).toEqual({ kind: "entity", id: "person" });
      person.status = "confirmed";
    }
    if (method === "visibility") {
      expect(input).toEqual({ kind: "entity", id: "person", visibility: "team" });
      person.visibility = "team";
    }
    if (method === "export")
      result = {
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        entities: data.entities,
        edges: data.edges,
        events: data.events,
        evidence: data.entities.flatMap((entity) => entity.evidence),
      };
    if (method === "excludePerson") {
      expect(input).toEqual({ entityId: "person" });
      exclusions++;
      data.entities = data.entities.filter((entity) => entity.id !== "person");
      data.edges = [];
    }
    if (method === "sourceControl") {
      expect(input).toMatchObject({
        sourceKind: "data_room",
        connectionId: null,
        mcpServerId: null,
      });
      source.blocked = !input.connected;
      source.evidenceCount = 0;
    }
    if (method === "erase") {
      erasures++;
      data.entities = [];
      data.edges = [];
      data.events = [];
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: result, meta: [] }),
    });
  });
  await signup(page, `company-privacy-${Date.now()}@rakazo.test`, "password12", "Privacy Owner");
  await completeOnboarding(page);
  await page.goto("/app/company?view=people");
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  let detail = page.getByRole("dialog", { name: "Alex Reed" });
  await expect(detail.getByRole("button", { name: "Share with team" })).toBeDisabled();
  await detail.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(detail).toBeHidden();
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  await detail.getByRole("button", { name: "Share with team" }).click();
  await expect(detail).toBeHidden();
  await page.getByRole("button", { name: "Company actions" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("company-map.json");
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.version).toBe(1);
  expect(
    exported.entities.find((entity: { id: string }) => entity.id === "person").visibility,
  ).toBe("team");
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  detail = page.getByRole("dialog", { name: "Alex Reed" });
  await expect(detail.getByText("Shared with team", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Exclude person" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(exclusions).toBe(0);
  await detail.getByRole("button", { name: "Exclude person" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Exclude", exact: true }).click();
  await expect(page.getByRole("button", { name: "Alex Reed", exact: true })).toHaveCount(0);
  expect(exclusions).toBe(1);
  await page.getByRole("button", { name: "Company actions" }).click();
  await page.getByRole("menuitem", { name: "Privacy", exact: true }).click();
  const privacy = page.getByRole("dialog", { name: "Company privacy" });
  await privacy.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Your integration stays connected");
  await captureScreenshot(page, testInfo, "company-source-privacy");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(privacy.getByText("Disconnected", { exact: true })).toBeVisible();
  await privacy.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(privacy.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await privacy.getByRole("button", { name: "Erase company map" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(erasures).toBe(0);
  await privacy.getByRole("button", { name: "Erase company map" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Erase", exact: true }).click();
  await expect(privacy).toBeHidden();
  expect(erasures).toBe(1);
});

test("Team fact details have no private evidence or owner controls", async ({ page }, testInfo) => {
  const person = {
    ...structuredClone(companyFixture.entities[1]!),
    readOnly: true,
    status: "confirmed",
    visibility: "team",
    evidence: [],
    identities: [],
    edges: [],
    events: [],
  };
  await page.route("**/rpc/company/page", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: { entities: [person], edges: [], events: [], latestRun: null },
        meta: [],
      }),
    }),
  );
  await signup(page, `company-member-${Date.now()}@rakazo.test`, "password12", "Team Member");
  await completeOnboarding(page);
  await page.goto("/app/company?view=people");
  await expect(page.getByRole("row").filter({ hasText: "Alex Reed" })).toContainText("—");
  await page.getByRole("button", { name: "Alex Reed", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Alex Reed" });
  await expect(detail.getByText("Shared with team", { exact: true })).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: /^(Confirm|Edit|Reject|Share with team|Make private|Exclude person)$/,
    }),
  ).toHaveCount(0);
  await expect(detail.getByRole("heading", { name: "Sources", exact: true })).toHaveCount(0);
  await expect(detail.getByRole("link", { name: "Open source" })).toHaveCount(0);
  await expect(detail).not.toContainText("Alex Reed joined as an engineer.");
  await captureScreenshot(page, testInfo, "company-team-fact");
});
