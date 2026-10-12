import { expect, type Route, test } from "@playwright/test";
import type { McpServer } from "@rakazo/contracts";
import { MCP_OAUTH_CHANNEL } from "../src/lib/mcp-connect";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("connects an MCP server through the OAuth popup callback", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `mcp-oauth-${stamp}@rakazo.test`, "password12", "MCP OAuth");
  await completeOnboarding(page);

  let oauthStatus: McpServer["oauthStatus"] = "none";
  let hasSecret = false;
  const server: McpServer = {
    id: "mcp-oauth-server",
    spaceId: "mcp-oauth-workspace",
    slug: "linear",
    name: "Linear MCP",
    description: "",
    transport: "streamable_http",
    endpoint: "https://mcp.linear.test/mcp",
    command: null,
    args: [],
    envKeys: [],
    headerKeys: [],
    hasSecret,
    oauthStatus,
    enabled: true,
    revision: 1,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
  const browserOrigin = new URL(page.url()).origin;
  let releaseCompletion = () => {};
  let markCompletionStarted = () => {};
  const completionGate = new Promise<void>((resolve) => {
    releaseCompletion = resolve;
  });
  const completionStarted = new Promise<void>((resolve) => {
    markCompletionStarted = resolve;
  });

  await page.context().route("**/rpc/mcp/servers/list", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: [{ ...server, hasSecret, oauthStatus }] }),
    });
  });
  await page.context().route("**/rpc/mcp/assignments/all", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ json: [] }) });
  });
  await page.context().route("**/rpc/mcp/oauth/begin", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      json: {
        serverId: server.id,
        redirectUri: `${browserOrigin}/mcp/oauth/callback`,
      },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: {
          status: "authorization_required",
          sessionId: "mcp-oauth-session",
          authorizationUrl: `${browserOrigin}/mcp/oauth/callback?code=fake-code&state=mcp-oauth-session`,
        },
      }),
    });
  });
  await page.context().route("**/rpc/mcp/oauth/complete", async (route: Route) => {
    expect(route.request().postDataJSON()).toEqual({
      json: {
        sessionId: "mcp-oauth-session",
        code: "fake-code",
        state: "mcp-oauth-session",
      },
    });
    markCompletionStarted();
    await completionGate;
    oauthStatus = "connected";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true } }),
    });
  });

  await page.getByText("Integrations", { exact: true }).click();
  await page.getByTestId("integrations-advanced").evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  await page.getByRole("button", { name: "Manage MCP servers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "MCP servers" })).toBeVisible();
  await expect(page.getByText("Linear MCP", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Access token (optional)")).toBeHidden();
  await captureScreenshot(page, testInfo, "mcp-oauth-ready");

  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("Access token (optional)")).toBeVisible();
  await page.getByText("Advanced", { exact: true }).click();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect OAuth", exact: true }).click();
  const popup = await popupPromise;
  await completionStarted;
  await expect(popup.getByText("Finishing MCP connection…", { exact: true })).toBeVisible();
  await captureScreenshot(popup, testInfo, "mcp-oauth-callback");

  releaseCompletion();
  await expect(page.getByText("OAuth connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reconnect OAuth", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await captureScreenshot(page, testInfo, "mcp-oauth-connected");

  oauthStatus = "reconnect";
  hasSecret = true;
  await page.evaluate((channelName) => {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({ type: "mcp-oauth-complete" });
    channel.close();
  }, MCP_OAUTH_CHANNEL);
  await expect(page.getByText("OAuth expired", { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "mcp-oauth-expired");
});

function mcpRow(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "managed-server",
    spaceId: "managed-workspace",
    slug: "integration-1",
    name: "MCP server",
    description: "",
    transport: "streamable_http",
    endpoint: "https://api.brex.test/mcp",
    command: null,
    args: [],
    envKeys: [],
    headerKeys: [],
    hasSecret: true,
    oauthStatus: "connected",
    enabled: true,
    revision: 1,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

test("manages a connected MCP server from Integrations: reconnect, rename, remove", async ({
  page,
}, testInfo) => {
  await signup(page, `mcp-manage-${Date.now()}@rakazo.test`, "password12", "MCP Manage");
  await completeOnboarding(page);

  let servers: McpServer[] = [mcpRow()];
  const browserOrigin = new URL(page.url()).origin;
  const begins: unknown[] = [];
  const renames: unknown[] = [];
  const removes: unknown[] = [];
  let reconnectDone = false;

  await page
    .context()
    .route("**/rpc/mcp/servers/list", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ json: servers }) }),
    );
  await page.context().route("**/rpc/mcp/oauth/begin", async (route) => {
    begins.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: {
          status: "authorization_required",
          sessionId: "mcp-manage-session",
          authorizationUrl: `${browserOrigin}/mcp/oauth/callback?code=fake-code&state=mcp-manage-session`,
        },
      }),
    });
  });
  await page.context().route("**/rpc/mcp/oauth/complete", async (route) => {
    reconnectDone = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true } }),
    });
  });
  await page.context().route("**/rpc/mcp/servers/rename", async (route) => {
    const body = route.request().postDataJSON() as { json: { id: string; name: string } };
    renames.push(body);
    servers = servers.map((server) =>
      server.id === body.json.id ? { ...server, name: body.json.name } : server,
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: servers[0] }),
    });
  });
  await page.context().route("**/rpc/mcp/servers/remove", async (route) => {
    const body = route.request().postDataJSON() as { json: { id: string } };
    removes.push(body);
    servers = servers.filter((server) => server.id !== body.json.id);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true } }),
    });
  });

  await page.getByText("Integrations", { exact: true }).click();
  const list = page.getByTestId("connected-mcp-servers");
  await expect(list.getByText("MCP server", { exact: true })).toBeVisible();

  // Reconnect asks the API to start a fresh authorization even though a token exists.
  await list.getByRole("button", { name: "Manage MCP server" }).click();
  await captureScreenshot(page, testInfo, "mcp-manage-menu");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("menuitem", { name: "Reconnect" }).click();
  const popup = await popupPromise;
  await expect.poll(() => reconnectDone).toBe(true);
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(begins).toEqual([
    {
      json: {
        serverId: "managed-server",
        redirectUri: `${browserOrigin}/mcp/oauth/callback`,
        reauthorize: true,
      },
    },
  ]);
  await expect(list.getByText("MCP server", { exact: true })).toBeVisible();

  await list.getByRole("button", { name: "Manage MCP server" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const nameInput = list.getByRole("textbox", { name: "Name" });
  await expect(nameInput).toHaveValue("MCP server");
  // Typing without clicking proves the menu closing did not take focus back.
  await expect(nameInput).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Brex");
  await page.keyboard.press("Enter");
  await expect(list.getByText("Brex", { exact: true })).toBeVisible();
  expect(renames).toEqual([{ json: { id: "managed-server", name: "Brex" } }]);

  await list.getByRole("button", { name: "Manage Brex" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Remove Brex?")).toBeVisible();
  await captureScreenshot(page, testInfo, "mcp-manage-remove-confirm");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("connected-mcp-servers")).toHaveCount(0);
  expect(removes).toEqual([{ json: { id: "managed-server" } }]);
});

test("adds an MCP server by URL under a readable name without Continue or Skip", async ({
  page,
}) => {
  await signup(page, `mcp-add-${Date.now()}@rakazo.test`, "password12", "MCP Add");
  await completeOnboarding(page);

  let servers: McpServer[] = [];
  const created: unknown[] = [];
  await page
    .context()
    .route("**/rpc/mcp/servers/list", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ json: servers }) }),
    );
  await page.context().route("**/rpc/mcp/servers/create", async (route) => {
    const body = route.request().postDataJSON() as { json: { name: string; endpoint: string } };
    created.push(body.json.name);
    servers = [mcpRow({ name: body.json.name, endpoint: body.json.endpoint })];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: servers[0] }),
    });
  });
  await page.context().route("**/rpc/mcp/oauth/begin", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { status: "already_connected" } }),
    }),
  );
  // The mocked server has no database row, so the real approve call would fail.
  await page
    .context()
    .route("**/rpc/mcp/assignments/approve", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ json: {} }) }),
    );

  await page.getByText("Integrations", { exact: true }).click();
  await page.getByRole("button", { name: "Browse MCP servers" }).click();
  await page.getByText("Add server URL", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Server URL" }).fill("https://api.brex.test/mcp");
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  const list = page.getByTestId("connected-mcp-servers");
  await expect(list.getByText("Brex", { exact: true })).toBeVisible();
  expect(created).toEqual(["Brex"]);
  await expect(page.getByRole("textbox", { name: "Server URL" })).toBeHidden();
});
