// @vitest-environment jsdom

import type { McpServer } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IntegrationsData } from "./useIntegrations";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  begin: vi.fn(),
  open: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: { mcp: { servers: { create: api.create }, assignments: {} } },
}));
vi.mock("../../lib/mcp-connect", () => ({
  beginMcpOauth: api.begin,
  openMcpAuthorization: api.open,
  waitForMcpOauth: api.wait,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { CustomConnectionDialog } from "./CustomConnectionDialog";

const server = { id: "srv-1", name: "Example", endpoint: "https://example.com/mcp" } as McpServer;
const data = {
  loaded: true,
  servers: [],
  bots: [],
  feedEnabled: false,
  refresh: vi.fn().mockResolvedValue(undefined),
} as unknown as IntegrationsData;

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <CustomConnectionDialog data={data} initialUrl="https://example.com/mcp" onClose={vi.fn()} />,
    );
  });
}
const field = (label: string) =>
  document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLSelectElement;
async function type(label: string, value: string) {
  const el = field(label);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
const click = (label: string) =>
  act(async () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === label)?.click();
  });

beforeEach(() => {
  api.create.mockResolvedValue(server);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("adds an SSE-only server when SSE is chosen", async () => {
  await mount();
  await type("Transport", "sse");
  await type("Token", "tok");
  await click("Connect");
  expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ transport: "sse" }));
});

it("sends a bearer token and a custom header together", async () => {
  await mount();
  await type("Auth header", "X-Api-Key");
  await type("Header value", "abc");
  await type("Token", "tok");
  await click("Connect");
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      transport: "streamable_http",
      headers: { "X-Api-Key": "abc" },
      secret: "tok",
    }),
  );
});

it("does not open a sign-in window for an attempt cancelled while it was starting", async () => {
  let finish: (value: unknown) => void = () => undefined;
  api.begin.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await mount();
  await click("Connect");
  // Close the dialog (Cancel) while the sign-in request is in flight.
  await click("Cancel");
  await act(async () => {
    finish({ status: "authorization_required", authorizationUrl: "https://auth.test/x" });
  });
  expect(api.open).not.toHaveBeenCalled();
});
