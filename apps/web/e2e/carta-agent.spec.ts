import { expect, test } from "@playwright/test";
import type { Bot, McpServer } from "@rakazo/contracts";
import { captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("Carta uses the general Agent controls while retaining its specialized agent", async ({
  page,
}, testInfo) => {
  await signup(page, `carta-agent-${Date.now()}@rakazo.test`, "password12", "Carta Test");
  await completeOnboarding(page);
  // The harness routes all provider requests through its offline connector emulator.
  const server = await rpc<McpServer>(page, "mcp/servers/create", {
    slug: "demo-carta",
    name: "Carta",
    transport: "streamable_http",
    endpoint: "https://mcp.app.carta.com/mcp",
  });
  const path = `/app/integrations/mcp/${server.id}`;
  await page.goto(path);
  await expect(page.getByRole("switch", { name: "Allow changes in Carta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await expect(page.getByPlaceholder("Message Carta agent")).toBeVisible();
  const agents = (await rpc<Bot[]>(page, "bots/list", undefined)).filter((bot) =>
    bot.spawnKey?.startsWith("carta-agent:"),
  );
  expect(agents).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`/app/${agents[0].id}$`));
  await expect(
    page.locator("[data-roster-bot-name]").filter({ hasText: "Carta agent" }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "carta-agent-chat");

  await page.goto(path);
  const section = page.getByRole("region", { name: "Agent", exact: true });
  const writes = section.getByRole("switch", { name: "Allow changes in Carta" });
  const share = section.getByRole("switch", { name: /Let other agents use/ });
  await expect(writes).not.toBeChecked();
  await expect(share).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Open Cap table" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create agent", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "carta-agent-defaults");
  await writes.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("It asks before each change.");
  await captureScreenshot(page, testInfo, "carta-agent-confirmation");
  await confirmation.getByRole("button", { name: "Allow changes", exact: true }).click();
  await expect(writes).toBeChecked();
  await share.click();
  await expect(share).toBeChecked();
  await page.reload();
  await expect(writes).toBeChecked();
  await expect(share).toBeChecked();
  await captureScreenshot(page, testInfo, "carta-agent-saved-controls");
  await writes.click();
  await expect(writes).not.toBeChecked();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
