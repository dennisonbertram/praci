// @vitest-environment jsdom
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearAgentAppCache,
  INTEGRATIONS_CHANGED_EVENT,
  lookupBotApp,
  useAgentApp,
} from "./agent-app";
import { rpc } from "./rpc";

vi.mock("./rpc", () => ({
  rpc: {
    bots: { list: vi.fn() },
    connections: { list: vi.fn(), catalog: vi.fn() },
    mcp: { servers: { list: vi.fn() } },
  },
}));

type Ctx = { context: { spaceId: string } };
let container: HTMLDivElement;
let root: Root;
let lookup: ReturnType<typeof useAgentApp>;

function Probe({ spaces }: { spaces: string[] }) {
  lookup = useAgentApp("u1", spaces);
  return null;
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  vi.resetAllMocks();
  clearAgentAppCache();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(rpc.connections.list).mockResolvedValue([] as never);
  vi.mocked(rpc.connections.catalog).mockResolvedValue([] as never);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("resolves integration agents in every space, not only the active one", async () => {
  vi.mocked(rpc.bots.list).mockImplementation(((_: unknown, ctx: Ctx) =>
    Promise.resolve([
      { id: `b_${ctx.context.spaceId}`, spawnKey: "integration-agent:s" },
    ])) as never);
  vi.mocked(rpc.mcp.servers.list).mockImplementation(((_: unknown, ctx: Ctx) =>
    Promise.resolve([
      {
        name: `Mercury ${ctx.context.spaceId}`,
        endpoint: null,
        agentBotId: `b_${ctx.context.spaceId}`,
      },
    ])) as never);
  await act(async () => root.render(<Probe spaces={["s1", "s2"]} />));
  await settle();
  expect(lookup("b_s1", "s1")?.name).toBe("Mercury s1");
  expect(lookup("b_s2", "s2")?.name).toBe("Mercury s2");
  expect(lookup("b_s1", "s2")).toBeUndefined();
});

it("does not cache a failed lookup, and looks again after an integrations change", async () => {
  vi.mocked(rpc.bots.list).mockRejectedValueOnce(new Error("down"));
  await act(async () => root.render(<Probe spaces={["s1"]} />));
  await settle();
  expect(lookup("b1", "s1")).toBeUndefined();
  vi.mocked(rpc.bots.list).mockResolvedValue([
    { id: "b1", spawnKey: "integration-agent:s" },
  ] as never);
  vi.mocked(rpc.mcp.servers.list).mockResolvedValue([
    { name: "Brex", endpoint: null, agentBotId: "b1" },
  ] as never);
  await act(async () => {
    window.dispatchEvent(new Event(INTEGRATIONS_CHANGED_EVENT));
  });
  await settle();
  expect(lookup("b1", "s1")?.name).toBe("Brex");
});

it("marks a bank agent by its endpoint even after the connection is renamed", async () => {
  vi.mocked(rpc.bots.list).mockResolvedValue([
    { id: "b1", spawnKey: "integration-agent:s" },
  ] as never);
  vi.mocked(rpc.mcp.servers.list).mockResolvedValue([
    { name: "Mercury Operating", endpoint: "https://mcp.mercury.com/mcp", agentBotId: "b1" },
  ] as never);
  await act(async () => root.render(<Probe spaces={["s1"]} />));
  await settle();
  expect(lookup("b1", "s1")?.bank).toBe(true);
});

it("finds a toast's bot in the spaces already loaded, without another bots.list", async () => {
  vi.mocked(rpc.bots.list).mockResolvedValue([
    { id: "b1", spawnKey: "integration-agent:s", color: "#000" },
  ] as never);
  vi.mocked(rpc.mcp.servers.list).mockResolvedValue([
    { name: "Brex", endpoint: null, agentBotId: "b1" },
  ] as never);
  await act(async () => root.render(<Probe spaces={["s1"]} />));
  await settle();
  const calls = vi.mocked(rpc.bots.list).mock.calls.length;
  const found = await lookupBotApp("u1", "b1");
  await lookupBotApp("u1", "b1");
  expect(found?.app?.name).toBe("Brex");
  expect(rpc.bots.list).toHaveBeenCalledTimes(calls);
});
