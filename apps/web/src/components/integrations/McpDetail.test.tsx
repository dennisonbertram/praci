// @vitest-environment jsdom

import type { BotMcpServer, McpServer } from "@rakazo/contracts";
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
vi.mock("../../lib/rpc", () => ({
  rpc: {
    mcp: {
      servers: { setWrites },
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
  act(() => root.render(null));
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

it("Carta links back to Cap table, hides the MCP host and names who loses access", async () => {
  await show(false);
  const link = container.querySelector<HTMLAnchorElement>('a[href="/app/cap-table"]');
  expect(link?.textContent).toBe("Open Cap table");
  expect(container.textContent).not.toContain("via MCP");
  expect(container.textContent).toContain("asks you before each one");
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
  expect(container.textContent).toContain("Disconnect sign-in");
  await render("reconnect");
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
  expect(container.textContent).toContain("Share with all agents");
  expect(container.querySelector<HTMLAnchorElement>('a[href="/app/bot_ada"]')?.textContent).toBe(
    "Ada",
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

it("Share with all agents saves at once and reveals Used by only while on", async () => {
  setExclusive.mockResolvedValue({});
  await show(false, OTHER, { ...withAgent, agentExclusive: true });
  expect(container.textContent).not.toContain("Used by");
  expect(container.querySelectorAll('[role="switch"][aria-label$="can use Carta"]')).toHaveLength(
    0,
  );
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  expect(setExclusive).toHaveBeenCalledWith({ serverId: "s1", exclusive: false });
  await show(false, OTHER, { ...withAgent, agentExclusive: false });
  expect(container.textContent).toContain("Used by");
  expect(
    container.querySelectorAll('[role="switch"][aria-label$="can use Carta"]').length,
  ).toBeGreaterThan(1);
});

it("uses the general Agent section for a linked Carta agent", async () => {
  setExclusive.mockResolvedValue({});
  await show(false);
  expect(container.querySelector('section[aria-label="Agent"]')).not.toBeNull();
  expect(container.querySelectorAll("#server-writes")).toHaveLength(1);
  expect(container.textContent).toContain("Share with all agents");
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

it("turning Share on lifts exclusivity before assigning every agent, and off returns to the owner alone", async () => {
  setExclusive.mockResolvedValue({});
  replaceAssignments.mockClear();
  replaceAssignments.mockResolvedValue([]);
  listAssignments.mockResolvedValue([]);
  await show(false, OTHER, { ...withAgent, agentExclusive: true });
  await act(async () => container.querySelector<HTMLElement>("#server-shared")?.click());
  const assigned = replaceAssignments.mock.calls.map(([call]) => call.botId);
  expect(assigned.length).toBeGreaterThan(1);
  expect(setExclusive).toHaveBeenLastCalledWith({ serverId: "s1", exclusive: false });
  // The server refuses to grant an exclusive server to other agents, so this must come first.
  expect(setExclusive.mock.invocationCallOrder[0]).toBeLessThan(
    replaceAssignments.mock.invocationCallOrder[0] ?? 0,
  );

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
  expect(replaceAssignments).toHaveBeenCalledTimes(1);
  expect(replaceAssignments.mock.calls[0]?.[0]).toMatchObject({
    botId: "bot_bram",
    assignments: [],
  });
});

it("disables the row buttons and shows Creating agent while the agent is being created", async () => {
  let finish: (value: { server: object; botId: string }) => void = () => {};
  create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await show(false, undefined, {
    agentBotId: null,
    agentExclusive: false,
    transport: "http",
    oauthStatus: "connected",
  });
  await press("Create agent");
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === label,
    );
  for (const label of ["Reconnect", "Disconnect sign-in", "Rename", "Creating agent"]) {
    expect(button(label)?.disabled, label).toBe(true);
  }
  expect(button("Create agent")).toBeUndefined();
  await act(async () => finish({ server: {}, botId: "bot_new" }));
});
