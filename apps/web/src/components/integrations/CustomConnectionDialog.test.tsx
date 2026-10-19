// @vitest-environment jsdom

import { CARTA_MCP_ENDPOINT, DEVIN_MCP_ENDPOINT, type McpServer } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IntegrationsData } from "./useIntegrations";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  begin: vi.fn(),
  open: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: { mcp: { servers: { create: api.create, remove: api.remove }, assignments: {} } },
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

async function mount(
  props: {
    apiKey?: boolean;
    keyHint?: string;
    oauthClient?: boolean;
    oauthScope?: string;
    service?: string;
    initialUrl?: string;
  } = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <CustomConnectionDialog
        data={data}
        initialUrl="https://example.com/mcp"
        onClose={vi.fn()}
        {...props}
      />,
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
  api.remove.mockResolvedValue({ ok: true });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("skips the bot step when the API already made the server's agent", async () => {
  api.create.mockResolvedValue({
    id: "srv-1",
    name: "Custom",
    endpoint: "https://mcp.example.test/mcp",
    agentBotId: "bot-1",
  });
  await mount();
  await type("Token", "tok");
  await click("Connect");
  expect(document.body.textContent).toContain("connected");
  expect(document.body.textContent).not.toContain("Continue");
});

it("skips the bot step after sign-in when the API already made the agent", async () => {
  api.create.mockResolvedValue({ ...server, agentBotId: "bot-1" });
  api.begin.mockResolvedValue({
    status: "authorization_required",
    authorizationUrl: "https://a/x",
  });
  api.open.mockReturnValue({ close: vi.fn(), closed: false });
  api.wait.mockResolvedValue("connected");
  await mount();
  await click("Connect");
  expect(document.body.textContent).toContain("connected");
  expect(document.body.textContent).not.toContain("Continue");
});

it("asks for bots after sign-in when no agent was made", async () => {
  api.begin.mockResolvedValue({
    status: "authorization_required",
    authorizationUrl: "https://a/x",
  });
  api.open.mockReturnValue({ close: vi.fn(), closed: false });
  api.wait.mockResolvedValue("connected");
  await mount();
  await click("Connect");
  expect(document.body.textContent).toContain("Continue");
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

it("shows no client ID fields for a normal custom connection", async () => {
  await mount();
  expect(field("Client ID")).toBeNull();
  expect(field("Client secret (optional)")).toBeNull();
});

it("shows the client ID fields and callback URL when the entry needs them, and sends them", async () => {
  api.begin.mockResolvedValue({ status: "already_connected" });
  await mount({ oauthClient: true, oauthScope: "tweet.read" });
  expect(field("Client secret (optional)").type).toBe("password");
  expect(field("Callback URL").value).toBe(`${window.location.origin}/mcp/oauth/callback`);
  await type("Client ID", "abc");
  await type("Client secret (optional)", "shh");
  await click("Connect");
  expect(api.begin).toHaveBeenCalledWith("srv-1", {
    oauthClient: { clientId: "abc", clientSecret: "shh", scope: "tweet.read" },
  });
});

it("asks for a client ID when the server cannot register one", async () => {
  api.begin.mockRejectedValueOnce(new Error("This server needs an OAuth client ID"));
  await mount();
  await click("Connect");
  expect(field("Client ID")).not.toBeNull();
  expect(document.body.textContent).toContain("This server needs an OAuth client ID");
});

it("locks the connection fields after the error and retries on the same server", async () => {
  api.begin.mockRejectedValueOnce(new Error("This server needs an OAuth client ID"));
  api.begin.mockResolvedValue({ status: "already_connected" });
  await mount();
  await click("Connect");
  expect((field("Server URL") as HTMLInputElement).readOnly).toBe(true);
  expect(field("Transport")).toBeNull();
  await type("Client ID", "abc");
  await click("Connect");
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.begin).toHaveBeenLastCalledWith("srv-1", { oauthClient: { clientId: "abc" } });
});

it("finishes Connect Carta right after sign-in: no agent step, and the done text is about Carta", async () => {
  const carta = { id: "srv-c", name: "Carta", endpoint: CARTA_MCP_ENDPOINT } as McpServer;
  api.create.mockResolvedValue(carta);
  api.begin.mockResolvedValue({
    status: "authorization_required",
    authorizationUrl: "https://a/x",
  });
  api.open.mockReturnValue({ close: vi.fn(), closed: false });
  api.wait.mockResolvedValue("connected");
  await mount({ service: "Carta", initialUrl: CARTA_MCP_ENDPOINT });
  await click("Sign in with Carta");
  expect(document.body.textContent).toContain("Carta connected");
  expect(document.body.textContent).toContain("The Carta agent can now read your cap table.");
  expect(document.body.textContent).not.toContain("Step 2 of 3");
});

it("removes a connection it just added when the server cannot be reached", async () => {
  api.begin.mockRejectedValueOnce(new Error("fetch failed: getaddrinfo ENOTFOUND example.com"));
  await mount();
  await click("Connect");
  expect(api.remove).toHaveBeenCalledWith({ id: "srv-1" });
  expect(document.body.textContent).toContain(
    "Could not reach example.com. Check the address and try again.",
  );
  expect(document.body.textContent).not.toContain("ENOTFOUND");
  expect(document.body.textContent).not.toContain("Needs reconnect");
});

it("asks only for an API key and stores it as the bearer secret, with no sign-in", async () => {
  await mount({
    apiKey: true,
    service: "Devin",
    initialUrl: DEVIN_MCP_ENDPOINT,
    keyHint: "An org-scoped Devin service-user key (starts with cog_).",
  });
  expect(document.body.textContent).toContain(
    "An org-scoped Devin service-user key (starts with cog_).",
  );
  expect(field("Server URL")).toBeNull();
  expect(field("API key").type).toBe("password");
  const connect = [...document.querySelectorAll("button")].find((b) => b.textContent === "Connect");
  expect(connect?.disabled).toBe(true);
  await type("API key", "cog_placeholder");
  await click("Connect");
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: DEVIN_MCP_ENDPOINT,
      secret: "cog_placeholder",
      headers: {},
    }),
  );
  expect(api.begin).not.toHaveBeenCalled();
});

const devinProps = { apiKey: true, service: "Devin", initialUrl: DEVIN_MCP_ENDPOINT } as const;

it("does not submit or start sign-in when Enter is pressed without an API key", async () => {
  await mount(devinProps);
  await act(async () => {
    field("API key").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(api.create).not.toHaveBeenCalled();
  expect(api.begin).not.toHaveBeenCalled();
});

it("skips the bot step for Devin because the API creates its agent", async () => {
  api.create.mockResolvedValue({ id: "srv-d", name: "Devin", endpoint: DEVIN_MCP_ENDPOINT });
  await mount(devinProps);
  await type("API key", "cog_placeholder");
  await click("Connect");
  expect(document.body.textContent).toContain("Devin connected");
  expect(document.body.textContent).not.toContain("Continue");
  expect(api.begin).not.toHaveBeenCalled();
});

it("shows the API error when Devin rejects the key", async () => {
  api.create.mockRejectedValue(
    new Error("Could not connect to Devin. Check the API key and try again."),
  );
  await mount(devinProps);
  await type("API key", "cog_placeholder");
  await click("Connect");
  expect(document.body.textContent).toContain("Could not connect to Devin.");
  expect(document.body.textContent).not.toContain("connected");
});
