import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  consentFixture,
  contracts,
  deadlines,
  emptyOverview,
  graph,
  overview,
} from "../src/pages/legal/fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Answers the Legal RPCs with synthetic data; everything else (sign-up, bots) is the real stack. */
async function mockLegal(page: Page, options: { empty?: boolean; consented?: boolean } = {}) {
  const calls: { name: string; input: unknown }[] = [];
  let consented = options.consented ?? true;
  await page.route("**/rpc/legal/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/legal/")[1] ?? "";
    const input = (route.request().postDataJSON() as { json?: unknown } | null)?.json;
    calls.push({ name, input });
    if (name === "consentGrant") consented = true;
    const answers: Record<string, unknown> = {
      // An empty page still has its agent on the preferred model, so consent is what gates a scan.
      overview: options.empty ? { ...emptyOverview, model: overview.model } : overview,
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

test("Legal shows contracts, deadlines and the graph", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const calls = await mockLegal(page);
  await signup(page, `legal-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-legal").click();
  await expect(page).toHaveURL(/\/app\/legal$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Legal", level: 1 })).toBeVisible();
  await expect(main.getByRole("cell", { name: "$50,000" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Master Services Agreement" })).toHaveAttribute(
    "href",
    /\/app\/data-room\?item=/,
  );
  await captureScreenshot(page, testInfo, "legal-contracts");

  await main.getByRole("tab", { name: "Deadlines" }).click();
  await expect(main.getByText(/Overdue by \d+ day/)).toBeVisible();
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

test("Legal asks for consent before scanning, and explains an empty page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const calls = await mockLegal(page, { empty: true, consented: false });
  await signup(page, `legal-empty-${Date.now()}@rakazo.test`, "password12", "Legal User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-legal").click();
  const main = page.getByRole("main");
  await expect(main.getByText("Let the Legal agent read your documents")).toBeVisible();
  await expect(main.getByText(/Allow access above to start\./)).toBeVisible();
  await expect(main.getByText(/Muse Spark 1\.2, through your OpenRouter key/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Scan now", exact: true }).first()).toBeDisabled();
  await captureScreenshot(page, testInfo, "legal-consent");

  await main.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(main.getByText("Let the Legal agent read your documents")).toHaveCount(0);
  expect(calls.find((c) => c.name === "consentGrant")?.input).toEqual({ key: "k1", version: "v1" });
});
