// @vitest-environment jsdom

import type { Connection, ConnectionCatalogItem } from "@rakazo/contracts";
import { inboxAgentSpawnKey, mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const revoke = vi.fn().mockResolvedValue({});
const check = vi.fn().mockResolvedValue({});
const createAgent = vi.fn().mockResolvedValue({ botId: "bot_app" });
const setWrites = vi.fn().mockResolvedValue({});
const setExclusive = vi.fn().mockResolvedValue({});
const setAccess = vi.fn().mockResolvedValue({});
const setAgentAccess = vi.fn().mockResolvedValue({});
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: {
      tools: vi.fn().mockResolvedValue([]),
      revoke: (...a: unknown[]) => revoke(...a),
      check: (...a: unknown[]) => check(...a),
      createAgent: (...a: unknown[]) => createAgent(...a),
      setWrites: (...a: unknown[]) => setWrites(...a),
      setExclusive: (...a: unknown[]) => setExclusive(...a),
      setAccess: (...a: unknown[]) => setAccess(...a),
      setAgentAccess: (...a: unknown[]) => setAgentAccess(...a),
    },
  },
}));
// The dialog itself is covered by ConnectAppDialog.test; here it only reports being open and done.
vi.mock("./ConnectAppDialog", () => ({
  ConnectAppDialog: ({
    onClose,
    onConnected,
    confirmFirst,
    accountName,
    replacesConnectionId,
    permission,
  }: {
    onClose: () => void;
    onConnected?: () => void;
    confirmFirst?: boolean;
    accountName?: string;
    replacesConnectionId?: string;
    permission?: string;
  }) => (
    <button
      type="button"
      data-testid="connect-dialog"
      data-confirm-first={String(Boolean(confirmFirst))}
      data-account-name={accountName ?? ""}
      data-replaces={replacesConnectionId ?? ""}
      data-permission={permission ?? ""}
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
  meetingsFailed: false,
  feedEnabled: false,
  refresh: async () => {},
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Where() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{location.pathname}</output>
      <output data-testid="query">{`${location.search}|${JSON.stringify(location.state)}`}</output>
      <button
        id="go"
        type="button"
        onClick={() => navigate("/app/integrations/app/composio/slack?connect=1")}
      />
    </>
  );
}
const tree = (url: string, value: IntegrationsData, state?: unknown) => (
  <MemoryRouter
    initialEntries={[{ pathname: url.split("?")[0], search: `?${url.split("?")[1] ?? ""}`, state }]}
  >
    <Where />
    <Routes>
      <Route path="/app/integrations/app/:connectorId/:slug" element={<AppDetail data={value} />} />
      <Route path="*" element={null} />
    </Routes>
  </MemoryRouter>
);
async function show(url: string, value: IntegrationsData) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(tree(url, value)));
}
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  createAgent.mockClear();
  setWrites.mockClear();
  setExclusive.mockClear();
  setAccess.mockClear();
  setAgentAccess.mockClear();
});

const PAGE = "/app/integrations/app/google/gmail";
const dialog = () => container.querySelector('[data-testid="connect-dialog"]');
const where = () => container.querySelector('[data-testid="where"]')?.textContent;

window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const appConnection = (extra: Partial<Connection> = {}): Connection => ({
  id: "conn_app",
  connectorId: "composio",
  provider: "notion",
  displayName: "Sample workspace",
  status: "connected",
  error: null,
  capabilities: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});
const APP_PAGE = "/app/integrations/app/composio/notion";
const press = async (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent === label,
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
};
const switches = () => [...container.querySelectorAll<HTMLElement>('[role="switch"]')];

it("creates an agent for the selected connected account and opens its chat", async () => {
  await show(APP_PAGE, data({ connections: [appConnection()] }));
  expect(switches()).toHaveLength(0);
  await press("Create agent");
  expect(createAgent).toHaveBeenCalledWith({ connectionId: "conn_app" });
  expect(where()).toBe("/app/bot_app");
});

it("never offers Create agent for Gmail: every account belongs to the Inbox agent", async () => {
  await show(
    PAGE,
    data({
      connections: [appConnection({ id: "conn_google", connectorId: "google", provider: "gmail" })],
    }),
  );
  expect(container.textContent).not.toContain("Create agent");
});

it("hides the ordinary access list and the Access list while a private agent connection is not shared", async () => {
  await show(APP_PAGE, data({ connections: [appConnection({ agentBotId: "bot_app" })] }));
  expect(container.textContent).not.toContain("Which agents can use");
  expect(container.textContent).not.toContain("Only this agent");
  expect(container.textContent).not.toContain("Other agents ask");
});

it("reveals agent controls only after creation and confirms enabling changes", async () => {
  const refresh = vi.fn();
  await show(
    APP_PAGE,
    data({
      connections: [appConnection({ agentBotId: "bot_app", writesEnabled: false })],
      refresh,
    }),
  );
  expect(container.querySelector('a[href="/app/bot_app"]')).toBeTruthy();
  expect(switches()).toHaveLength(2);
  expect(switches()[0]?.getAttribute("aria-checked")).toBe("false");
  await act(async () => switches()[0]!.click());
  expect(setWrites).not.toHaveBeenCalled();
  await press("Cancel");
  expect(setWrites).not.toHaveBeenCalled();
  await act(async () => switches()[0]!.click());
  const grant = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Allow changes",
  );
  expect(grant?.className).toContain("bg-primary");
  expect(grant?.className).not.toContain("text-destructive");
  await press("Allow changes");
  expect(setWrites).toHaveBeenCalledWith({ connectionId: "conn_app", enabled: true });
  expect(refresh).toHaveBeenCalled();
});

it("turns changes off immediately and saves sharing for the account", async () => {
  await show(
    APP_PAGE,
    data({
      connections: [appConnection({ agentBotId: "bot_app", writesEnabled: true })],
      access: {
        conn_app: {
          allAgents: false,
          agentShared: false,
          botIds: ["bot_app"],
          effectiveAccess: { shared: "some", botIds: ["bot_app"] },
        },
      },
    }),
  );
  expect(switches()[1]?.getAttribute("aria-checked")).toBe("false");
  expect(container.textContent).toContain("Let other agents use");
  await act(async () => switches()[0]!.click());
  expect(setWrites).toHaveBeenCalledWith({ connectionId: "conn_app", enabled: false });
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  await act(async () => switches()[1]!.click());
  expect(setExclusive).toHaveBeenCalledWith({ connectionId: "conn_app", exclusive: false });
});

it("lists who can use a shared connection from the server, owner first, and saves a toggle", async () => {
  const bots = [
    { id: "bot_other", name: "Other", color: "#000000" },
    { id: "bot_app", name: "Owner", color: "#111111" },
  ] as IntegrationsData["bots"];
  await show(
    APP_PAGE,
    data({
      bots,
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: true,
          agentShared: true,
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app", "bot_other"] },
        },
      },
    }),
  );
  expect(container.textContent).toContain("Which agents can use");
  const toggles = [
    ...container.querySelectorAll<HTMLElement>('[aria-label$="can use Sample workspace"]'),
  ];
  expect(toggles.map((element) => element.getAttribute("aria-label"))).toEqual([
    "Owner can use Sample workspace",
    "Other can use Sample workspace",
  ]);
  await act(async () => toggles[1]!.click());
  expect(setAgentAccess).toHaveBeenCalledWith({
    connectionId: "conn_app",
    botId: "bot_other",
    on: false,
  });
});

it("Allow changes under a shared agent sets only that agent's write grant", async () => {
  const bots = ["bot_app", "b"].map((id) => ({ id, name: id, color: "#000000" }));
  await show(
    APP_PAGE,
    data({
      bots: bots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app", writesEnabled: true })],
      access: {
        conn_app: {
          allAgents: true,
          agentShared: true,
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app", "b"] },
        },
      },
    }),
  );
  const nested = container.querySelector<HTMLElement>(
    '[aria-label="b can make changes in Sample workspace"]',
  )!;
  expect(nested.getAttribute("aria-checked")).toBe("false");
  await act(async () => nested.click());
  expect(setAgentAccess).toHaveBeenCalledWith({
    connectionId: "conn_app",
    botId: "b",
    on: true,
    canWrite: true,
  });
});

it("saves each quick toggle as its own single-agent change, in order", async () => {
  const bots = ["bot_app", "b", "c"].map((id) => ({ id, name: id, color: "#000000" }));
  const saved: unknown[] = [];
  let release: () => void = () => undefined;
  setAgentAccess.mockImplementationOnce(async (input: unknown) => {
    saved.push(input);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  setAgentAccess.mockImplementation(async (input: unknown) => void saved.push(input));
  await show(
    APP_PAGE,
    data({
      bots: bots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: true,
          agentShared: true,
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app", "b", "c"] },
        },
      },
    }),
  );
  const toggle = (name: string) =>
    container.querySelector<HTMLElement>(`[aria-label="${name} can use Sample workspace"]`)!;
  await act(async () => toggle("b").click());
  await act(async () => toggle("c").click());
  expect(saved).toHaveLength(1);
  await act(async () => release());
  expect(saved).toEqual([
    { connectionId: "conn_app", botId: "b", on: false },
    { connectionId: "conn_app", botId: "c", on: false },
  ]);
});

it("keeps account switches uniquely labelled and targets the selected connection", async () => {
  await show(
    APP_PAGE,
    data({
      connections: [
        appConnection({ agentBotId: "bot_app", writesEnabled: true }),
        appConnection({
          id: "conn_second",
          displayName: "Second workspace",
          agentBotId: "bot_second",
          writesEnabled: true,
        }),
      ],
    }),
  );
  const ids = switches().map((element) => element.id);
  expect(ids).toHaveLength(4);
  expect(new Set(ids).size).toBe(4);
  const labels = switches().map((element) => element.getAttribute("aria-labelledby"));
  expect(new Set(labels).size).toBe(4);
  for (const id of labels) expect(container.querySelector(`[id="${id}"]`)?.tagName).toBe("LABEL");
  await act(async () => switches()[2]!.click());
  expect(setWrites).toHaveBeenCalledWith({ connectionId: "conn_second", enabled: false });
});

it("shows creation failure without navigating or hiding the retry action", async () => {
  createAgent.mockRejectedValueOnce(new Error("Could not create agent"));
  await show(APP_PAGE, data({ connections: [appConnection()] }));
  await press("Create agent");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not create agent");
  expect(where()).toBe(APP_PAGE);
  expect(container.textContent).toContain("Create agent");
});

it("does not offer creation for a pending connection", async () => {
  await show(APP_PAGE, data({ connections: [appConnection({ status: "pending" })] }));
  expect(container.textContent).not.toContain("Create agent");
  expect(switches()).toHaveLength(0);
});

it("waits for a click when it is opened without ?connect=1", async () => {
  await show(PAGE, data());
  expect(dialog()).toBeNull();
  expect(container.textContent).toContain("Gmail is not connected.");
});

it("opens the connect dialog on arrival with ?connect=1 and returns to ?next= when connected", async () => {
  await show(`${PAGE}?connect=1&next=%2Fapp%2Fdata-room`, data());
  expect(dialog()).not.toBeNull();
  // A link only opens the dialog; the dialog itself waits for a click before creating anything.
  expect(dialog()?.getAttribute("data-confirm-first")).toBe("true");
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(where()).toBe("/app/data-room");
});

it("keeps the same dialog open when the first account lands and the page switches to the connected view", async () => {
  const url = `${PAGE}?connect=1&next=%2Fapp%2Fdata-room`;
  await show(url, data());
  const before = dialog();
  expect(before).not.toBeNull();
  const connected: Connection = {
    ...appConnection({ connectorId: "google", provider: "gmail", displayName: "Gmail" }),
  };
  await act(async () => root.render(tree(url, data({ connections: [connected] }))));
  expect(dialog()).toBe(before);
});

it("starts the sign-in without a second question when the app's own button sent the person", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(tree(`${PAGE}?connect=1&next=%2Fapp%2Finbox`, data(), { connectNow: true })),
  );
  expect(dialog()?.getAttribute("data-confirm-first")).toBe("false");
});

it("spends ?connect=1 and the button's state when the sign-in is cancelled, so a reload does not restart it", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(tree(`${PAGE}?connect=1&x=1`, data(), { connectNow: true })));
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(container.querySelector('[data-testid="query"]')?.textContent).toBe("?x=1|null");
  expect(dialog()).toBeNull();
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
  // Setup keeps the connect continuation so the person lands back in the flow.
  expect(
    container.querySelector(
      `a[href="/app/integrations/setup?next=${encodeURIComponent(`${PAGE}?connect=1`)}"]`,
    ),
  ).not.toBeNull();
});

it("tells a member to ask the server owner when the app is not in the catalog", async () => {
  await show(PAGE, data({ catalog: [] }));
  expect(container.textContent).toContain("Ask the server owner to set up the app catalog.");
  expect(container.querySelector("a[href^='/app/integrations/setup']")).toBeNull();
});

it("re-arms ?connect=1 for each navigation between app pages", async () => {
  const slack = { ...gmail, connectorId: "composio", slug: "slack", name: "Slack" };
  await show(PAGE, data({ catalog: [gmail, slack] }));
  expect(dialog()).toBeNull();
  await act(async () => container.querySelector<HTMLButtonElement>("#go")?.click());
  expect(dialog()).not.toBeNull();
});

it("offers Reconnect on a signed-out mail account and replaces it once signed in again", async () => {
  const lapsed = {
    id: "old",
    connectorId: "google",
    provider: "gmail",
    displayName: "Old mail",
    status: "connected",
    needsReconnect: true,
    error: null,
    capabilities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["connections"][number];
  const refresh = vi.fn(async () => {});
  await show(`${PAGE}?next=%2Fapp%2Finbox`, data({ connections: [lapsed], refresh }));
  expect(container.textContent).toContain("Needs reconnect");
  expect(container.textContent).toContain("Signed out.");
  const reconnect = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Reconnect",
  );
  await act(async () => reconnect?.click());
  // The new sign-in keeps the account's name.
  expect(dialog()?.getAttribute("data-account-name")).toBe("Old mail");
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(revoke).toHaveBeenCalledWith({ connectionId: "old" });
  expect(where()).toBe("/app/inbox");
});

it("re-checks a Gmail account from its Refresh button and reloads the list", async () => {
  const account = {
    id: "old",
    connectorId: "google",
    provider: "gmail",
    displayName: "Old mail",
    status: "connected",
    needsReconnect: true,
    error: null,
    capabilities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["connections"][number];
  const refresh = vi.fn(async () => {});
  await show(PAGE, data({ connections: [account], refresh }));
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Refresh"]');
  await act(async () => button?.click());
  expect(check).toHaveBeenCalledWith({ connectionId: "old" });
  expect(refresh).toHaveBeenCalled();
});

it("offers Reconnect on a Gmail account that reads as connected", async () => {
  const account = {
    id: "ok",
    connectorId: "google",
    provider: "gmail",
    displayName: "Fine mail",
    status: "connected",
    error: null,
    capabilities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["connections"][number];
  await show(PAGE, data({ connections: [account] }));
  const reconnect = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Reconnect",
  );
  await act(async () => reconnect?.click());
  expect(dialog()?.getAttribute("data-account-name")).toBe("Fine mail");
});

it("opens the sign-in that replaces an account and asks for the filter permission, after a click", async () => {
  const account = (id: string) =>
    ({
      id,
      connectorId: "google",
      provider: "gmail",
      displayName: `Mail ${id}`,
      status: "connected",
      error: null,
      capabilities: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }) as IntegrationsData["connections"][number];
  await show(
    `${PAGE}?reconnect=b&permission=mail_rules&next=%2Fapp%2Finbox`,
    data({ connections: [account("a"), account("b")] }),
  );
  expect(dialog()?.getAttribute("data-replaces")).toBe("b");
  expect(dialog()?.getAttribute("data-permission")).toBe("mail_rules");
  expect(dialog()?.getAttribute("data-confirm-first")).toBe("true");
  expect(dialog()?.getAttribute("data-account-name")).toBe("Mail b");
  revoke.mockClear();
  // Closing the dialog drops the permission, so a later Reconnect does not ask for it. The working
  // account is not revoked: the server replaces it only when the same Google account signed in.
  await act(async () => (dialog() as HTMLButtonElement).click());
  expect(revoke).not.toHaveBeenCalled();
  expect(where()).toBe("/app/inbox");
});

it("does not open a sign-in for a connection that is not there, or without the permission", async () => {
  const account = {
    id: "a",
    connectorId: "google",
    provider: "gmail",
    displayName: "Mail a",
    status: "connected",
    error: null,
    capabilities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as IntegrationsData["connections"][number];
  await show(`${PAGE}?reconnect=missing&permission=mail_rules`, data({ connections: [account] }));
  expect(dialog()).toBeNull();
  act(() => root.unmount());
  container.remove();
  await show(`${PAGE}?reconnect=a`, data({ connections: [account] }));
  expect(dialog()).toBeNull();
});

it("offers Remove account per row only when there is more than one account", async () => {
  const account = (id: string) =>
    ({
      id,
      connectorId: "google",
      provider: "gmail",
      displayName: `Mail ${id}`,
      status: "connected",
      error: null,
      capabilities: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }) as IntegrationsData["connections"][number];
  const labels = () => [...container.querySelectorAll("button")].map((b) => b.textContent);
  await show(PAGE, data({ connections: [account("a")] }));
  // With one account, Disconnect Gmail is the single way to remove it.
  expect(labels()).not.toContain("Remove account");
  expect(labels()).toContain("Disconnect Gmail");
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Disconnect Gmail")
      ?.click(),
  );
  expect(document.body.textContent).toContain(
    "Mail data Praci cached from this account is removed.",
  );
  act(() => root.unmount());
  container.remove();
  await show(PAGE, data({ connections: [account("a"), account("b")] }));
  expect(labels().filter((label) => label === "Remove account")).toHaveLength(2);
});

it("names no connector vendor on an app page, and shows no Tools section when there are no tools", async () => {
  await show(APP_PAGE, data({ connections: [appConnection()] }));
  expect(container.textContent).not.toMatch(/via |Composio|Pipedream/);
  expect(container.textContent).not.toContain("Tools");
  expect(container.textContent).not.toContain("No tools available");
});

it("hides the account name when it only repeats the app name", async () => {
  const notion = { ...gmail, connectorId: "composio", slug: "notion", name: "Notion" };
  await show(
    APP_PAGE,
    data({ catalog: [notion], connections: [appConnection({ displayName: "Notion" })] }),
  );
  expect(container.querySelector("b")).toBeNull();
  await act(async () => root.unmount());
  container.remove();
  await show(APP_PAGE, data({ catalog: [notion], connections: [appConnection()] }));
  expect(container.querySelector("b")?.textContent).toBe("Sample workspace");
});

it("gives the back link a phone tap size and writes the connected date in words", async () => {
  await show(APP_PAGE, data({ connections: [appConnection()] }));
  expect(container.querySelector('a[href="/app/integrations"]')?.className).toContain("rk-tap");
  expect(container.textContent).toMatch(/Connected (Dec 31, 2025|Jan 1, 2026)/);
});

const sharedBots = ["bot_app", "b", "c"].map((id) => ({ id, name: id, color: "#000000" }));
const switchOf = (name: string) =>
  container.querySelector<HTMLElement>(`[aria-label="${name} can use Sample workspace"]`)!;
const buttonOf = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;

it("All saves allAgents once and None saves the owner alone, once", async () => {
  await show(
    APP_PAGE,
    data({
      bots: sharedBots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: false,
          agentShared: true,
          botIds: ["bot_app", "b"],
          effectiveAccess: { shared: "some", botIds: ["bot_app", "b"] },
        },
      },
    }),
  );
  await act(async () => buttonOf("All").click());
  expect(setAccess.mock.calls).toEqual([
    [{ connectionId: "conn_app", allAgents: true, botIds: [] }],
  ]);
  setAccess.mockClear();
  await act(async () => buttonOf("None").click());
  expect(setAccess.mock.calls).toEqual([
    [{ connectionId: "conn_app", allAgents: false, botIds: ["bot_app"] }],
  ]);
});

it("None leaves Let other agents use on with Access listed and every other agent off", async () => {
  await show(
    APP_PAGE,
    data({
      bots: sharedBots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: false,
          botIds: ["bot_app"],
          agentShared: true,
          effectiveAccess: { shared: "some", botIds: ["bot_app"] },
        },
      },
    }),
  );
  expect(container.textContent).toContain("Which agents can use");
  expect(container.querySelector<HTMLInputElement>("#connection-conn_app-shared")?.checked).toBe(
    true,
  );
  expect(switchOf("b").getAttribute("aria-checked")).toBe("false");
  expect(switchOf("c").getAttribute("aria-checked")).toBe("false");
});

it("None on a mail connection leaves the Inbox agent and its email chats as they are", async () => {
  const bots = [
    { id: "inbox", name: "Inbox agent", color: "#000", spawnKey: inboxAgentSpawnKey("u1") },
    { id: "e1", name: "Chat", color: "#000", spawnKey: mailThreadAgentSpawnKey("conn_app", "t") },
    { id: "a", name: "Ada", color: "#000", spawnKey: null },
  ];
  await show(
    APP_PAGE,
    data({
      bots: bots as unknown as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "inbox" })],
      access: {
        conn_app: {
          allAgents: false,
          botIds: ["inbox", "e1", "a"],
          agentShared: true,
          effectiveAccess: { shared: "some", botIds: ["inbox", "e1", "a"] },
        },
      },
    }),
  );
  await act(async () => buttonOf("None").click());
  expect(setAccess.mock.calls).toEqual([
    [{ connectionId: "conn_app", allAgents: false, botIds: ["inbox", "e1"] }],
  ]);
});

it("keeps All available when every agent is on but access is a chosen list", async () => {
  const access = (ids: string[]) => ({
    conn_app: {
      allAgents: false,
      agentShared: true,
      botIds: ids,
      effectiveAccess: { shared: "some" as const, botIds: ids },
    },
  });
  await show(
    APP_PAGE,
    data({
      bots: sharedBots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: access(["bot_app", "b", "c"]),
    }),
  );
  expect(buttonOf("All").disabled).toBe(false);
  expect(buttonOf("None").disabled).toBe(false);
});

it("while a save is in flight, switching one agent does not flip an agent the server says cannot use it", async () => {
  // "c" is stored as allowed (all agents) but cannot reach this app, so the server lists it as off.
  let release: () => void = () => undefined;
  setAgentAccess.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await show(
    APP_PAGE,
    data({
      bots: sharedBots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: true,
          agentShared: true,
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app", "b"] },
        },
      },
    }),
  );
  expect(switchOf("c").getAttribute("aria-checked")).toBe("false");
  await act(async () => switchOf("b").click());
  expect(switchOf("b").getAttribute("aria-checked")).toBe("false");
  expect(switchOf("c").getAttribute("aria-checked")).toBe("false");
  expect(switchOf("bot_app").getAttribute("aria-checked")).toBe("true");
  await act(async () => release());
});

it("None still saves when everything shown is the owner but access is stored as all agents", async () => {
  // Only the owner can reach this app, yet it is shared with all agents (including future ones).
  await show(
    APP_PAGE,
    data({
      bots: sharedBots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: true,
          agentShared: true,
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app"] },
        },
      },
    }),
  );
  expect(buttonOf("All").disabled).toBe(true);
  expect(buttonOf("None").disabled).toBe(false);
  await act(async () => buttonOf("None").click());
  expect(setAccess.mock.calls).toEqual([
    [{ connectionId: "conn_app", allAgents: false, botIds: ["bot_app"] }],
  ]);
});
