// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const complete = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../lib/rpc", () => ({ rpc: { models: { completeOpenRouterOAuth: complete } } }));
vi.mock("@rakazo/ui-web", () => ({ Button: () => null }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s[0] }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { McpOAuthCallbackPage } from "./McpOAuthCallback";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage() {}
      close() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("reads the OpenRouter state from the path and the code from the query", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/models/openrouter/callback/st-1?code=abc"]}>
        <Routes>
          <Route
            path="/models/openrouter/callback/:state"
            element={<McpOAuthCallbackPage provider="openrouter" />}
          />
        </Routes>
      </MemoryRouter>,
    );
  });
  expect(complete).toHaveBeenCalledWith({ code: "abc", state: "st-1" });
  await act(async () => root.unmount());
});

it("shows a generic cancellation message instead of MCP callback query text", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={["/mcp/oauth/callback?error=access_denied&error_description=Call%20us"]}
      >
        <Routes>
          <Route path="/mcp/oauth/callback" element={<McpOAuthCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("OAuth authorization was cancelled.");
  expect(container.textContent).not.toContain("Call us");
});

it("shows a generic cancellation message for an OpenRouter callback without a code", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={[
          "/models/openrouter/callback/st-1?error=access_denied&error_description=Call%20us",
        ]}
      >
        <Routes>
          <Route
            path="/models/openrouter/callback/:state"
            element={<McpOAuthCallbackPage provider="openrouter" />}
          />
        </Routes>
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("OAuth authorization was cancelled.");
  expect(container.textContent).not.toContain("Call us");
});
