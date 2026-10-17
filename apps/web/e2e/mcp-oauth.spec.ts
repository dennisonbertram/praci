import { expect, type Route, test } from "@playwright/test";
import type { McpServer } from "@rakazo/contracts";
import { captureScreenshot, completeOnboarding, openIntegrations, signup } from "./helpers";

test("connects an MCP server through the OAuth popup callback", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `mcp-oauth-${stamp}@rakazo.test`, "password12", "MCP OAuth");
  await completeOnboarding(page);

  let oauthStatus: McpServer["oauthStatus"] = "none";
  // A sign-in was started and never finished.
  let oauthAttempted = true;
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
    oauthAttempted,
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
      body: JSON.stringify({ json: [{ ...server, hasSecret, oauthStatus, oauthAttempted }] }),
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
        reauthorize: true,
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
    oauthAttempted = false;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true } }),
    });
  });

  await openIntegrations(page);
  // A server whose sign-in was started and never finished reads as needing a reconnect, with Reconnect inline.
  const card = page.getByRole("main");
  await expect(card.getByText("Needs reconnect", { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "mcp-oauth-ready");

  const popupPromise = page.waitForEvent("popup");
  await card.getByRole("button", { name: "Reconnect", exact: true }).click();
  const popup = await popupPromise;
  await completionStarted;
  await expect(popup.getByText("Finishing MCP connection…", { exact: true })).toBeVisible();
  await captureScreenshot(popup, testInfo, "mcp-oauth-callback");

  releaseCompletion();
  await expect(card.locator('[data-status="connected"]')).toBeVisible();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await captureScreenshot(page, testInfo, "mcp-oauth-connected");

  oauthStatus = "reconnect";
  oauthAttempted = false;
  hasSecret = true;
  await page.reload();
  await expect(card.getByText("Needs reconnect", { exact: true })).toBeVisible();
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
    oauthAttempted: false,
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

  await openIntegrations(page);
  await page.getByRole("link", { name: "MCP server", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/integrations\/mcp\/managed-server$/);
  await expect(page.getByRole("heading", { name: "MCP server", level: 1 })).toBeVisible();

  // Reconnect asks the API to start a fresh authorization even though a token exists.
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
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

  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const nameInput = page.getByRole("textbox", { name: "Name" });
  await expect(nameInput).toHaveValue("MCP server");
  await expect(nameInput).toBeFocused();
  // Escape cancels only the rename.
  await page.keyboard.press("Escape");
  await expect(nameInput).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "MCP server", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Brex");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Brex", level: 1 })).toBeVisible();
  expect(renames).toEqual([{ json: { id: "managed-server", name: "Brex" } }]);
  await captureScreenshot(page, testInfo, "mcp-manage-detail");

  await page.getByRole("button", { name: "Remove Brex", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Remove Brex?")).toBeVisible();
  await captureScreenshot(page, testInfo, "mcp-manage-remove-confirm");
  await dialog.getByRole("button", { name: "Remove Brex", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/integrations$/);
  await expect(page.getByRole("link", { name: "Brex", exact: true })).toHaveCount(0);
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
  await openIntegrations(page);
  await page.getByRole("button", { name: "Add custom connection", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Server URL" }).fill("https://api.brex.test/mcp");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  // The server needs no browser sign-in, so the dialog moves straight to choosing agents.
  await expect(dialog.getByText("Which bots can use Brex?")).toBeVisible();
  await dialog.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(dialog.getByText("Brex connected", { exact: true })).toBeVisible();
  expect(created).toEqual(["Brex"]);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("link", { name: "Brex", exact: true })).toBeVisible();
});
