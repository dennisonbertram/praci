// @vitest-environment jsdom

import type { McpServer } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { BOTS_CHANGED_EVENT, type BotsChangedDetail } from "../../lib/bots-changed";
import { mockIntegrations, mockServer } from "../../stories/fixtures";

const setWrites = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const setExclusive = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { mcp: { servers: { setWrites } }, integrationAgents: { create, setExclusive } },
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

async function show(
  writesEnabled: boolean,
  endpoint = "https://mcp.app.carta.com/mcp",
  extra: Partial<McpServer> = {},
) {
  const data = {
    ...mockIntegrations({
      servers: [mockServer("s1", "Carta", { endpoint, writesEnabled, ...extra })],
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
  let done: (() => void) | undefined;
  const onChanged = (event: Event) => {
    done = (event as CustomEvent<BotsChangedDetail>).detail.done;
  };
  window.addEventListener(BOTS_CHANGED_EVENT, onChanged);
  const pressed = press("Create agent");
  await act(async () => {
    await Promise.resolve();
  });
  // Shell must reload its bot list before the new id is routed, or it shows the first bot.
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => done?.());
  await pressed;
  window.removeEventListener(BOTS_CHANGED_EVENT, onChanged);
  expect(create).toHaveBeenCalledWith({ serverId: "s1" });
  expect(navigate).toHaveBeenCalledWith("/app/bot_new");
});

it("still opens the new agent when nothing answers the bots refresh", async () => {
  vi.useFakeTimers();
  create.mockResolvedValue({ server: {}, botId: "bot_new" });
  await show(false, OTHER);
  const pressed = press("Create agent");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  await pressed;
  vi.useRealTimers();
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
  expect(container.textContent).toContain("Only this agent");
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

it("Only this agent saves at once and, while on, Used by lists only the agent", async () => {
  setExclusive.mockResolvedValue({});
  await show(false, OTHER, withAgent);
  expect(container.textContent).toContain("Bram");
  await act(async () => container.querySelector<HTMLElement>("#server-exclusive")?.click());
  expect(setExclusive).toHaveBeenCalledWith({ serverId: "s1", exclusive: true });
  await show(false, OTHER, { ...withAgent, agentExclusive: true });
  expect(container.textContent).not.toContain("Bram can use");
  expect(container.querySelectorAll('[role="switch"][aria-label$="can use Carta"]')).toHaveLength(
    1,
  );
});
