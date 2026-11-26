import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  consentFixture,
  contracts,
  deadlines,
  emptyOverview,
  graph,
  id,
  overview,
} from "../src/pages/legal/fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Answers the Legal RPCs with synthetic data; everything else (sign-up, bots) is the real stack. */
async function mockLegal(
  page: Page,
  options: {
    empty?: boolean;
    consented?: boolean;
    contractTitle?: string;
    similarContracts?: boolean;
  } = {},
) {
  const calls: { name: string; input: unknown }[] = [];
  let consented = options.consented ?? true;
  await page.route("**/rpc/legal/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/legal/")[1] ?? "";
    const input = (route.request().postDataJSON() as { json?: unknown } | null)?.json;
    calls.push({ name, input });
    if (name === "consentGrant") consented = true;
    const answers: Record<string, unknown> = {
      // Consent is offered when documents make a scan meaningful, not on an empty page.
      overview: options.empty
        ? { ...emptyOverview, model: overview.model }
        : options.similarContracts
          ? {
              ...overview,
              contracts: [
                {
                  ...contracts[0]!,
                  id: id(1),
                  title: "Master Services Agreement",
                  dataRoomItemId: id(101),
                },
                {
                  ...contracts[0]!,
                  id: id(3),
                  title: "Master Services Agreement (Acme Hosting Inc.)",
                  dataRoomItemId: id(101),
                },
                {
                  ...contracts[0]!,
                  id: id(4),
                  title: "Master Services Agreement (Example Labs LLC)",
                  dataRoomItemId: id(101),
                },
                {
                  ...contracts[1]!,
                  id: id(5),
                  title: "Office lease",
                  dataRoomItemId: id(102),
                },
                {
                  ...contracts[1]!,
                  id: id(6),
                  title: "Office lease (Sample Properties)",
                  dataRoomItemId: id(102),
                },
                {
                  ...contracts[1]!,
                  id: id(7),
                  title: "Office lease (Renewal)",
                  dataRoomItemId: id(102),
                },
              ],
            }
          : options.contractTitle
            ? {
                ...overview,
                contracts: contracts.map((contract, index) =>
                  index === 0 ? { ...contract, title: options.contractTitle! } : contract,
                ),
              }
            : overview,
      graph,
      consent: { ...consentFixture, allowed: consented },
      consentGrant: { ...consentFixture, allowed: true },
      updateDeadline: { ...deadlines[0], status: "done" },
      scanNow: { runId: contracts[0]?.id, botId: contracts[1]?.id },
      agent: null,
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  return calls;
}

const legalFolderId = id(501);
const legalDocuments = [
  {
    id: id(101),
    name: "Master Services Agreement source.txt",
    mimeType: "text/plain",
    size: 86,
    folderId: legalFolderId,
    source: "upload",
    sourceUrl: null,
    status: "ready",
    error: null,
    notIndexed: false,
    facets: {
      docType: "Contract",
      docDate: "2025-01-15T00:00:00.000Z",
      parties: ["Acme Hosting Inc.", "Example Labs LLC"],
      amountCents: null,
      currency: null,
      tags: ["legal"],
      summary: "Fixture source for the Master Services Agreement.",
    },
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
    hasThumbnail: false,
    previewText:
      "Fixture document body: Customer shall pay the monthly fee under the Master Services Agreement.",
  },
  {
    id: id(102),
    name: "Office lease source.txt",
    mimeType: "text/plain",
    size: 62,
    folderId: legalFolderId,
    source: "upload",
    sourceUrl: null,
    status: "ready",
    error: null,
    notIndexed: false,
    facets: {
      docType: "Contract",
      docDate: "2023-03-01T00:00:00.000Z",
      parties: ["Sample Properties"],
      amountCents: null,
      currency: null,
      tags: ["legal"],
      summary: "Fixture source for the Office lease.",
    },
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
    hasThumbnail: false,
    previewText:
      "Fixture document body: Return the security deposit paperwork for the Office lease.",
  },
];

/** The legal fixture IDs have matching Data room documents filed in a nested folder. */
async function mockLegalDataRoom(page: Page) {
  await page.route("**/rpc/dataRoom/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/dataRoom/")[1] ?? "";
    const input = (route.request().postDataJSON() as { json?: { id?: string } } | null)?.json ?? {};
    const answers: Record<string, unknown> = {
      folders: [
        {
          id: legalFolderId,
          name: "Contracts",
          parentId: id(502),
          createdAt: "2026-10-01T00:00:00.000Z",
        },
        { id: id(502), name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
      ],
      "items/list": { items: legalDocuments, nextCursor: null },
      item: legalDocuments.find((item) => item.id === input.id),
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
}

test("Legal shows contracts, deadlines and the graph", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const calls = await mockLegal(page);
  await signup(page, `legal-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-legal").click();
  await expect(page).toHaveURL(/\/app\/legal$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Legal", level: 1 })).toBeVisible();
  await expect(main.getByText(/Value \$50,000/)).toBeVisible();
  await expect(main.getByRole("link", { name: "Master Services Agreement" })).toHaveAttribute(
    "href",
    /\/app\/data-room\?item=/,
  );
  await captureScreenshot(page, testInfo, "legal-contracts");

  await main.getByRole("tab", { name: "Deadlines" }).click();
  await expect(main.getByText(/Overdue by \d+ day/).first()).toBeVisible();
  await captureScreenshot(page, testInfo, "legal-deadlines");
  await main
    .getByRole("button", { name: /^Mark .* done$/ })
    .first()
    .click();
  await expect.poll(() => calls.some((c) => c.name === "updateDeadline")).toBe(true);

  await main.getByRole("tab", { name: "Graph" }).click();
  await main.getByRole("button", { name: "Contract: Master Services Agreement" }).click();
  await expect(main.getByText("Customer shall pay the monthly fee.")).toBeVisible();
  await captureScreenshot(page, testInfo, "legal-graph");

  // Scan now queues a run and stays on the page: it reports progress itself and leaves the agent
  // panel as it was (closed here).
  await expect(main.getByText(/Scans daily\./)).toBeVisible();
  await main.getByRole("button", { name: "Scan now", exact: true }).click();
  await expect.poll(() => calls.some((c) => c.name === "scanNow")).toBe(true);
  await expect(page.getByTestId("legal-agent-panel")).toBeHidden();
});

test("Legal returns from a contract source to the same filtered view", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockLegalDataRoom(page);
  await mockLegal(page, { contractTitle: "MOCK Insurance Policy" });
  await signup(page, `legal-return-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.goto("/app/legal?view=contracts&q=MOCK+Insurance+Policy&group=off");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "MOCK Insurance Policy" })).toBeVisible();
  await main.getByRole("link", { name: "MOCK Insurance Policy" }).click();
  await expect(page).toHaveURL(/\/app\/data-room\?item=/);
  let preview = page.getByTestId("data-room-preview");
  await expect(
    preview.getByRole("heading", { name: "Master Services Agreement source.txt" }),
  ).toBeVisible();
  await expect(
    preview.getByText(/Fixture document body: Customer shall pay the monthly fee/),
  ).toBeVisible();
  await expect(preview).toContainText("Legal / Contracts");
  await expect(page.getByRole("link", { name: "Back to Legal" })).toHaveAttribute(
    "href",
    "/app/legal?view=contracts&q=MOCK+Insurance+Policy&group=off",
  );
  await page.reload();
  await expect(page.getByRole("link", { name: "Back to Legal" })).toBeVisible();
  preview = page.getByTestId("data-room-preview");
  await expect(
    preview.getByRole("heading", { name: "Master Services Agreement source.txt" }),
  ).toBeVisible();
  await expect(
    preview.getByText(/Fixture document body: Customer shall pay the monthly fee/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Legal" }).click();

  await expect(page).toHaveURL(/\/app\/legal\?view=contracts&q=MOCK\+Insurance\+Policy&group=off$/);
  await expect(main.getByRole("heading", { name: "Legal", level: 1 })).toBeVisible();
  await expect(main.getByRole("link", { name: "MOCK Insurance Policy" })).toBeVisible();

  const contractCard = main.getByRole("list", { name: "Contracts" }).getByRole("listitem").first();
  const contractCardBox = await contractCard.boundingBox();
  expect(contractCardBox).not.toBeNull();
  await page.mouse.click(
    contractCardBox!.x + contractCardBox!.width - 8,
    contractCardBox!.y + contractCardBox!.height - 4,
  );
  await expect(page.getByRole("link", { name: "Back to Legal" })).toHaveAttribute(
    "href",
    "/app/legal?view=contracts&q=MOCK+Insurance+Policy&group=off",
  );
  await page.getByRole("link", { name: "Back to Legal" }).click();
  await expect(page).toHaveURL(/\/app\/legal\?view=contracts&q=MOCK\+Insurance\+Policy&group=off$/);

  await page.goto("/app/legal?view=graph&group=off");
  await main.getByRole("button", { name: "Contract: Master Services Agreement" }).click();
  await expect(
    main.getByRole("region", { name: "Relations of Master Services Agreement" }),
  ).toContainText("Customer shall pay the monthly fee.");
  await main.getByRole("link", { name: "Open document" }).first().click();
  preview = page.getByTestId("data-room-preview");
  await expect(
    preview.getByRole("heading", { name: "Master Services Agreement source.txt" }),
  ).toBeVisible();
  await expect(
    preview.getByText(/Fixture document body: Customer shall pay the monthly fee/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Legal" }).click();
  await expect(page).toHaveURL(/\/app\/legal\?view=graph&group=off$/);
  await expect(
    main.getByRole("region", { name: "Relations of Master Services Agreement" }),
  ).toContainText("Customer shall pay the monthly fee.");

  await page.goto("/app/legal?view=deadlines");
  await main.getByRole("link", { name: "Office lease" }).click();
  preview = page.getByTestId("data-room-preview");
  await expect(preview.getByRole("heading", { name: "Office lease source.txt" })).toBeVisible();
  await expect(
    preview.getByText(/Fixture document body: Return the security deposit paperwork/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Legal" }).click();
  await expect(page).toHaveURL(/\/app\/legal\?view=deadlines$/);
});

test("Legal restores every expanded contract group after opening a source", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await mockLegalDataRoom(page);
  await mockLegal(page, { similarContracts: true });
  await signup(page, `legal-groups-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.goto("/app/legal?view=contracts&group=on");
  const groupButtons = page.getByRole("button", { name: "+3 more" });
  await expect(groupButtons).toHaveCount(2);
  await groupButtons.nth(0).click();
  await groupButtons.nth(1).click();
  await expect(groupButtons.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(groupButtons.nth(1)).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("link", { name: "Master Services Agreement" }).first().click();
  const preview = page.getByTestId("data-room-preview");
  await expect(
    preview.getByRole("heading", { name: "Master Services Agreement source.txt" }),
  ).toBeVisible();
  await expect(
    preview.getByText(/Fixture document body: Customer shall pay the monthly fee/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Legal" }).click();
  await expect(page).toHaveURL(/\/app\/legal\?view=contracts&group=on$/);
  const restoredGroups = page.getByRole("button", { name: "+3 more" });
  await expect(restoredGroups).toHaveCount(2);
  await expect(restoredGroups.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(restoredGroups.nth(1)).toHaveAttribute("aria-expanded", "true");
});

test("Legal explains the empty page before asking for document consent", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockLegal(page, { empty: true, consented: false });
  await signup(page, `legal-empty-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-legal").click();
  const main = page.getByRole("main");
  await expect(main.getByText("No contracts yet")).toBeVisible();
  await expect(main.getByRole("link", { name: "Add files" })).toHaveAttribute(
    "href",
    "/app/data-room",
  );
  await expect(main.getByRole("heading", { name: "Let Praci read your documents" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Allow", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "legal-empty");
});
