// @vitest-environment jsdom

import { MCP_OAUTH_CLIENT_ID_REQUIRED } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("../../lib/mcp-connect", () => ({ connectMcpOauth: api.connect }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts[0] }),
}));

import { useMcpReconnect } from "./useMcpReconnect";

let latest: ReturnType<typeof useMcpReconnect>;
function Probe() {
  latest = useMcpReconnect("srv-1", vi.fn());
  return null;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

it("asks for a client ID instead of showing an error when the server needs one", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.connect.mockRejectedValue(new Error(MCP_OAUTH_CLIENT_ID_REQUIRED));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<Probe />));
  await act(async () => latest.run());
  expect(latest.needsClient).toBe(true);
  expect(latest.error).toBeNull();
});
