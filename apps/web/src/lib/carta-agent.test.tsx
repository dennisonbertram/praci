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

function Probe({ ready, hasAgent }: { ready: boolean; hasAgent: boolean }) {
  useAutoCreateCartaAgent(ready, hasAgent, create);
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
