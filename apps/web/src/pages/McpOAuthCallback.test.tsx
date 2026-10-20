// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";

const complete = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../lib/rpc", () => ({ rpc: { models: { completeOpenRouterOAuth: complete } } }));
vi.mock("@rakazo/ui-web", () => ({ Button: () => null }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s[0] }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { McpOAuthCallbackPage } from "./McpOAuthCallback";

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
