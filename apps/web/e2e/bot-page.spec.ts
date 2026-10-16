import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

const chart = {
  name: "Weekly sales",
  spec: {
    marks: [{ type: "barY", options: { x: "week", y: "sales" } }],
  },
  data: [
    { week: "W1", sales: 4 },
    { week: "W2", sales: 7 },
    { week: "W3", sales: 5 },
  ],
};

const content = [
  "# Weekly summary",
  "",
  "| Team | Count |",
  "| ---- | ----- |",
  "| Alpha | 12 |",
  "",
  "```chart",
  JSON.stringify(chart),
  "```",
  "",
  "Notes.",
].join("\n");

type Page = { revision: number; content: string };

test("a bot's page opens from the Page control, renders, and saves edits", async ({
  page,
}, testInfo) => {
  await signup(page, `bot-page-${Date.now()}@rakazo.test`, "password12", "Bot Page");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message Chief")).toBeVisible();
  const botId = activeBotId(page);

  // No page yet: no Page control.
  await expect(page.getByRole("button", { name: "Agent computer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page", exact: true })).toHaveCount(0);

  const saved = await rpc<{ ok: boolean }>(page, "pages/save", {
    botId,
    content,
    baseRevision: 0,
  });
  expect(saved.ok).toBe(true);
  await page.reload();

  await page.getByRole("button", { name: "Page", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Weekly summary" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Alpha" })).toBeVisible();
  await expect(page.locator('[role="textbox"][aria-label="Page"] svg').first()).toBeVisible();
  await captureScreenshot(page, testInfo, "bot-page");

  const editor = page.getByRole("textbox", { name: "Page" });
  await editor.getByText("Notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited by hand");
  await expect
    .poll(async () => (await rpc<Page | null>(page, "pages/get", { botId }))?.content)
    .toContain("Notes. Edited by hand");
  const after = await rpc<Page>(page, "pages/get", { botId });
  expect(after.revision).toBe(2);
  expect(after.content).toContain("```chart");
});
