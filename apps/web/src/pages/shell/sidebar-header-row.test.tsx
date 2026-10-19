// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RakazoDesktop } from "../../lib/desktop";
import { SidebarHeaderRow } from "./sidebar-header-row";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings.join("") }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as { rakazoDesktop?: RakazoDesktop }).rakazoDesktop;
});

async function render() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <SidebarHeaderRow
        search={<input data-testid="sidebar-search" />}
        actions={<button type="button" data-testid="create-menu-trigger" />}
      />,
    ),
  );
  return container;
}

describe("SidebarHeaderRow", () => {
  it("puts the window controls, Search and the header buttons in one row, in that order", async () => {
    (window as { rakazoDesktop?: unknown }).rakazoDesktop = { platform: "darwin" };
    const container = await render();
    const chrome = container.querySelector("[data-testid=sidebar-window-chrome]");
    const search = container.querySelector("[data-testid=sidebar-search]");
    const actions = container.querySelector("[data-testid=create-menu-trigger]");
    const row = chrome?.parentElement;
    expect(row).toBeTruthy();
    expect(search?.parentElement).toBe(row);
    expect(actions?.parentElement).toBe(row);
    expect([...(row?.children ?? [])]).toEqual([chrome, search, actions]);
  });

  it("has no window-controls slot in a browser", async () => {
    const container = await render();
    expect(container.querySelector("[data-testid=sidebar-window-chrome]")).toBeNull();
    expect(container.querySelector("[data-testid=sidebar-search]")).toBeTruthy();
  });
});
