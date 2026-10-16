// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const servers = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ rpc: { mcp: { servers: { list: servers } } } }));

import { useAutoCreateCartaAgent } from "./carta-agent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const carta = { id: "s1", enabled: true, endpoint: "https://mcp.app.carta.com/mcp" };
const create = vi.fn();

function Probe({
  ready,
  hasAgent,
  botsVersion,
}: {
  ready: boolean;
  hasAgent: boolean;
  botsVersion?: number;
}) {
  useAutoCreateCartaAgent(ready, hasAgent, create, botsVersion);
  return null;
}

const container = document.createElement("div");
const root = createRoot(container);
const show = (ready: boolean, hasAgent: boolean) =>
  act(async () => root.render(<Probe ready={ready} hasAgent={hasAgent} />));

afterEach(() => {
  create.mockReset();
  servers.mockReset();
  act(() => root.render(null));
});

it("creates the agent once when Carta is connected and the agent is missing", async () => {
  servers.mockResolvedValue([carta]);
  await show(true, false);
  await show(true, false);
  await show(true, false);
  expect(create).toHaveBeenCalledTimes(1);
});

it("waits for the bot list, and skips when the agent exists or Carta is not connected", async () => {
  servers.mockResolvedValue([carta]);
  await show(false, false);
  await show(true, true);
  expect(create).not.toHaveBeenCalled();
  servers.mockResolvedValue([]);
  await show(false, false);
  await show(true, false);
  expect(create).not.toHaveBeenCalled();
});

it("retries a failed creation once per bot list refresh, not on every render", async () => {
  servers.mockResolvedValue([carta]);
  create.mockResolvedValue(false);
  const showAt = (version: number) =>
    act(async () => root.render(<Probe ready hasAgent={false} botsVersion={version} />));
  await showAt(1);
  await showAt(1);
  expect(create).toHaveBeenCalledTimes(1);
  await showAt(2);
  expect(create).toHaveBeenCalledTimes(2);
  await showAt(2);
  expect(create).toHaveBeenCalledTimes(2);
});

it("creates the agent after a sign-in that happened once the first check had found no Carta", async () => {
  servers.mockResolvedValue([]);
  await show(true, false);
  expect(create).not.toHaveBeenCalled();
  servers.mockResolvedValue([carta]);
  await act(async () => void window.dispatchEvent(new Event("focus")));
  expect(create).toHaveBeenCalledTimes(1);
});
