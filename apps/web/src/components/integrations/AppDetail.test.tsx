// @vitest-environment jsdom

import type { Connection, ConnectionCatalogItem } from "@rakazo/contracts";
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
const createAgent = vi.fn().mockResolvedValue({ botId: "bot_app" });
const setWrites = vi.fn().mockResolvedValue({});
const setExclusive = vi.fn().mockResolvedValue({});
const setAccess = vi.fn().mockResolvedValue({});
vi.mock("../../lib/rpc", () => ({
  rpc: {
    connections: {
      tools: vi.fn().mockResolvedValue([]),
      revoke: (...a: unknown[]) => revoke(...a),
      createAgent: (...a: unknown[]) => createAgent(...a),
      setWrites: (...a: unknown[]) => setWrites(...a),
      setExclusive: (...a: unknown[]) => setExclusive(...a),
      setAccess: (...a: unknown[]) => setAccess(...a),
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

it("offers Create agent for a native Google account", async () => {
  await show(
    PAGE,
    data({
      connections: [appConnection({ id: "conn_google", connectorId: "google", provider: "gmail" })],
    }),
  );
  expect(container.textContent).toContain("Create agent");
});

it("hides the ordinary access list and Used by while a private agent connection is not shared", async () => {
  await show(APP_PAGE, data({ connections: [appConnection({ agentBotId: "bot_app" })] }));
  expect(container.textContent).not.toContain("Used by");
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
          botIds: [],
          effectiveAccess: { shared: "all", botIds: ["bot_app", "bot_other"] },
        },
      },
    }),
  );
  expect(container.textContent).toContain("Used by");
  const toggles = [
    ...container.querySelectorAll<HTMLElement>('[aria-label$="can use Sample workspace"]'),
  ];
  expect(toggles.map((element) => element.getAttribute("aria-label"))).toEqual([
    "Owner can use Sample workspace",
    "Other can use Sample workspace",
  ]);
  await act(async () => toggles[1]!.click());
  expect(setAccess).toHaveBeenCalledWith({
    connectionId: "conn_app",
    allAgents: false,
    botIds: ["bot_app"],
  });
});

it("builds each quick toggle on the previous one and saves them in order", async () => {
  const bots = ["bot_app", "b", "c"].map((id) => ({ id, name: id, color: "#000000" }));
  const saved: unknown[] = [];
  let release: () => void = () => undefined;
  setAccess.mockImplementationOnce(async (input: unknown) => {
    saved.push(input);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  setAccess.mockImplementation(async (input: unknown) => void saved.push(input));
  await show(
    APP_PAGE,
    data({
      bots: bots as IntegrationsData["bots"],
      connections: [appConnection({ agentBotId: "bot_app" })],
      access: {
        conn_app: {
          allAgents: true,
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
    { connectionId: "conn_app", allAgents: false, botIds: ["bot_app", "c"] },
    { connectionId: "conn_app", allAgents: false, botIds: ["bot_app"] },
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

it("labels the header of a Composio or Pipedream app with its provider, and a direct app with none", async () => {
  await show(APP_PAGE, data({ connections: [appConnection()] }));
  expect(container.querySelector("h1 + div")?.textContent).toContain("via Composio");
  act(() => root.unmount());
  container.remove();
  await show(
    "/app/integrations/app/pipedream/notion",
    data({ connections: [appConnection({ connectorId: "pipedream" })] }),
  );
  expect(container.querySelector("h1 + div")?.textContent).toContain("via Pipedream");
  act(() => root.unmount());
  container.remove();
  await show(
    PAGE,
    data({ connections: [appConnection({ connectorId: "google", provider: "gmail" })] }),
  );
  expect(container.textContent).not.toContain("via ");
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
