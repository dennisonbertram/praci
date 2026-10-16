// @vitest-environment jsdom

import type { ConnectionCatalogItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({
  rpc: { connections: { tools: vi.fn().mockResolvedValue([]) } },
}));
// The dialog itself is covered by ConnectAppDialog.test; here it only reports being open and done.
vi.mock("./ConnectAppDialog", () => ({
  ConnectAppDialog: ({
    onClose,
    onConnected,
  }: {
    onClose: () => void;
    onConnected?: () => void;
  }) => (
    <button
      type="button"
      data-testid="connect-dialog"
      onClick={() => {
        onClose();
        onConnected?.();
      }}
    />
  ),
}));

import { AppDetail } from "./AppDetail";
import type { IntegrationsData } from "./useIntegrations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const gmail: ConnectionCatalogItem = {
  connectorId: "google",
  slug: "gmail",
  name: "Gmail",
  logo: null,
  connected: false,
  noAuth: false,
  description: null,
  category: "email_calendar",
};

const data = (over: Partial<IntegrationsData> = {}): IntegrationsData => ({
  loaded: true,
  error: null,
  catalog: [gmail],
  connections: [],
  servers: [],
  bots: [],
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: null,
  catalogFailed: false,
  feedEnabled: false,
  refresh: async () => {},
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}
async function show(url: string, value: IntegrationsData) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route
            path="/app/integrations/app/:connectorId/:slug"
            element={<AppDetail data={value} />}
          />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const PAGE = "/app/integrations/app/google/gmail";
const dialog = () => container.querySelector('[data-testid="connect-dialog"]');
const where = () => container.querySelector('[data-testid="where"]')?.textContent;

it("waits for a click when it is opened without ?connect=1", async () => {
  await show(PAGE, data());
  expect(dialog()).toBeNull();
  expect(container.textContent).toContain("Gmail is not connected.");
});

it("opens the connect dialog on arrival with ?connect=1 and returns to ?next= when connected", async () => {
  await show(`${PAGE}?connect=1&next=%2Fapp%2Fdata-room`, data());
  expect(dialog()).not.toBeNull();
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(where()).toBe("/app/data-room");
});

it("ignores an external ?next= and stays put after connecting", async () => {
  await show(`${PAGE}?connect=1&next=https%3A%2F%2Fevil.example`, data());
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(where()).toBe(PAGE);
});

it("returns straight to ?next= when the app is already connected", async () => {
  const row = {
    id: "c1",
    connectorId: "google",
    provider: "gmail",
    displayName: "Gmail",
    status: "connected",
    error: null,
    capabilities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["connections"][number];
  await show(`${PAGE}?connect=1&next=%2Fapp%2Fdata-room`, data({ connections: [row] }));
  expect(where()).toBe("/app/data-room");
});

it("says so when the app is not in the catalog, and points the owner at setup", async () => {
  const setup = { canConfigure: true } as IntegrationsData["setup"];
  await show(`${PAGE}?connect=1`, data({ catalog: [], setup }));
  expect(dialog()).toBeNull();
  expect(container.textContent).toContain("isn't available on this server");
  expect(container.querySelector("a[href^='/integrations/setup?next=']")).not.toBeNull();
});

it("tells a member to ask the server owner when the app is not in the catalog", async () => {
  await show(PAGE, data({ catalog: [] }));
  expect(container.textContent).toContain("Ask the server owner to set up the app catalog.");
  expect(container.querySelector("a[href^='/integrations/setup']")).toBeNull();
});
