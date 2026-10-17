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
vi.mock("../../lib/rpc", () => ({ rpc: { finance: financeRpc } }));

import { IntegrationsHome, safeAppPath } from "./IntegrationsHome";
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
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("tells the owner to connect a provider when only native Google is configured", async () => {
  await show(data(true, false));
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')?.textContent).toContain(
    "Connect a Composio or Pipedream account to add apps like Slack, Notion and GitHub.",
  );
  expect(
    container.querySelector('a[href="/integrations/setup?next=/app/integrations"]')?.textContent,
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
        initialEntries={["/app/integrations?q=carta&connect=carta&returnTo=/app/cap-table"]}
      >
        <Routes>
          <Route path="/app/integrations" element={<IntegrationsHome data={data(true, false)} />} />
          <Route path="/app/cap-table" element={<p>cap table page</p>} />
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

it("only returns to in-app paths", () => {
  expect(safeAppPath("/app/cap-table")).toBe("/app/cap-table");
  expect(safeAppPath("https://evil.example.test/app/")).toBeNull();
  expect(safeAppPath("/app//evil.example.test")).toBeNull();
  expect(safeAppPath(null)).toBeNull();
});

it("still lists native Google apps when the managed catalog is not set up", async () => {
  const value = data(false, false);
  value.catalog = value.catalog.map((item) => ({ ...item, connected: false }));
  await show(value);
  expect(container.querySelector('[data-testid="catalog-not-set-up"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Connect gmail"]')).not.toBeNull();
});
