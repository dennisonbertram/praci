// @vitest-environment jsdom

import type { ConnectionCatalogItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
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
async function show(value: IntegrationsData) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <IntegrationsHome data={value} />
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
  expect(container.querySelector('a[href="/integrations/setup"]')?.textContent).toBe(
    "Set up app catalog",
  );
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

it("offers Zernio even without an app catalog and prefills the custom dialog", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Zernio"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Server URL"]');
  expect(input?.value).toBe("https://mcp.zernio.com/mcp");
});

it("hides the Zernio tile once its server is connected", async () => {
  await show({ ...data(true, true), servers: [zernioServer] });
  expect(container.querySelector('[aria-label="Connect Zernio"]')).toBeNull();
});

it("offers Carta and prefills the custom dialog", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Carta"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Server URL"]');
  expect(input?.value).toBe("https://mcp.app.carta.com/mcp");
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

it("offers Treg and prefills the custom dialog", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect Treg"]');
  expect(connect).not.toBeNull();
  await act(async () => connect?.click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Server URL"]');
  expect(input?.value).toBe("https://treg.to/mcp/");
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

it("opens the X tile with its URL and the client ID fields", async () => {
  await show(data(true, false));
  const connect = container.querySelector<HTMLButtonElement>('[aria-label="Connect X"]');
  await act(async () => connect?.click());
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Server URL"]');
  expect(input?.value).toBe("https://api.x.com/mcp");
  expect(document.querySelector('[aria-label="Client ID"]')).not.toBeNull();
});

const connectedTiles = () =>
  [...container.querySelectorAll('[data-testid^="connected-finance-"]')].map(
    (el) => el.textContent,
  );

it("lists a connected finance source under Connected, even when it is the only connection", async () => {
  const value = data(true, true);
  value.catalog = [];
  value.financeSources = [
    { provider: "mercury", serverId: "s1", status: "ok", lastSyncedAt: null },
  ];
  await show(value);
  const tiles = connectedTiles();
  expect(tiles).toHaveLength(1);
  expect(tiles[0]).toContain("Mercury");
  expect(tiles[0]).toContain("Open Finance");
  expect(container.textContent).toContain("Connected");
  expect(container.querySelector('[data-testid="finance-tile-mercury"]')).not.toBeNull();
});

it("lists connected crypto and exchange connections under Connected", async () => {
  financeRpc.crypto.mockResolvedValue({
    connected: true,
    hasApiKey: true,
    alchemy: { connected: true, lastError: null },
  });
  financeRpc.exchanges.mockResolvedValue([{ provider: "kraken", connected: true }]);
  await show(data(true, true));
  const tiles = connectedTiles();
  expect(tiles).toHaveLength(3);
  for (const [i, name] of ["Blockscout", "Alchemy", "Kraken"].entries()) {
    expect(tiles[i]).toContain(name);
    expect(tiles[i]).toContain("Open");
  }
});

it("shows no finance tile under Connected when nothing is connected", async () => {
  const value = data(true, true);
  value.financeSources = [
    { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
  ];
  await show(value);
  expect(connectedTiles()).toEqual([]);
});
