// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { PLUGIN_CONNECT_WINDOW } from "../lib/plugin-connect";
import { ConnectedCallbackPage } from "./ConnectedCallback";

async function renderPage() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/integrations/connected?status=success"]}>
        <Routes>
          <Route path="/integrations/connected" element={<ConnectedCallbackPage />} />
          <Route path="/app/integrations" element={<div>integrations page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return { text: () => container.textContent, unmount: () => act(async () => root.unmount()) };
}

afterEach(() => {
  window.name = "";
  vi.restoreAllMocks();
});

it("closes the connect popup", async () => {
  window.name = PLUGIN_CONNECT_WINDOW;
  const close = vi.spyOn(window, "close").mockImplementation(() => {});
  const view = await renderPage();
  expect(close).toHaveBeenCalled();
  expect(view.text()).not.toContain("integrations page");
  await view.unmount();
});

it("returns to integrations when it is not the popup", async () => {
  const close = vi.spyOn(window, "close").mockImplementation(() => {});
  const view = await renderPage();
  expect(close).not.toHaveBeenCalled();
  expect(view.text()).toContain("integrations page");
  await view.unmount();
});
