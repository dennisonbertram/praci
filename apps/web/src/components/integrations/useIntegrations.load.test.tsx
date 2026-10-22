// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s[0] }),
}));
const conn = (id: string) => ({ id, status: "connected" });
const rpcMock = vi.hoisted(() => ({
  connections: {
    catalog: vi.fn(async () => []),
    list: vi.fn(),
    access: vi.fn(async () => ({ allAgents: true, botIds: [] })),
    effectiveAccess: vi.fn(),
  },
  mcp: { servers: { list: vi.fn(async () => []) }, assignments: { all: vi.fn(async () => []) } },
  bots: { list: vi.fn(async () => []) },
  capabilities: { list: vi.fn(async () => []), catalogSearch: vi.fn(async () => ({})) },
  integrationSetup: { get: vi.fn(async () => null) },
  finance: { overview: vi.fn(async () => null) },
  meetings: { status: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({ rpc: rpcMock, selectedSpaceId: () => null }));
const session = vi.hoisted(() => ({ id: "user-1" }));
vi.mock("../../lib/auth", () => ({
  authClient: { useSession: () => ({ data: { user: { id: session.id } } }) },
}));

import type { IntegrationsData } from "./useIntegrations";
import { useIntegrations } from "./useIntegrations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("loads effective access once for all connections", async () => {
  rpcMock.connections.list.mockResolvedValue([conn("a"), conn("b"), conn("c")]);
  rpcMock.connections.effectiveAccess.mockResolvedValue({
    a: { shared: "all", botIds: ["x"] },
    b: { shared: "none", botIds: [] },
  });
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(rpcMock.connections.effectiveAccess).toHaveBeenCalledTimes(1);
  expect(data?.access.a?.effectiveAccess.botIds).toEqual(["x"]);
  expect(data?.access.c?.effectiveAccess).toEqual({ shared: "none", botIds: [] });
  await act(async () => root.unmount());
});

it("polls meetings.status every 5 seconds while Syncing and stops once Synced", async () => {
  vi.useFakeTimers();
  try {
    const status = (syncedThrough: string | null) => ({
      connectionId: "c",
      status: "connected" as const,
      syncedThrough,
      lastSyncedAt: null,
      syncedCount: 2,
      consentOff: false,
      agentBotId: null,
    });
    rpcMock.connections.list.mockResolvedValue([]);
    rpcMock.connections.effectiveAccess.mockResolvedValue({});
    rpcMock.meetings.status.mockReset();
    rpcMock.meetings.status
      .mockResolvedValueOnce(status(null))
      .mockResolvedValueOnce(status(null))
      .mockResolvedValue(status("2026-10-20T10:00:00Z"));
    let data: IntegrationsData | undefined;
    function Probe() {
      data = useIntegrations();
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
    await act(async () => {});
    expect(data?.meetings?.syncedThrough).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(data?.meetings?.syncedThrough).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(data?.meetings?.syncedThrough).toBe("2026-10-20T10:00:00Z");
    const calls = rpcMock.meetings.status.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(rpcMock.meetings.status.mock.calls.length).toBe(calls);
    await act(async () => root.unmount());
  } finally {
    vi.useRealTimers();
  }
});

it("drops a response for the previous account and loads again for the new one", async () => {
  session.id = "user-1";
  let release: (rows: unknown[]) => void = () => {};
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockImplementationOnce(() => new Promise((r) => (release = r)));
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  // The person switches account while user-1's request is still outstanding.
  rpcMock.connections.list.mockResolvedValue([conn("b")]);
  session.id = "user-2";
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(data?.connections.map((c) => c.id)).toEqual(["b"]);
  await act(async () => release([conn("a")]));
  expect(data?.connections.map((c) => c.id)).toEqual(["b"]);
  await act(async () => root.unmount());
});
