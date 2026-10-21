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
  const mentionCatalogResponse = page.waitForResponse("**/rpc/connections/catalog");
  const composer = page.getByRole("combobox", { name: "Message Chief", exact: true });
  await composer.fill("@Notion");
  expect((await mentionCatalogResponse).ok()).toBe(true);
  await expect(page.getByRole("option", { name: "@Notion", exact: true })).toBeVisible();
  await composer.fill("");
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
  // Creating the server also created its agent, exclusive, with changes on (no integration preset).
  expect(server.agentBotId).toBeTruthy();
  expect(server.agentBotId).not.toBe(firstBotId);
  const agentBotId = server.agentBotId as string;
  await page.goto(`/app/${agentBotId}`);
  await expect(page.getByPlaceholder("Message Demo Bank agent", { exact: true })).toBeVisible();
  const sidebarAgent = page.locator(`[data-roster-bot-id="${agentBotId}"]`);
  await expect(sidebarAgent).toBeVisible();
  await expect(sidebarAgent).toHaveAttribute("aria-current", "page");
  await captureScreenshot(page, testInfo, "integration-agent-created-chat");

  await page.goto(`/app/integrations/mcp/${server.id}`);
  const section = page.getByRole("region", { name: "Agent" });
  await expect(section.getByRole("link", { name: "Demo Bank agent" })).toHaveAttribute(
    "href",
    `/app/${agentBotId}`,
  );
  const writes = section.getByRole("switch", { name: "Allow changes in Demo Bank" });
  const share = section.getByRole("switch", { name: /Let other agents use/ });
  await expect(writes).toBeChecked();
  await expect(share).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Create agent" })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "integration-agent-section");

  await writes.click();
  await expect(writes).not.toBeChecked();
  await writes.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Allow changes in Demo Bank?");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(writes).not.toBeChecked();
  await writes.click();
  await confirmation.getByRole("button", { name: "Allow changes", exact: true }).click();
  await expect(writes).toBeChecked();
  await share.click();
  await expect(share).toBeChecked();
  await page.reload();
  await expect(writes).toBeChecked();
  await expect(share).toBeChecked();
});
