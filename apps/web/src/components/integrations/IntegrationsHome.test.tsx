// @vitest-environment jsdom

import type { ConnectionCatalogItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const financeRpc = vi.hoisted(() => ({
  crypto: vi.fn(),
  exchanges: vi.fn(),
}));
const messagingRpc = vi.hoisted(() => ({ get: vi.fn() }));
const devinRpc = vi.hoisted(() => ({ sessions: vi.fn(), connect: vi.fn(), replaceKey: vi.fn() }));
vi.mock("../../lib/rpc", () => ({
  rpc: { finance: financeRpc, messagingSetup: messagingRpc, devin: devinRpc },
}));

import { IntegrationsHome } from "./IntegrationsHome";
import type { IntegrationsData } from "./useIntegrations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const google = (slug: string): ConnectionCatalogItem => ({
  connectorId: "google",
  slug,
  name: slug,
  logo: null,
  connected: true,
  noAuth: false,
  description: null,
  category: "email_calendar",
});

const data = (canConfigure: boolean, managed: boolean): IntegrationsData => ({
  loaded: true,
  error: null,
  catalog: [google("gmail"), google("googlecalendar"), google("googledrive")],
  connections: [],
  servers: [],
  bots: [],
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: {
    canConfigure,
    needsSetup: false,
    webUrl: "http://localhost",
    providers: [
      { id: "composio", configured: managed },
      { id: "pipedream", configured: false },
      { id: "google", configured: true },
    ],
  },
  catalogFailed: false,
  feedEnabled: false,
  refresh: async () => {},
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
const cryptoMenu = async () => {
  await act(async () =>
    (
      container.querySelector(
        '[data-testid="finance-tile-crypto"] button[aria-label="More Blockscout actions"]',
      ) as HTMLElement
    ).click(),
  );
  return [...document.body.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
};
async function show(value: IntegrationsData, url = "/app/integrations") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <IntegrationsHome data={value} />
        <Where />
      </MemoryRouter>,
    ),
  );
}
beforeEach(() => {
  financeRpc.crypto.mockResolvedValue({
    connected: false,
    hasApiKey: false,
    alchemy: { connected: false, lastError: null },
  });
  financeRpc.exchanges.mockResolvedValue([]);
  messagingRpc.get.mockRejectedValue(new Error("not owner"));
  devinRpc.sessions.mockReset();
  devinRpc.sessions.mockRejectedValue(new Error("not mocked"));
  devinRpc.connect.mockReset();
  devinRpc.replaceKey.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("shows placeholders, not false 'Not connected' tiles, until the page has loaded", async () => {
  await show({ ...data(true, true), loaded: false });
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(container.textContent).not.toContain("Connect Carta");
  expect(container.textContent).not.toContain("Not connected");
});

it("tells the owner to connect a provider when only native Google is configured", async () => {
  await show(data(true, false));
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')?.textContent).toContain(
    "Connect a Composio or Pipedream account to add apps like Slack, Notion and GitHub.",
  );
  expect(
    container.querySelector('a[href="/app/integrations/setup?next=/app/integrations"]')
      ?.textContent,
  ).toBe("Set up app catalog");
  expect(container.querySelector('input[type="search"]')).toBeNull();
  expect(container.querySelector('[aria-label="Category"]')).toBeNull();
  expect(container.textContent).toContain("Add a custom connection");
});

it("tells a member to ask the owner when only native Google is configured", async () => {
  await show(data(false, false));
  const panel = container.querySelector('[data-testid="catalog-not-set-up"]');
  expect(panel?.textContent).toContain("Ask the server owner to set up the app catalog.");
  expect(panel?.querySelector("a")).toBeNull();
  expect(container.querySelector('input[type="search"]')).toBeNull();
});

it("shows search and categories once a managed provider is configured", async () => {
  await show(data(true, true));
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')).toBeNull();
  expect(container.querySelector('input[type="search"]')).not.toBeNull();
});

it("shows a member the catalog once managed apps are in it, though the server lists no providers", async () => {
  const value = data(false, false);
  value.catalog = [...value.catalog, { ...google("slack"), connectorId: "composio" }];
  value.setup = { ...value.setup!, providers: [] };
  await show(value);
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')).toBeNull();
  expect(container.querySelector('input[type="search"]')).not.toBeNull();
});

const zernioServer = {
  id: "s1",
  name: "Zernio",
  endpoint: "https://mcp.zernio.com/mcp",
} as unknown as IntegrationsData["servers"][number];

it("offers Zernio even without an app catalog and opens its sign-in", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Zernio"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Sign in with Zernio");
  expect(document.querySelector('input[aria-label="Server URL"]')).toBeNull();
});

it("hides the Zernio tile once its server is connected", async () => {
  await show({ ...data(true, true), servers: [zernioServer] });
  expect(container.querySelector('[aria-label="Connect Zernio"]')).toBeNull();
});

it("shows a connected Carta by what it does, with a way to its page", async () => {
  const carta = {
    id: "s2",
    name: "Carta",
    endpoint: "https://mcp.app.carta.com/mcp",
  } as unknown as IntegrationsData["servers"][number];
  await show({ ...data(true, true), servers: [carta] });
  expect(container.textContent).toContain("Cap table, equity and investors");
  expect(container.textContent).not.toContain("mcp.app.carta.com");
  expect(container.querySelector('a[href="/app/investors"]')?.textContent).toBe("Open Investors");
});

it("offers Carta and opens its sign-in dialog", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Carta"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  expect(document.body.textContent).toContain("Sign in with Carta");
});

it("offers Devin and opens its own connect dialog, not the custom connection form", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Devin"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  expect(document.body.textContent).toContain(
    "Connects Devin for everyone in this space. Read-only.",
  );
  expect(document.querySelector('[aria-label="Organization service-user key"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="API key"]')).toBeNull();
  expect(document.querySelector('input[aria-label="Server URL"]')).toBeNull();
  expect(document.body.textContent).not.toContain("starts with cog_");
});

const devinServer = {
  id: "s3",
  name: "Devin",
  endpoint: "https://mcp.devin.ai/mcp",
} as unknown as IntegrationsData["servers"][number];
const devinSessions = (status: string, manage = true, isConnector = manage) => ({
  connection: { status, manage, canConnect: false, isConnector, agentBotId: null },
  fetchedAt: null,
  stale: false,
  partial: false,
  sessions: [],
});

it("shows a connected Devin with a way to its page", async () => {
  devinRpc.sessions.mockResolvedValue(devinSessions("ok"));
  await show({ ...data(true, true), servers: [devinServer] });
  expect(container.querySelector('a[href="/app/devin"]')?.textContent).toBe("Open Devin");
  expect(container.textContent).not.toContain("Needs reconnect");
});

it("marks a rejected Devin key as needing reconnect and lets an owner replace it", async () => {
  devinRpc.sessions.mockResolvedValue(devinSessions("rejected"));
  await show({ ...data(true, true), servers: [devinServer] });
  expect(container.textContent).toContain("Needs reconnect");
  expect(container.querySelector('a[href="/app/devin"]')).toBeNull();
  const reconnect = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Reconnect",
  );
  await act(async () => reconnect?.click());
  devinRpc.replaceKey.mockResolvedValue({ ok: true });
  const field = document.querySelector<HTMLInputElement>(
    '[aria-label="Organization service-user key"]',
  );
  expect(field).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, "k");
    field?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    document.querySelector<HTMLButtonElement>('button[type="submit"]')?.click(),
  );
  expect(devinRpc.replaceKey).toHaveBeenCalledWith({ secret: "k" });
  expect(devinRpc.connect).not.toHaveBeenCalled();
});

it("treats a private Devin server as a plain one when another member connected the space", async () => {
  devinRpc.sessions.mockResolvedValue(devinSessions("rejected", true, false));
  await show({ ...data(true, true), servers: [devinServer] });
  expect(container.textContent).not.toContain("Needs reconnect");
  expect(container.querySelector('a[href="/app/devin"]')).toBeNull();
});

it("gives a demoted connector no Reconnect button when the Devin key is rejected", async () => {
  devinRpc.sessions.mockResolvedValue(devinSessions("rejected", false, true));
  await show({ ...data(true, true), servers: [devinServer] });
  expect(container.textContent).toContain("Needs reconnect");
  const buttons = [...container.querySelectorAll("button")].map((button) => button.textContent);
  expect(buttons).not.toContain("Reconnect");
});

it("offers Box and asks for the Box app's client ID, secret and callback URL", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Box"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  expect(document.querySelector('input[aria-label="Client ID"]')).not.toBeNull();
  expect(document.querySelector('input[aria-label="Callback URL"]')).not.toBeNull();
  expect(document.querySelector('input[aria-label="Server URL"]')).toBeNull();
});

it("offers Granola and Wispr Flow with their descriptions and no key or client fields", async () => {
  await show(data(true, false));
  for (const name of ["Granola", "Wispr Flow"]) {
    expect(container.querySelector(`[aria-label="Connect ${name}"]`)).not.toBeNull();
  }
  expect(container.textContent).toContain("Meeting notes and transcripts");
  expect(container.textContent).toContain("Notetaker meetings, notes and tasks");
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Granola"]');
  await act(async () => connect?.click());
  expect(document.querySelector('input[aria-label="Client ID"]')).toBeNull();
  expect(document.querySelector('[aria-label="API key"]')).toBeNull();
});

it("shows Carta but not Zernio under the Finance chip", async () => {
  await show(data(true, true));
  const chip = [...container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find(
    (b) => b.textContent === "Finance",
  );
  expect(chip).toBeDefined();
  await act(async () => chip?.click());
  expect(container.querySelector('[aria-label="Connect Carta"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Connect Zernio"]')).toBeNull();
});

it("opens the Treg token form from its tile", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Treg"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  // Treg connects with an API token, under a dialog named for it.
  expect(document.querySelector('input[aria-label="Token"]')).not.toBeNull();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Connect Treg");
  expect(dialog?.textContent).not.toContain("Add a custom connection");
});

it("hides the Treg tile once the token preset source is installed", async () => {
  const source = {
    id: "src1",
    kind: "mcp",
    name: "Treg",
    source: "https://treg.to/mcp/",
    version: null,
    digest: null,
    secretConfigured: true,
    config: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["sources"][number];
  await show({ ...data(true, false), sources: [source] });
  expect(container.querySelector('[aria-label="Connect Treg"]')).toBeNull();
});

it("opens the X tile with the client ID fields and no server URL", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect X"]');
  await act(async () => connect?.click());
  expect(document.querySelector('input[aria-label="Server URL"]')).toBeNull();
  expect(document.querySelector('[aria-label="Client ID"]')).not.toBeNull();
});

const inConnected = (testId: string) => {
  const heading = [...container.querySelectorAll("h2")].find((h) => h.textContent === "Connected");
  return Boolean(heading?.nextElementSibling?.querySelector(`[data-testid="${testId}"]`));
};
const count = (testId: string) => container.querySelectorAll(`[data-testid="${testId}"]`).length;
const financeHeading = () =>
  [...container.querySelectorAll("h2")].some((h) => h.textContent === "Finance");

const cryptoOn = {
  connected: true,
  hasApiKey: true,
  alchemy: { connected: false, lastError: null },
};

it("shows a connected Mercury once, under Connected, with its actions", async () => {
  const value = data(true, true);
  value.catalog = [];
  value.financeSources = [
    { provider: "mercury", serverId: "s1", status: "ok", lastSyncedAt: null },
  ];
  await show(value);
  expect(count("finance-tile-mercury")).toBe(1);
  expect(inConnected("finance-tile-mercury")).toBe(true);
  expect(container.querySelector('[data-testid="finance-tile-mercury"]')?.textContent).toContain(
    "Open Finance",
  );
  expect(container.querySelector('[data-testid="finance-tile-brex"]')).not.toBeNull();
  expect(inConnected("finance-tile-brex")).toBe(false);
});

it("shows connected crypto and exchanges once, under Connected", async () => {
  financeRpc.crypto.mockResolvedValue({
    ...cryptoOn,
    alchemy: { connected: true, lastError: null },
  });
  financeRpc.exchanges.mockResolvedValue([{ provider: "kraken", connected: true }]);
  await show(data(true, true));
  for (const id of ["crypto", "alchemy", "kraken"]) {
    expect(count(`finance-tile-${id}`)).toBe(1);
    expect(inConnected(`finance-tile-${id}`)).toBe(true);
  }
  expect(inConnected("finance-tile-coinbase")).toBe(false);
  expect(
    container.querySelector('[data-testid="finance-tile-alchemy"] a')?.getAttribute("href"),
  ).toBe("/app/finance/crypto");
});

it("keeps Alchemy and exchanges that report an error under Finance", async () => {
  financeRpc.crypto.mockResolvedValue({
    ...cryptoOn,
    alchemy: { connected: true, lastError: "The key was refused" },
  });
  financeRpc.exchanges.mockResolvedValue([
    { provider: "kraken", connected: true, lastError: "Read failed" },
  ]);
  await show(data(true, true));
  for (const id of ["alchemy", "kraken"]) {
    expect(count(`finance-tile-${id}`)).toBe(1);
    expect(inConnected(`finance-tile-${id}`)).toBe(false);
  }
  expect(container.textContent).toContain("The key was refused");
});

it("shows one Blockscout tile when its key and MCP server both exist", async () => {
  financeRpc.crypto.mockResolvedValue(cryptoOn);
  const blockscoutServer = {
    ...zernioServer,
    id: "s2",
    name: "Blockscout",
    endpoint: "https://mcp.blockscout.com/mcp",
  } as unknown as IntegrationsData["servers"][number];
  await show({ ...data(true, true), servers: [blockscoutServer] });
  expect(count("finance-tile-crypto")).toBe(1);
  expect(inConnected("finance-tile-crypto")).toBe(true);
  expect(container.textContent).not.toContain("mcp.blockscout.com");
  // The key and the agents sit in the menu, so the tile has one button row like its neighbours.
  const items = await cryptoMenu();
  expect(items.map((item) => item.textContent)).toEqual(["Replace API key", "Manage agents"]);
  await act(async () => items[1]?.click());
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/mcp/s2",
  );
});

it("shows one Blockscout tile, asking for the key, when its MCP server has none", async () => {
  financeRpc.crypto.mockResolvedValue({ ...cryptoOn, hasApiKey: false });
  const blockscoutServer = {
    ...zernioServer,
    id: "s2",
    name: "Blockscout",
    endpoint: "https://mcp.blockscout.com/mcp",
  } as unknown as IntegrationsData["servers"][number];
  await show({ ...data(true, true), servers: [blockscoutServer] });
  expect(count("finance-tile-crypto")).toBe(1);
  expect(inConnected("finance-tile-crypto")).toBe(true);
  expect(container.textContent).not.toContain("mcp.blockscout.com");
  const tile = container.querySelector('[data-testid="finance-tile-crypto"]');
  // Keyless Blockscout still reads balances, so it shows as connected and offers the optional key.
  expect(tile?.textContent).toContain("Connected");
  expect((await cryptoMenu()).map((item) => item.textContent)).toEqual([
    "Add API key",
    "Manage agents",
  ]);
});

it("lists every finance provider under Finance when nothing is connected", async () => {
  const value = data(true, true);
  value.financeSources = [
    { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
  ];
  await show(value);
  expect(financeHeading()).toBe(true);
  for (const id of ["mercury", "brex", "crypto", "alchemy", "coinbase", "kraken"])
    expect(count(`finance-tile-${id}`)).toBe(1);
  expect(container.querySelector('[data-testid="finance-section"]')?.children).toHaveLength(6);
});

it("hides the Finance heading when every provider is connected", async () => {
  financeRpc.crypto.mockResolvedValue({
    ...cryptoOn,
    alchemy: { connected: true, lastError: null },
  });
  financeRpc.exchanges.mockResolvedValue([
    { provider: "coinbase", connected: true },
    { provider: "kraken", connected: true },
  ]);
  const value = data(true, true);
  value.financeSources = [
    { provider: "mercury", serverId: "s1", status: "ok", lastSyncedAt: null },
    { provider: "brex", serverId: "s3", status: "ok", lastSyncedAt: null },
  ];
  await show(value);
  expect(financeHeading()).toBe(false);
  expect(container.querySelector('[data-testid="finance-section"]')).toBeNull();
});

it("names the dialog after the service for a first-party tile", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Carta"]');
  await act(async () => connect?.click());
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Connect Carta");
  expect(dialog?.textContent).not.toContain("Add a custom connection");
  // Carta's URL is known: no server URL or connection settings, just the sign-in.
  expect(dialog?.querySelector('[aria-label="Server URL"]')).toBeNull();
  expect(dialog?.textContent).not.toContain("Advanced");
  expect(dialog?.textContent).toContain("Sign in with Carta");
});

it("opens a first-party sign-in from ?connect= once the page has loaded", async () => {
  await show(data(true, false), "/app/integrations?q=carta&connect=carta");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Connect Carta");
});

it("returns to the page that asked for the sign-in when its dialog closes", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={["/app/integrations?q=carta&connect=carta&returnTo=/app/investors"]}
      >
        <Routes>
          <Route path="/app/integrations" element={<IntegrationsHome data={data(true, false)} />} />
          <Route path="/app/investors" element={<p>cap table page</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  const cancel = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (el) => el.textContent === "Cancel",
  );
  await act(async () => cancel?.click());
  expect(container.textContent).toContain("cap table page");
});

it("opens a catalog app's connect flow from ?connect= and carries the return path", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  function Search() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname + location.search}</output>;
  }
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations?connect=gmail&returnTo=/app/inbox"]}>
        <Routes>
          <Route path="/app/integrations" element={<IntegrationsHome data={data(true, true)} />} />
          <Route path="/app/integrations/app/:connectorId/:slug" element={<Search />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/gmail?connect=1&next=%2Fapp%2Finbox",
  );
});

it("opens a catalog app's page from ?open=, without starting a connect", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  function Search() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname + location.search}</output>;
  }
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations?open=gmail"]}>
        <Routes>
          <Route path="/app/integrations" element={<IntegrationsHome data={data(true, true)} />} />
          <Route path="/app/integrations/app/:connectorId/:slug" element={<Search />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/gmail",
  );
});

it("ignores a returnTo that appReturnPath rejects", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  function Search() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname + location.search}</output>;
  }
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={["/app/integrations?connect=gmail&returnTo=%2Fapp%2F%252e%2Fx"]}
      >
        <Routes>
          <Route path="/app/integrations" element={<IntegrationsHome data={data(true, true)} />} />
          <Route path="/app/integrations/app/:connectorId/:slug" element={<Search />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/app/google/gmail?connect=1",
  );
});

it("still lists native Google apps when the managed catalog is not set up", async () => {
  const value = data(false, false);
  value.catalog = value.catalog.map((item) => ({ ...item, connected: false }));
  await show(value);
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Connect gmail"]')).not.toBeNull();
});

it("shows no vendor name on any tile", async () => {
  const value = data(true, true);
  value.catalog = [
    ...value.catalog,
    { ...google("slack"), connectorId: "composio", name: "Slack" },
    { ...google("notion"), connectorId: "pipedream", name: "Notion" },
  ];
  value.connections = [
    {
      id: "c1",
      connectorId: "composio",
      provider: "trello",
      displayName: "Demo board",
      status: "connected",
      error: null,
      capabilities: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "c2",
      connectorId: "google",
      provider: "gmail",
      displayName: "demo@example.com",
      status: "connected",
      error: null,
      capabilities: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  value.servers = [zernioServer];
  await show(value);
  expect(container.textContent).not.toContain("via ");
});

const composioGmail = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  connectorId: "composio",
  provider: "gmail",
  displayName: "Gmail",
  status: "connected" as const,
  error: null,
  capabilities: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

it("offers Reconnect on a connected Composio tile that needs it, and hides the repeated name", async () => {
  const value = data(true, true);
  value.catalog = [{ ...google("gmail"), connectorId: "composio", name: "Gmail" }];
  value.connections = [composioGmail({ needsReconnect: true })];
  await show(value);
  const tile = container.querySelector("main, div")?.textContent ?? "";
  expect(tile).toContain("Needs reconnect");
  const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(buttons).toContain("Reconnect");
  // The account label equals the app name, so it is not shown a second time.
  expect(container.textContent?.match(/Gmail/g)?.length).toBe(1);
});

it("shows no Reconnect on a healthy Composio tile", async () => {
  const value = data(true, true);
  value.catalog = [{ ...google("gmail"), connectorId: "composio", name: "Gmail" }];
  value.connections = [composioGmail()];
  await show(value);
  expect([...container.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(
    "Reconnect",
  );
});

it("hides category chips that have no apps", async () => {
  const value = data(true, true);
  value.catalog = [
    { ...google("slack"), connectorId: "composio", name: "Slack", connected: false },
  ];
  await show(value);
  const chips = [...container.querySelectorAll("fieldset button")].map((b) => b.textContent);
  expect(chips).toContain("Email & calendar");
  expect(chips).not.toContain("Sales & CRM");
});

it("lists results as one flat grid without headings and hides Connected while searching", async () => {
  const value = data(true, true);
  value.catalog = [
    { ...google("slack"), connectorId: "composio", name: "Slack", connected: false },
  ];
  value.connections = [composioGmail()];
  await show(value, "/app/integrations?q=sla");
  const headings = [...container.querySelectorAll("h2")].map((h) => h.textContent);
  expect(headings).not.toContain("Integrations");
  expect(headings).not.toContain("Connected");
  expect(container.textContent).toContain("Slack");
});

it("does not say 'No apps match' while iMessage tiles match the search", async () => {
  messagingRpc.get.mockResolvedValue({
    canConfigure: true,
    providers: [
      { id: "photon", fields: {}, configured: false, active: false, webhookUrl: "http://x/p" },
      { id: "bluebubbles", fields: {}, configured: false, active: false, webhookUrl: "http://x/b" },
    ],
  });
  await show(data(true, true), "/app/integrations?q=imessage");
  expect(container.textContent).toContain("iMessage");
  expect(container.querySelector('[data-testid="no-apps"]')).toBeNull();
});

it("still says 'No apps match' when nothing matches", async () => {
  await show(data(true, true), "/app/integrations?q=zzzz");
  expect(container.querySelector('[data-testid="no-apps"]')).not.toBeNull();
});

it("keeps matching connected apps visible while a category chip is active", async () => {
  const value = data(true, true);
  value.catalog = [
    ...value.catalog,
    { ...google("notion"), connectorId: "composio", name: "Notion", category: "docs_files" },
  ];
  value.connections = [
    composioGmail(),
    composioGmail({ id: "n1", provider: "notion", displayName: "Notion" }),
  ];
  await show(value, "/app/integrations");
  const chip = [...container.querySelectorAll("fieldset button")].find(
    (b) => b.textContent === "Docs & files",
  ) as HTMLElement;
  await act(async () => chip.click());
  const connected = [...container.querySelectorAll("h2")].find(
    (h) => h.textContent === "Connected",
  );
  expect(connected).toBeDefined();
  expect(container.querySelector('a[href*="notion"]')).not.toBeNull();
  expect(container.querySelector('a[href*="gmail"]')).toBeNull();
});

it("lists a connected app with its card when its name is searched", async () => {
  const value = data(true, true);
  value.catalog = [
    { ...google("notion"), connectorId: "composio", name: "Notion", category: "docs_files" },
  ];
  value.connections = [composioGmail({ id: "n1", provider: "notion", displayName: "Notion" })];
  await show(value, "/app/integrations?q=notion");
  expect(container.querySelector('a[href*="notion"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="no-apps"]')).toBeNull();
});

const granolaServer = {
  id: "srv_granola",
  name: "Granola",
  transport: "http",
  endpoint: "https://mcp.granola.ai/mcp",
  oauthStatus: "connected",
  oauthAttempted: false,
  enabled: true,
} as unknown as IntegrationsData["servers"][number];
const keyRoute = (patch: Partial<NonNullable<IntegrationsData["meetings"]>> = {}) => ({
  connectionId: "conn_1",
  status: "connected" as const,
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 4,
  consentOff: false,
  agentBotId: null,
  ...patch,
});

it("shows one Granola status line: reconnect first, then AI data sharing off, then the key status", async () => {
  await show({
    ...data(true, true),
    servers: [granolaServer],
    meetings: keyRoute({ status: "needs_reconnect", consentOff: true }),
  });
  const text = container.textContent ?? "";
  expect(text).toContain("Reconnect needed");
  expect(text).not.toContain("AI data sharing off");
  expect(text).not.toContain("Synced");
  expect(container.querySelector('a[href="/app/integrations/granola"]')).not.toBeNull();
});

it("shows AI data sharing off, then Synced, then the sign-in badge on the Granola tile", async () => {
  await show({
    ...data(true, true),
    servers: [granolaServer],
    meetings: keyRoute({ consentOff: true }),
  });
  expect(container.textContent).toContain("AI data sharing off");
  expect(container.textContent).not.toContain("Synced 4 meetings");
  act(() => root.unmount());
  container.remove();
  await show({ ...data(true, true), servers: [granolaServer], meetings: keyRoute() });
  expect(container.textContent).toContain("Synced 4 meetings");
  act(() => root.unmount());
  container.remove();
  await show({
    ...data(true, true),
    servers: [granolaServer],
    meetings: keyRoute({ status: "disconnected" }),
  });
  expect(container.textContent).not.toContain("Synced");
  expect(container.textContent).toContain("Connected");
});

it("shows a Granola tile when only the key is connected, and opens the page from the Connect tile", async () => {
  await show({ ...data(true, true), meetings: keyRoute() });
  expect(container.textContent).toContain("Synced 4 meetings");
  expect(container.querySelector('a[href="/app/integrations/granola"]')).not.toBeNull();
  expect(container.querySelector('button[aria-label="Connect Granola"]')).toBeNull();
  act(() => root.unmount());
  container.remove();
  await show(data(true, true));
  await act(async () =>
    (container.querySelector('button[aria-label="Connect Granola"]') as HTMLElement).click(),
  );
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app/integrations/granola",
  );
});
