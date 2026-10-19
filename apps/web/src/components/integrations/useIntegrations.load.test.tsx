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
}));
vi.mock("../../lib/rpc", () => ({ rpc: rpcMock }));

import { type IntegrationsData, useIntegrations } from "./useIntegrations";

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
