import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("MCP server page shows the Agent section once the server has an agent", async ({
  page,
}, testInfo) => {
  await signup(page, `integration-agent-${Date.now()}@rakazo.test`, "password12", "Agent Test");
  await completeOnboarding(page);
  const { server, botId } = await page.evaluate(async () => {
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
      endpoint: "https://203.0.113.10/mcp",
    });
    const bots = await call("bots/list");
    return { server, botId: bots[0].id as string };
  });
  // The API creates the agent; this spec only needs the page to render one.
  await page.route("**/rpc/mcp/servers/list", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.json = body.json.map((entry: { id: string }) =>
      entry.id === server.id ? { ...entry, agentBotId: botId } : entry,
    );
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/app/integrations/mcp/${server.id}`);
  const section = page.getByRole("region", { name: "Agent" });
  await expect(section.getByRole("switch", { name: "Allow changes in Demo Bank" })).toBeVisible();
  await expect(section.getByRole("switch", { name: "Only this agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create agent" })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "integration-agent-section");
});
