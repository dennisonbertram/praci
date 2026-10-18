import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("creates an integration agent, opens its chat, and persists its permissions", async ({
  page,
}, testInfo) => {
  const catalogRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/rpc/connections/catalog") {
      catalogRequests.push(request.url());
    }
  });
  await signup(page, `integration-agent-${Date.now()}@rakazo.test`, "password12", "Agent Test");
  await completeOnboarding(page);
  await expect(page.getByTestId("sidebar-integrations")).toHaveText("Connect apps");
  expect(catalogRequests).toHaveLength(0);
  await captureScreenshot(page, testInfo, "featured-connect-apps");
  const catalogResponse = page.waitForResponse("**/rpc/connections/catalog");
  await page.getByTestId("sidebar-integrations").click();
  expect((await catalogResponse).ok()).toBe(true);
  expect(catalogRequests.length).toBeGreaterThan(0);
  const { server, firstBotId } = await page.evaluate(async () => {
    const headers = {
      "content-type": "application/json",
      "x-rakazo-space-id": localStorage.getItem("rakazo:space-id") ?? "",
    };
    const call = async (path: string, json?: unknown) => {
      const response = await fetch(`/rpc/${path}`, {
        method: "POST",
        headers,
        body: json === undefined ? undefined : JSON.stringify({ json }),
      });
      if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
      return (await response.json()).json;
    };
    const server = await call("mcp/servers/create", {
      slug: "demo-bank",
      name: "Demo Bank",
      transport: "streamable_http",
      endpoint: "https://mcp.example.test/mcp",
    });
    const bots = await call("bots/list");
    return { server, firstBotId: bots[0].id as string };
  });
  expect(server.agentBotId).toBeNull();
  expect(firstBotId).toBeTruthy();
  await page.goto(`/app/integrations/mcp/${server.id}`);
  const createdResponse = page.waitForResponse("**/rpc/integrationAgents/create");
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  const response = await createdResponse;
  expect(response.ok()).toBe(true);
  const { json: created } = await response.json();
  expect(created.botId).toBeTruthy();
  expect(created.botId).not.toBe(firstBotId);
  await expect(page).toHaveURL(new RegExp(`/app/${created.botId}$`));
  await expect(page.getByPlaceholder("Message Demo Bank agent", { exact: true })).toBeVisible();
  const sidebarAgent = page.locator(`[data-roster-bot-id="${created.botId}"]`);
  await expect(sidebarAgent).toBeVisible();
  await expect(sidebarAgent).toHaveAttribute("aria-current", "page");
  await expect(page.locator(`[data-roster-bot-id="${firstBotId}"]`)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await captureScreenshot(page, testInfo, "integration-agent-created-chat");

  await page.goto(`/app/integrations/mcp/${server.id}`);
  const section = page.getByRole("region", { name: "Agent" });
  await expect(section.getByRole("link", { name: "Demo Bank agent" })).toHaveAttribute(
    "href",
    `/app/${created.botId}`,
  );
  const writes = section.getByRole("switch", { name: "Allow changes in Demo Bank" });
  const exclusive = section.getByRole("switch", { name: "Only this agent" });
  await expect(writes).not.toBeChecked();
  await expect(exclusive).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Create agent" })).toHaveCount(0);

  await writes.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Allow changes in Demo Bank?");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(writes).not.toBeChecked();
  await writes.click();
  await confirmation.getByRole("button", { name: "Allow changes", exact: true }).click();
  await expect(writes).toBeChecked();
  await exclusive.click();
  await expect(exclusive).toBeChecked();
  await page.reload();
  await expect(writes).toBeChecked();
  await expect(exclusive).toBeChecked();
  await captureScreenshot(page, testInfo, "integration-agent-section");

  await writes.click();
  await expect(writes).not.toBeChecked();
  await exclusive.click();
  await expect(exclusive).not.toBeChecked();
  await page.reload();
  await expect(writes).not.toBeChecked();
  await expect(exclusive).not.toBeChecked();
});
