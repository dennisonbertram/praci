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
    access: vi.fn(),
    accessAll: vi.fn(async () => ({})),
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
  rpcMock.connections.accessAll.mockResolvedValue({
    a: { allAgents: true, botIds: [], agentShared: true },
    b: { allAgents: true, botIds: [], agentShared: true },
    c: { allAgents: true, botIds: [], agentShared: true },
  });
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

it("loads access for all connections in one accessAll call", async () => {
  rpcMock.connections.list.mockResolvedValue([conn("a"), conn("b")]);
  rpcMock.connections.access.mockClear();
  rpcMock.connections.accessAll.mockResolvedValue({
    a: { allAgents: true, botIds: [], agentShared: true },
    b: { allAgents: false, botIds: ["x"], agentShared: false },
  });
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(rpcMock.connections.access).not.toHaveBeenCalled();
  expect(Object.keys(data?.access ?? {}).sort()).toEqual(["a", "b"]);
  expect(data?.access.b?.botIds).toEqual(["x"]);
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

it("keeps the previous connections when the list fails on refresh", async () => {
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockResolvedValueOnce([conn("existing")]);
  rpcMock.connections.list.mockRejectedValueOnce(new Error("list failed"));
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(data?.connections.map((c) => c.id)).toEqual(["existing"]);
  await act(async () => data?.refresh());
  expect(data?.connections.map((c) => c.id)).toEqual(["existing"]);
  expect(data?.error).toBe("list failed");
  await act(async () => root.unmount());
});

it("keeps previous connection access when an access request fails", async () => {
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockResolvedValue([conn("private")]);
  rpcMock.connections.accessAll.mockReset();
  rpcMock.connections.accessAll.mockResolvedValueOnce({
    private: { allAgents: false, botIds: [], agentShared: false },
  });
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(data?.access.private?.agentShared).toBe(false);
  rpcMock.connections.accessAll.mockRejectedValueOnce(new Error("access failed"));
  await act(async () => data?.refresh());
  expect(data?.access.private?.agentShared).toBe(false);
  expect(data?.error).toBe("access failed");
  await act(async () => root.unmount());
});

it("marks a failed first load as loaded and keeps connections empty", async () => {
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockRejectedValueOnce(new Error("list failed"));
  rpcMock.connections.effectiveAccess.mockReset();
  rpcMock.connections.accessAll.mockReset();
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(data?.loaded).toBe(true);
  expect(data?.error).toBe("list failed");
  expect(data?.connections).toEqual([]);
  expect(data?.access).toEqual({});
  await act(async () => root.unmount());
});

it("keeps prior access when effective access fails", async () => {
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockResolvedValue([conn("private")]);
  rpcMock.connections.accessAll.mockReset();
  rpcMock.connections.accessAll.mockResolvedValue({
    private: { allAgents: false, botIds: [], agentShared: false },
  });
  rpcMock.connections.effectiveAccess.mockReset();
  rpcMock.connections.effectiveAccess.mockResolvedValueOnce({
    private: { shared: "some", botIds: ["bot-1"] },
  });
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  const previousAccess = data?.access.private;
  rpcMock.connections.effectiveAccess.mockRejectedValueOnce(new Error("effective access failed"));
  await act(async () => data?.refresh());
  expect(data?.access.private).toEqual(previousAccess);
  expect(data?.error).toBe("effective access failed");
  await act(async () => root.unmount());
});

it("keeps the newer data when an older overlapping refresh finishes last", async () => {
  let resolveOlder: (rows: unknown[]) => void = () => {};
  let resolveNewer: (rows: unknown[]) => void = () => {};
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list
    .mockImplementationOnce(() => new Promise((resolve) => (resolveOlder = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveNewer = resolve)));
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  const dispatch = vi.spyOn(window, "dispatchEvent");
  let integrationEvents = 0;
  const onIntegrationsChanged = (event: Event) => {
    if (event.type === "rakazo:integrations-changed") integrationEvents += 1;
  };
  window.addEventListener("rakazo:integrations-changed", onIntegrationsChanged);
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  let newerRefresh: Promise<void> | undefined;
  await act(async () => {
    newerRefresh = data?.refresh();
  });
  await act(async () => resolveNewer([conn("newer")]));
  await act(async () => newerRefresh);
  await act(async () => resolveOlder([conn("older")]));
  await act(async () => {});
  expect(data?.connections.map((c) => c.id)).toEqual(["newer"]);
  expect(integrationEvents).toBe(1);
  window.removeEventListener("rakazo:integrations-changed", onIntegrationsChanged);
  dispatch.mockRestore();
  await act(async () => root.unmount());
});

it("flags a failed Granola status and keeps the last status shown", async () => {
  const shown = {
    connectionId: "c",
    status: "connected" as const,
    syncedThrough: "2026-10-20T10:00:00Z",
    lastSyncedAt: null,
    syncedCount: 2,
    consentOff: false,
    agentBotId: null,
  };
  rpcMock.connections.list.mockReset();
  rpcMock.connections.list.mockResolvedValue([]);
  rpcMock.connections.effectiveAccess.mockResolvedValue({});
  rpcMock.meetings.status.mockReset();
  rpcMock.meetings.status
    .mockRejectedValueOnce(new Error("down"))
    .mockResolvedValueOnce(shown)
    .mockRejectedValueOnce(new Error("down"));
  let data: IntegrationsData | undefined;
  function Probe() {
    data = useIntegrations();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => {});
  expect(data?.meetings).toBeUndefined();
  expect(data?.meetingsFailed).toBe(true);
  await act(async () => data?.refresh());
  expect(data?.meetings).toEqual(shown);
  expect(data?.meetingsFailed).toBe(false);
  await act(async () => data?.refresh());
  expect(data?.meetings).toEqual(shown);
  expect(data?.meetingsFailed).toBe(true);
  await act(async () => root.unmount());
});
