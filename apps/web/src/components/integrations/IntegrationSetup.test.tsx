// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  integrationSetup: { get: vi.fn(), save: vi.fn() },
  mcp: {
    servers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
    assignments: { approve: vi.fn() },
  },
}));
vi.mock("../../lib/rpc", () => ({ rpc: api }));
vi.mock("../../lib/mcp-connect", () => ({ connectMcpOauth: vi.fn() }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts[0] }),
  Trans: ({ children }: ComponentProps<"span">) => children,
}));

import { connectMcpOauth } from "../../lib/mcp-connect";
import { IntegrationSetup } from "./IntegrationSetup";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

afterEach(() => {
  document.body.replaceChildren();
  api.integrationSetup.get.mockReset();
  api.integrationSetup.save.mockReset();
  api.mcp.servers.list.mockReset();
  api.mcp.servers.create.mockReset();
  api.mcp.servers.update.mockReset();
  api.mcp.assignments.approve.mockReset();
  vi.mocked(connectMcpOauth).mockReset();
});

it("does not show a connect error when a saved provider refresh fails", async () => {
  api.integrationSetup.save.mockResolvedValue(undefined);
  api.integrationSetup.get.mockRejectedValue(new Error("refresh unavailable"));
  const onSaved = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <IntegrationSetup
        serverSetup
        managedOnly
        initialState={{
          canConfigure: true,
          needsSetup: false,
          webUrl: "http://localhost:3000",
          providers: [{ id: "composio", configured: false }],
        }}
        onSaved={onSaved}
      />,
    );
  });

  const key = container.querySelector<HTMLInputElement>('input[type="password"]');
  expect(key).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(key, "test-key");
    key?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Connect")
      ?.click();
  });

  expect(api.integrationSetup.save).toHaveBeenCalledOnce();
  expect(api.integrationSetup.get).toHaveBeenCalledOnce();
  expect(onSaved).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="alert"]')).toBeNull();

  await act(async () => root.unmount());
});

function renderSetup(props: ComponentProps<typeof IntegrationSetup>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<IntegrationSetup {...props} />));
  return { container, root };
}

it("shows an error and does not assign or mark the server connected when sign-in is cancelled", async () => {
  api.mcp.servers.list.mockResolvedValue([]);
  api.mcp.servers.create.mockResolvedValue({ id: "server-1" });
  vi.mocked(connectMcpOauth).mockResolvedValue("cancelled");
  const { container, root } = renderSetup({ embedded: true, botId: "bot-1" });
  const url = container.querySelector<HTMLInputElement>('input[aria-label="Server URL"]');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(url, "https://example.com/mcp");
    url?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Connect")
      ?.click();
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Sign-in was cancelled or did not finish. Try again.",
  );
  expect(api.mcp.assignments.approve).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("Connected");
  await act(async () => root.unmount());
});

it("clears an executor token after its server is saved", async () => {
  api.mcp.servers.list.mockResolvedValue([]);
  api.mcp.servers.create.mockResolvedValue({ id: "server-1" });
  vi.mocked(connectMcpOauth).mockResolvedValue("cancelled");
  const { container, root } = renderSetup({
    serverSetup: true,
    initialChoice: "executor",
    initialState: {
      canConfigure: true,
      needsSetup: false,
      webUrl: "http://localhost:3000",
      providers: [],
    },
  });
  const token = container.querySelector<HTMLInputElement>('input[type="password"]');
  const endpoint = container.querySelector<HTMLInputElement>(
    'input[placeholder="http://localhost:8000/mcp"]',
  );
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(token, "test-token");
    token?.dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(endpoint, "http://localhost:8000/mcp");
    endpoint?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Connect")
      ?.click();
  });
  expect(token?.value).toBe("");
  await act(async () => root.unmount());
});

it("keeps an executor token when saving its server fails", async () => {
  api.mcp.servers.list.mockResolvedValue([]);
  api.mcp.servers.create.mockRejectedValue(new Error("save failed"));
  const { container, root } = renderSetup({
    serverSetup: true,
    initialChoice: "executor",
    initialState: {
      canConfigure: true,
      needsSetup: false,
      webUrl: "http://localhost:3000",
      providers: [],
    },
  });
  const token = container.querySelector<HTMLInputElement>('input[type="password"]');
  const endpoint = container.querySelector<HTMLInputElement>(
    'input[placeholder="http://localhost:8000/mcp"]',
  );
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(token, "test-token");
    token?.dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(endpoint, "http://localhost:8000/mcp");
    endpoint?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Connect")
      ?.click();
  });
  expect(token?.value).toBe("test-token");
  expect(connectMcpOauth).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
