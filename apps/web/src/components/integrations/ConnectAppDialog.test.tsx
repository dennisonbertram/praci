// @vitest-environment jsdom

import type { Connection, ConnectionCatalogItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IntegrationsData } from "./useIntegrations";

const api = vi.hoisted(() => ({
  begin: vi.fn(),
  complete: vi.fn(),
  revoke: vi.fn(),
  setAccess: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: { connections: api, onboarding: { appConnected: vi.fn() } },
}));
vi.mock("../../lib/desktop", () => ({
  desktopBridge: () => undefined,
  signInWithSystemBrowser: vi.fn(),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { ConnectAppDialog } from "./ConnectAppDialog";

const item: ConnectionCatalogItem = {
  connectorId: "composio",
  slug: "slack",
  name: "Slack",
  logo: null,
  connected: false,
  noAuth: false,
  description: null,
  category: "chat",
};
const pendingRow = (status: Connection["status"], extra: Partial<Connection> = {}): Connection => ({
  id: "conn-1",
  connectorId: "composio",
  provider: "slack",
  displayName: "Slack",
  status,
  error: null,
  capabilities: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});
const data = (connections: Connection[] = []): IntegrationsData => ({
  loaded: true,
  error: null,
  catalog: [item],
  connections,
  servers: [],
  bots: [],
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: null,
  feedEnabled: false,
  catalogFailed: false,
  refresh: vi.fn().mockResolvedValue(undefined),
});

async function mount(connections: Connection[] = []) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ConnectAppDialog item={item} data={data(connections)} onClose={vi.fn()} />);
  });
  return root;
}
const text = () => document.body.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  api.begin.mockResolvedValue({ connectionId: "conn-1", authorizationUrl: "https://auth.test/x" });
  api.complete.mockResolvedValue(pendingRow("pending"));
  api.revoke.mockResolvedValue({ ok: true });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("shows the popup-blocked step when the browser refuses the sign-in window", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(text()).toContain("Your browser blocked the sign-in window");
  expect(text()).toContain("Open sign-in");
});

it("keeps waiting when the sign-in window reads as closed and Try again reuses the pending row", async () => {
  const popup = { closed: false, close: vi.fn(), opener: {} } as unknown as Window;
  const open = vi.spyOn(window, "open").mockReturnValue(popup);
  await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(text()).toContain("Sign in to Slack in the new window");
  (popup as { closed: boolean }).closed = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
  expect(text()).not.toContain("Sign-in was cancelled");
  expect(text()).toContain("If you closed the sign-in window, try again");
  const tryAgain = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  await act(async () => {
    tryAgain?.click();
  });
  expect(open).toHaveBeenCalledTimes(2);
  expect(api.begin).toHaveBeenCalledTimes(1);
  expect(api.revoke).not.toHaveBeenCalled();
  // Polling continues, so a late sign-in still completes.
  api.complete.mockResolvedValue(pendingRow("connected"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(text()).toContain("Slack connected");
});
