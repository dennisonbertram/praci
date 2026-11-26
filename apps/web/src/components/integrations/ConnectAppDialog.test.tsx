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

window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

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
const bot = { id: "bot_1", name: "Ada", color: "#000000" } as IntegrationsData["bots"][number];
const data = (connections: Connection[] = []): IntegrationsData => ({
  loaded: true,
  error: null,
  catalog: [item],
  connections,
  servers: [],
  bots: [bot],
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: null,
  feedEnabled: false,
  catalogFailed: false,
  meetingsFailed: false,
  refresh: vi.fn().mockResolvedValue(undefined),
});

async function mount(
  connections: Connection[] = [],
  confirmFirst = false,
  extra: Partial<Parameters<typeof ConnectAppDialog>[0]> = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConnectAppDialog
        item={item}
        data={data(connections)}
        confirmFirst={confirmFirst}
        onClose={vi.fn()}
        {...extra}
      />,
    );
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
  api.complete.mockResolvedValue(pendingRow("connected", { agentBotId: "bot_1" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(text()).toContain("Slack connected");
});

it("creates no connection until Connect is clicked when opened by a link", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  await mount([], true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(api.begin).not.toHaveBeenCalled();
  expect(api.complete).not.toHaveBeenCalled();
  const connect = [...document.querySelectorAll("button")].find((b) => b.textContent === "Connect");
  await act(async () => {
    connect?.click();
  });
  expect(api.begin).toHaveBeenCalledTimes(1);
});

it("passes the filter permission and the replaced account to the sign-in only when given", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  await mount([], true, { permission: "mail_rules", replacesConnectionId: "old" });
  await act(async () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Connect")?.click();
  });
  expect(api.begin).toHaveBeenCalledWith(
    expect.objectContaining({ permission: "mail_rules", replacesConnectionId: "old" }),
  );
  document.body.innerHTML = "";
  api.begin.mockClear();
  await mount([], true);
  await act(async () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Connect")?.click();
  });
  expect(api.begin.mock.calls[0]?.[0]).not.toHaveProperty("permission");
});

async function connect(connected: Connection) {
  vi.spyOn(window, "open").mockReturnValue(null);
  api.complete.mockResolvedValue(connected);
  await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
}

it("ends at connected, with no bot step or access line, when the connection has an agent", async () => {
  await connect(pendingRow("connected", { agentBotId: "bot_1" }));
  expect(text()).toContain("Slack connected");
  expect(text()).not.toContain("Which bots can use Slack?");
  expect(text()).not.toContain("bots can use");
  expect(text()).not.toContain("No bot uses");
});

it("still asks which bots get a connection that has no agent", async () => {
  await connect(pendingRow("connected"));
  expect(text()).toContain("Which bots can use Slack?");
});

it("saves least access when the bot step is skipped, so no other bot gets the connection", async () => {
  api.setAccess.mockResolvedValue({});
  await connect(pendingRow("connected"));
  await act(async () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Skip")?.click();
  });
  expect(api.setAccess).toHaveBeenCalledWith({
    connectionId: "conn-1",
    allAgents: false,
    botIds: [],
  });
  expect(text()).toContain("Slack connected");
});

it("does not promise a bot choice before sign-in", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  await mount([], true);
  expect(text()).toContain("You'll sign in to Slack in a new window.");
  expect(text()).not.toContain("Then you choose");
});

it("shows only the title once connected, without repeating the result", async () => {
  await connect(pendingRow("connected", { agentBotId: "bot_1" }));
  expect(text()).toContain("Slack connected");
  expect(text()).not.toContain("is ready");
  expect(text()).not.toContain("now appears under Connected");
});

it("names a second Gmail account plainly, since its address tells it apart, but numbers other apps", async () => {
  vi.spyOn(window, "open").mockReturnValue({ closed: false, close: vi.fn() } as unknown as Window);
  const gmail = { ...item, connectorId: "google", slug: "gmail", name: "Gmail" };
  const connected = pendingRow("connected", {
    connectorId: "google",
    provider: "gmail",
    displayName: "Gmail",
  });
  await mount([connected], false, { item: gmail });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(api.begin.mock.calls[0]?.[0]).toMatchObject({ displayName: "Gmail" });
  api.begin.mockClear();
  document.body.innerHTML = "";
  await mount([pendingRow("connected")]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(api.begin.mock.calls[0]?.[0]).toMatchObject({ displayName: "Slack 2" });
});

async function closeWhilePending(completeAtClose: Connection, onConnected?: () => void) {
  vi.spyOn(window, "open").mockReturnValue(null);
  const d = data();
  await mount([], false, { data: d, onConnected });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  api.complete.mockResolvedValue(completeAtClose);
  await act(async () => {
    const closeButton = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Close" || b.getAttribute("aria-label") === "Close",
    );
    closeButton?.click();
  });
  return d;
}

it("keeps an account that finished sign-in just before Close, instead of revoking it", async () => {
  const onConnected = vi.fn();
  const d = await closeWhilePending(pendingRow("connected"), onConnected);
  expect(onConnected).toHaveBeenCalledTimes(1);
  expect(api.complete).toHaveBeenLastCalledWith({ connectionId: "conn-1" });
  expect(api.revoke).not.toHaveBeenCalled();
  expect(d.refresh).toHaveBeenCalled();
});

it("revokes the pending row on Close when sign-in has not finished", async () => {
  const onConnected = vi.fn();
  const d = await closeWhilePending(pendingRow("pending"), onConnected);
  expect(onConnected).not.toHaveBeenCalled();
  expect(api.revoke).toHaveBeenCalledWith({ connectionId: "conn-1" });
  expect(d.refresh).toHaveBeenCalled();
});
