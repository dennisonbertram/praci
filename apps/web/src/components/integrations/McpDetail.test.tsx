// @vitest-environment jsdom

import type { BotMcpServer, McpServer } from "@rakazo/contracts";
import { BREX_CARDS_MCP_ENDPOINT } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { mockIntegrations, mockServer } from "../../stories/fixtures";

const setWrites = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const setExclusive = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const listAssignments = vi.hoisted(() => vi.fn());
const replaceAssignments = vi.hoisted(() => vi.fn());
const setAgentAssignment = vi.hoisted(() => vi.fn());
const brex = vi.hoisted(() => ({
  cards: vi.fn(),
  getControls: vi.fn(),
  setControls: vi.fn(),
  replaceToken: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    brexCards: brex,
    threads: { send: vi.fn() },
    mcp: {
      servers: { setWrites, setAgentAssignment },
      assignments: { list: listAssignments, replace: replaceAssignments },
    },
    integrationAgents: { create, setExclusive },
  },
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { McpDetail } from "./McpDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const refresh = vi.fn();
listAssignments.mockResolvedValue([]);
replaceAssignments.mockResolvedValue([]);
setAgentAssignment.mockResolvedValue({ ok: true });

async function show(
  writesEnabled: boolean,
  endpoint = "https://mcp.app.carta.com/mcp",
  extra: Partial<McpServer> = {},
  mcpAssignments: BotMcpServer[] = [],
) {
  const data = {
    ...mockIntegrations({
      servers: [
        mockServer("s1", "Carta", {
          endpoint,
          writesEnabled,
          ...(endpoint === "https://mcp.app.carta.com/mcp"
            ? { agentBotId: "bot_ada", agentExclusive: true }
            : {}),
          ...extra,
        }),
      ],
      mcpAssignments,
    }),
    refresh,
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
        <Routes>
          <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
const writesSwitch = () => container.querySelector<HTMLElement>("#server-writes");
const press = (label: string) =>
  act(async () =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent === label)
      ?.click(),
  );

afterEach(() => {
  setWrites.mockReset();
  create.mockReset();
  setExclusive.mockReset();
  navigate.mockReset();
  for (const fn of Object.values(brex)) fn.mockReset();
  act(() => root.render(null));
});

it("keeps Zernio exclusive and read-only while offering its existing connection an API key", async () => {
  await show(false, "https://mcp.zernio.com/mcp", { agentBotId: "gtm-1", agentExclusive: true });
  expect(writesSwitch()).toBeNull();
  expect(container.querySelector("#server-shared")).toBeNull();
  expect(document.body.textContent).toContain("Configure API key");
});

it("asks before turning Carta changes on, then saves", async () => {
  setWrites.mockResolvedValue({});
  await show(false);
  await act(async () => writesSwitch()?.click());
  expect(setWrites).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain(
    "The Carta agent will be able to change your Carta data. It asks before each change.",
  );
  const grant = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Allow changes",
  );
  expect(grant?.className).toContain("bg-primary");
  expect(grant?.className).not.toContain("text-destructive");
  await press("Allow changes");
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: true });
  expect(refresh).toHaveBeenCalled();
});

it("cancelling the confirmation changes nothing", async () => {
  await show(false);
  await act(async () => writesSwitch()?.click());
  await press("Cancel");
  expect(setWrites).not.toHaveBeenCalled();
});

it("turns Carta changes off without a confirmation", async () => {
  setWrites.mockResolvedValue({});
  await show(true);
  await act(async () => writesSwitch()?.click());
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: false });
  expect(document.body.textContent).not.toContain("It asks before each change");
});

it("has no switch on other servers", async () => {
  await show(false, "https://mcp.example.com/sse");
  expect(writesSwitch()).toBeNull();
});

it("renders a stored malformed endpoint without crashing or exposing its query", async () => {
  await show(false, "not a URL?token=private-value", { agentBotId: null });
  expect(container.textContent).toContain("Carta");
  expect(container.textContent).not.toContain("private-value");
});

it("Carta links back to Investors, hides the MCP host and names who loses access", async () => {
  await show(false);
  const link = container.querySelector<HTMLAnchorElement>('a[href="/app/investors"]');
  expect(link?.textContent).toBe("Open Investors");
  expect(container.textContent).not.toContain("via MCP");
  expect(container.textContent).toContain("asks you before each change");
  await press("Remove Carta");
  expect(document.body.textContent).toContain("The Carta agent loses access to Carta.");
});

it("offers Disconnect sign-in only while signed in", async () => {
  const render = async (oauthStatus: "connected" | "reconnect") => {
    const data = {
      ...mockIntegrations({ servers: [mockServer("s1", "Files", { oauthStatus })] }),
      refresh,
    };
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
          <Routes>
            <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  };
  await render("connected");
  // Healthy: Reconnect and Disconnect wait in one menu, not beside the title.
  expect(container.textContent).not.toContain("Reconnect");
  await act(async () =>
    container.querySelector<HTMLElement>('[aria-label="Sign-in options"]')?.click(),
  );
  expect(document.body.textContent).toContain("Disconnect sign-in");
  expect(document.body.textContent).toContain("Reconnect");
  await render("reconnect");
  expect(container.querySelector('[aria-label="Sign-in options"]')).toBeNull();
  expect(container.textContent).toContain("Reconnect");
  expect(container.textContent).not.toContain("Disconnect sign-in");
});

const OTHER = "https://mcp.example.com/sse";
const withAgent = { agentBotId: "bot_ada" };
const label = (text: string) =>
  [...container.querySelectorAll<HTMLElement>("label")].find((l) => l.textContent?.includes(text));

it("offers Create agent, which creates the agent and opens its chat", async () => {
  create.mockResolvedValue({ server: {}, botId: "bot_new" });
  await show(false, OTHER);
  expect(container.textContent).not.toContain("Allow changes in");
  await press("Create agent");
  expect(create).toHaveBeenCalledWith({ serverId: "s1" });
  expect(navigate).toHaveBeenCalledWith("/app/bot_new");
});

it("shows an error and stays when creating the agent fails", async () => {
  create.mockRejectedValue(new Error("nope"));
  await show(false, OTHER);
  await press("Create agent");
  expect(navigate).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("has no Create agent button on Carta or once an agent exists", async () => {
  await show(false);
  expect(container.textContent).not.toContain("Create agent");
  await show(false, OTHER, withAgent);
  expect(container.textContent).not.toContain("Create agent");
  expect(container.textContent).toContain("Let other agents use");
  expect(container.querySelector<HTMLAnchorElement>('a[href="/app/bot_ada"]')?.textContent).toBe(
    "Open Ada",
  );
});

it("asks before the agent's changes switch turns on, not off", async () => {
  setWrites.mockResolvedValue({});
  await show(false, OTHER, withAgent);
  expect(label("Allow changes in Carta")).toBeDefined();
  await act(async () => writesSwitch()?.click());
  expect(setWrites).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("It asks before each change.");
  await press("Allow changes");
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: true });
  await show(true, OTHER, withAgent);
  await act(async () => writesSwitch()?.click());
  expect(setWrites).toHaveBeenLastCalledWith({ id: "s1", enabled: false });
});

it("Letting other agents use it saves at once and reveals Access only while on", async () => {
  setExclusive.mockResolvedValue({});
  await show(false, OTHER, { ...withAgent, agentExclusive: true });
  expect(container.textContent).not.toContain("Which agents can use");
  expect(container.querySelectorAll('[role="switch"][aria-label$="can use Carta"]')).toHaveLength(
    0,
  );
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(setExclusive).toHaveBeenCalledWith({ serverId: "s1", exclusive: false });
  await show(false, OTHER, { ...withAgent, agentExclusive: false });
  expect(container.textContent).toContain("Which agents can use");
  expect(
    container.querySelectorAll('[role="switch"][aria-label$="can use Carta"]').length,
  ).toBeGreaterThan(1);
});

it("uses the general Agent section for a linked Carta agent", async () => {
  setExclusive.mockResolvedValue({});
  await show(false);
  expect(container.querySelector('section[aria-label="Agent"]')).not.toBeNull();
  expect(container.querySelectorAll("#server-writes")).toHaveLength(1);
  expect(container.textContent).toContain("Let other agents use");
  expect(container.querySelector('a[href="/app/bot_ada"]')).not.toBeNull();
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(setExclusive).toHaveBeenCalledWith({ serverId: "s1", exclusive: false });
});

it("offers Create agent for Carta without a linked agent, with no writes switch", async () => {
  create.mockResolvedValue({ server: {}, botId: "bot_carta" });
  await show(false, undefined, { agentBotId: null, agentExclusive: false });
  expect(writesSwitch()).toBeNull();
  await press("Create agent");
  expect(create).toHaveBeenCalledWith({ serverId: "s1" });
  expect(navigate).toHaveBeenCalledWith("/app/bot_carta");
});

it("turning Share on grants no other agent, and off returns to the owner alone", async () => {
  setExclusive.mockResolvedValue({});
  replaceAssignments.mockClear();
  replaceAssignments.mockResolvedValue([]);
  listAssignments.mockResolvedValue([]);
  await show(false, OTHER, { ...withAgent, agentExclusive: true });
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(setExclusive).toHaveBeenLastCalledWith({ serverId: "s1", exclusive: false });
  // Sharing starts with every other agent off; the owner adds them one by one.
  expect(replaceAssignments).not.toHaveBeenCalled();

  replaceAssignments.mockClear();
  setExclusive.mockClear();
  listAssignments.mockImplementation(async ({ botId }: { botId: string }) => [
    { botId, serverId: "s1", allowAllTools: true, allowedTools: [] },
  ]);
  const everyone = ["bot_ada", "bot_bram"].map((botId) => ({
    botId,
    serverId: "s1",
    allowAllTools: true,
    allowedTools: [],
    id: `a_${botId}`,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  }));
  await show(false, OTHER, { ...withAgent, agentExclusive: false }, everyone);
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(setExclusive).toHaveBeenCalledWith({ serverId: "s1", exclusive: true });
  // The server keeps the other agents' rows when sharing turns off, so nothing is revoked.
  expect(replaceAssignments).not.toHaveBeenCalled();
});

it.each([
  ["needs_reconnect", "Needs reconnect"],
  ["error", "Failed"],
] as const)("shows a bank whose sync is %s with one Reconnect button", async (status, badge) => {
  const data = {
    ...mockIntegrations({
      servers: [
        mockServer("s1", "Mercury", {
          endpoint: "https://mcp.mercury.com/mcp",
          oauthStatus: "connected",
        }),
      ],
      financeSources: [{ provider: "mercury", serverId: "s1", status, lastSyncedAt: null }],
    }),
    refresh,
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
        <Routes>
          <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain(badge);
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.filter((b) => b.textContent === "Reconnect")).toHaveLength(1);
  expect(container.querySelector('[aria-label="Sign-in options"]')).toBeNull();
});

it("disables the row buttons and shows Creating agent while the agent is being created", async () => {
  let finish: (value: { server: object; botId: string }) => void = () => {};
  create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await show(false, undefined, {
    agentBotId: null,
    agentExclusive: false,
    transport: "streamable_http",
    oauthStatus: "connected",
  });
  await press("Create agent");
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === label,
    );
  for (const label of ["Rename", "Creating agent"]) {
    expect(button(label)?.disabled, label).toBe(true);
  }
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Sign-in options"]')?.disabled,
  ).toBe(true);
  expect(button("Create agent")).toBeUndefined();
  await act(async () => finish({ server: {}, botId: "bot_new" }));
});

it("shows a Devin agent section without the changes switch, and Mercury with it", async () => {
  await show(false, "https://mcp.devin.ai/mcp", { agentBotId: "bot_dev", agentExclusive: true });
  expect(container.querySelector('section[aria-label="Agent"]')).not.toBeNull();
  expect(container.textContent).toContain("Let other agents use");
  expect(writesSwitch()).toBeNull();
  expect(container.textContent).not.toContain("Allow changes in");
  await show(false, "https://mcp.mercury.com/mcp", {
    agentBotId: "bot_mer",
    agentExclusive: true,
  });
  expect(writesSwitch()).not.toBeNull();
});

it("says disconnecting Devin leaves its sessions running", async () => {
  await show(false, "https://mcp.devin.ai/mcp");
  await press("Remove Carta");
  expect(document.body.textContent).toContain("Devin sessions are not affected.");
});

it("draws the Granola agent link once, under the key status, and names the route when both are connected", async () => {
  const data = {
    ...mockIntegrations({
      servers: [
        mockServer("s1", "Granola", {
          endpoint: "https://mcp.granola.ai/mcp",
          agentBotId: "bot_ada",
          agentExclusive: true,
        }),
      ],
      meetings: {
        connectionId: "conn_1",
        status: "connected",
        syncedThrough: "2026-10-20T10:00:00Z",
        lastSyncedAt: null,
        syncedCount: 2,
        consentOff: false,
        agentBotId: "bot_ada",
      },
    }),
    refresh,
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
        <Routes>
          <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("Synced 2 meetings");
  expect(container.textContent).toContain("API key");
  expect(container.textContent).toContain("Sign-in");
  expect(container.querySelectorAll('a[href="/app/bot_ada"]')).toHaveLength(1);
  expect(container.querySelector("#server-writes")).toBeNull();
  expect(container.querySelector("#server-shared")).toBeNull();
});

it("titles the card as the service agent and says turning changes on creates it, before it exists", async () => {
  await show(false, "https://mcp.mercury.com/mcp", { agentBotId: null, agentExclusive: false });
  const agent = container.querySelector('section[aria-label="Agent"]');
  expect(agent?.textContent).toContain("Carta agent");
  expect(agent?.textContent).toContain("Creates a Carta agent that asks you before each change.");
  expect(agent?.textContent).not.toContain("Created when you allow changes");
});

it("lets a bank with no agent allow changes: confirming creates the agent and the switch reads on at once", async () => {
  let finish: (value: object) => void = () => {};
  create.mockResolvedValue({ server: {}, botId: "bot_new" });
  setWrites.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await show(false, "https://mcp.mercury.com/mcp", { agentBotId: null, agentExclusive: false });
  expect((writesSwitch() as HTMLInputElement).checked).toBe(false);
  await act(async () => writesSwitch()?.click());
  expect(create).not.toHaveBeenCalled();
  await press("Allow changes");
  expect((writesSwitch() as HTMLInputElement).checked).toBe(true);
  expect(create).toHaveBeenCalledWith({ serverId: "s1" });
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => finish({}));
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: true });
});

it("gives a bank with no agent one setup control (the switch), no Create agent, no sharing switch, and a setting-up note while allowing changes", async () => {
  setWrites.mockReturnValue(new Promise(() => {}));
  create.mockResolvedValue({ server: {}, botId: "bot_new" });
  await show(false, "https://mcp.mercury.com/mcp", { agentBotId: null, agentExclusive: false });
  expect(container.textContent).not.toContain("Create agent");
  expect(writesSwitch()).not.toBeNull();
  expect(container.querySelector("#server-shared")).toBeNull();
  expect(container.textContent).not.toContain("Setting up");
  await act(async () => writesSwitch()?.click());
  await press("Allow changes");
  expect(container.textContent).toContain("Setting up the agent");
});

it("turns the pending switch back off and shows the error when allowing changes fails", async () => {
  create.mockRejectedValue(new Error("nope"));
  await show(false, "https://mcp.mercury.com/mcp", { agentBotId: null, agentExclusive: false });
  await act(async () => writesSwitch()?.click());
  await press("Allow changes");
  expect(setWrites).not.toHaveBeenCalled();
  expect((writesSwitch() as HTMLInputElement).checked).toBe(false);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("shows a skeleton, not an empty page, while the connections load", async () => {
  const data = { ...mockIntegrations({ servers: [] }), loaded: false, refresh };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
        <Routes>
          <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="mcp-detail-loading"]')).not.toBeNull();
});

const brexList = {
  serverId: "s1",
  agentBotId: "bot_brex",
  writesEnabled: false,
  cards: [
    {
      cardId: "card_aaa",
      name: "Figma",
      lastFour: "4242",
      ownerUserId: "user_1",
      status: "ACTIVE",
      limitCents: 20_000,
      currency: "USD",
      duration: "MONTHLY",
    },
  ],
};
const brexControls = {
  maxNewCardLimitCents: 100_000,
  maxCardLimitCents: 500_000,
  maxSpendLimitBaseCents: 1_000_000,
  maxCardsPerDay: 5,
  allowedDurations: ["MONTHLY", "ONE_TIME"],
  oneTimeMaxDays: 90,
};
const showBrex = (writesEnabled = false) =>
  show(writesEnabled, BREX_CARDS_MCP_ENDPOINT, {
    name: "Brex cards",
    slug: "brex-cards",
    transport: "streamable_http",
    agentBotId: "bot_brex",
    agentExclusive: true,
    writesEnabled,
  });
const headings = () => [...container.querySelectorAll("h2")].map((h) => h.textContent);

it("Brex cards: the owner sees Cards, Controls and Replace token, and no sharing control or Unlock", async () => {
  brex.cards.mockResolvedValue(brexList);
  brex.getControls.mockResolvedValue(brexControls);
  await showBrex();
  expect(headings()).toEqual(expect.arrayContaining(["Cards", "Controls"]));
  expect(container.textContent).toContain("Figma");
  expect(
    [...container.querySelectorAll("button")].some((b) => b.textContent === "Replace token"),
  ).toBe(true);
  // The agent section stays, with its changes switch, but never the sharing control or its list.
  expect(writesSwitch()).not.toBeNull();
  expect(container.querySelector("#server-shared")).toBeNull();
  expect(container.textContent).not.toContain("Let other agents use");
  expect(container.textContent).not.toContain("Which agents can use");
  expect(container.textContent).not.toMatch(/unlock/i);
  // The token is pasted, not OAuth: no sign-in menu and no host line.
  expect(container.querySelector('[aria-label="Sign-in options"]')).toBeNull();
  expect(container.textContent).not.toContain("via MCP");
  // Changes are off, so the row buttons wait.
  const lock = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Lock",
  );
  expect(lock?.disabled).toBe(true);
});

it("Brex cards: row buttons enable once changes are on", async () => {
  brex.cards.mockResolvedValue({ ...brexList, writesEnabled: true });
  brex.getControls.mockResolvedValue(brexControls);
  await showBrex(true);
  const lock = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Lock",
  );
  expect(lock?.disabled).toBe(false);
});

it("Brex cards: row buttons follow the Allow changes switch without a reload, on and off", async () => {
  // The cards read happens once, while changes are off, and is never repeated.
  brex.cards.mockResolvedValue({ ...brexList, writesEnabled: false });
  brex.getControls.mockResolvedValue(brexControls);
  const lock = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === "Lock",
    );
  await showBrex(false);
  expect(lock()?.disabled).toBe(true);
  await showBrex(true);
  expect(lock()?.disabled).toBe(false);
  await showBrex(false);
  expect(lock()?.disabled).toBe(true);
  expect(brex.cards).toHaveBeenCalledTimes(1);
});

it("Brex cards: a stale cards answer that says changes are on does not enable buttons while the switch is off", async () => {
  brex.cards.mockResolvedValue({ ...brexList, writesEnabled: true });
  brex.getControls.mockResolvedValue(brexControls);
  await showBrex(false);
  const lock = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Lock",
  );
  expect(lock?.disabled).toBe(true);
});

it("Brex cards: a member (or former owner) is refused and sees none of the owner's sections", async () => {
  brex.cards.mockRejectedValue(
    Object.assign(new Error("Only the space owner can do this."), { code: "FORBIDDEN" }),
  );
  brex.getControls.mockRejectedValue(
    Object.assign(new Error("Only the space owner can do this."), { code: "FORBIDDEN" }),
  );
  await showBrex();
  expect(headings()).not.toContain("Cards");
  expect(headings()).not.toContain("Controls");
  expect(container.textContent).not.toContain("Replace token");
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector("#server-shared")).toBeNull();
  expect(brex.getControls).not.toHaveBeenCalled();
});

it("Brex cards: any answer but a successful read keeps Replace token and Controls hidden, and offers Retry", async () => {
  // A network error does not prove the viewer owns the space: ownership shows only after a read.
  brex.cards.mockRejectedValueOnce(new Error("Could not reach Brex"));
  brex.getControls.mockResolvedValue(brexControls);
  await showBrex();
  expect(container.textContent).toContain("Could not reach Brex");
  expect(headings()).toContain("Cards");
  expect(headings()).not.toContain("Controls");
  expect(
    [...container.querySelectorAll("button")].some((b) => b.textContent === "Replace token"),
  ).toBe(false);
  expect(brex.getControls).not.toHaveBeenCalled();
  // Retry reads again; a good answer then shows the owner's sections.
  brex.cards.mockResolvedValue(brexList);
  await press("Retry");
  expect(brex.cards).toHaveBeenCalledTimes(2);
  expect(headings()).toContain("Controls");
  expect(
    [...container.querySelectorAll("button")].some((b) => b.textContent === "Replace token"),
  ).toBe(true);
});

const replaceToken = () =>
  [...container.querySelectorAll("button")].some((b) => b.textContent === "Replace token");

it("Brex cards: a server error that ran past the owner checks shows Replace token but not Controls", async () => {
  // The server runs the Brex call only for the space owner who connected, so BAD_GATEWAY (Brex down
  // or its token revoked) proves the caller is that owner and the token can be replaced.
  for (const code of ["BAD_GATEWAY", "UNAUTHORIZED", "INTERNAL_SERVER_ERROR"]) {
    brex.cards
      .mockReset()
      .mockRejectedValue(Object.assign(new Error("Could not reach Brex"), { code }));
    await showBrex();
    expect(container.textContent).toContain("Could not reach Brex");
    expect(replaceToken(), code).toBe(true);
    expect(headings(), code).toContain("Cards");
    expect(headings(), code).not.toContain("Controls");
    expect(brex.getControls).not.toHaveBeenCalled();
    act(() => root.render(null));
  }
});

it("Brex cards: errors with no server code, FORBIDDEN and PRECONDITION_FAILED do not show Replace token", async () => {
  const failures: [string, unknown][] = [
    ["network", new TypeError("Failed to fetch")],
    ["aborted", new DOMException("The operation was aborted.", "AbortError")],
    ["forbidden", Object.assign(new Error("nope"), { code: "FORBIDDEN" })],
    [
      "someone else",
      Object.assign(
        new Error("Brex cards were connected by someone else. Disconnect and connect again."),
        { code: "PRECONDITION_FAILED" },
      ),
    ],
  ];
  for (const [name, failure] of failures) {
    brex.cards.mockReset().mockRejectedValue(failure);
    await showBrex();
    expect(replaceToken(), name).toBe(false);
    expect(headings(), name).not.toContain("Controls");
    act(() => root.render(null));
  }
});

it("Brex cards: PRECONDITION_FAILED shows the server's message as the Cards error", async () => {
  brex.cards.mockRejectedValue(
    Object.assign(
      new Error("Brex cards were connected by someone else. Disconnect and connect again."),
      { code: "PRECONDITION_FAILED" },
    ),
  );
  await showBrex();
  expect(headings()).toContain("Cards");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Brex cards were connected by someone else. Disconnect and connect again.",
  );
  expect(replaceToken()).toBe(false);
});

it("other servers never call the Brex RPCs", async () => {
  brex.cards.mockClear();
  await show(false, "https://mcp.example.com/sse");
  expect(brex.cards).not.toHaveBeenCalled();
});

it("Brex cards: Replace token shows the API error and the cards stay as they were", async () => {
  brex.cards.mockResolvedValue({ ...brexList, writesEnabled: true });
  brex.getControls.mockResolvedValue(brexControls);
  brex.replaceToken.mockRejectedValueOnce(new Error("Brex rejected this token"));
  await showBrex(true);
  await press("Replace token");
  const input = document.querySelector<HTMLInputElement>('input[aria-label="API token"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, "tok_bad");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click(),
  );
  expect(brex.replaceToken).toHaveBeenCalledWith({ token: "tok_bad" });
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Brex rejected this token");
  // The dialog stays open, nothing was reloaded or navigated, and the card is still listed.
  expect(brex.cards).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Figma");
});

it("All assigns every other agent and None removes them all except the owner", async () => {
  setAgentAssignment.mockClear();
  listAssignments.mockResolvedValue([]);
  await show(false, OTHER, { ...withAgent, agentExclusive: false });
  const names = () => [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(names()).toContain("All");
  await press("All");
  const given = setAgentAssignment.mock.calls.map(([call]) => call.botId);
  expect(given.length).toBeGreaterThan(0);
  expect(given).not.toContain("bot_ada");
  expect(setAgentAssignment.mock.calls.every(([call]) => call.on === true)).toBe(true);

  setAgentAssignment.mockClear();
  const entry = (botId: string) => ({
    botId,
    serverId: "s1",
    allowAllTools: true,
    allowedTools: [],
    id: `a_${botId}`,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  });
  listAssignments.mockImplementation(async ({ botId }: { botId: string }) => [entry(botId)]);
  const everyone = given.concat("bot_ada").map(entry);
  await show(false, OTHER, { ...withAgent, agentExclusive: false }, everyone);
  await press("None");
  const removed = setAgentAssignment.mock.calls.map(([call]) => call.botId);
  expect(removed.sort()).toEqual([...given].sort());
  expect(setAgentAssignment.mock.calls.every(([call]) => call.on === false)).toBe(true);
  // None never turns sharing off.
  expect(setExclusive).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Which agents can use");
  listAssignments.mockResolvedValue([]);
});

it("All waits for every grant to settle, even after one fails, before the controls come back", async () => {
  setAgentAssignment.mockReset();
  refresh.mockClear();
  listAssignments.mockResolvedValue([]);
  let finishSlow: () => void = () => undefined;
  setAgentAssignment.mockImplementationOnce(async () => {
    throw new Error("boom");
  });
  setAgentAssignment.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishSlow = resolve;
      }),
  );
  setAgentAssignment.mockResolvedValue([]);
  await show(false, OTHER, { ...withAgent, agentExclusive: false });
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === name)!;
  await act(async () => button("All").click());
  // One grant failed at once and one is still running: nothing is re-enabled or refetched yet.
  expect(button("All").disabled).toBe(true);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => finishSlow());
  expect(refresh).toHaveBeenCalled();
  expect(container.textContent).toContain("boom");
  expect(button("All").disabled).toBe(false);
});
