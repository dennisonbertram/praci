// @vitest-environment jsdom
import type { SidebarPagesState } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { sidebarPages: rpcMock } }));
vi.mock("../../lib/user-error", () => ({ errorText: () => "Could not save" }));

import { SIDEBAR_PAGES_CHANGED_EVENT } from "../../lib/sidebar-pages-event";
import { PageCard } from "./page-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notAdded = {
  pages: [],
  addable: [],
  botPages: [{ botId: "b1", pages: [{ id: "p1", title: "Support (renamed)" }] }],
};
const added = {
  pages: [{ pageId: "p1", botId: "b1", title: "Support (renamed)" }],
  addable: [],
  botPages: [],
};

let path = "";
function Path() {
  path = useLocation().pathname;
  return null;
}
async function render() {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () =>
    createRoot(host).render(
      <MemoryRouter>
        <Path />
        <PageCard botId="b1" pageId="p1" title="Support" />
      </MemoryRouter>,
    ),
  );
  return host;
}
const click = (el: Element | null | undefined) =>
  act(async () => void el?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
it("lists the sidebar once for the cards that mount together and once per change", async () => {
  rpcMock.list.mockResolvedValue(notAdded);
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () =>
    createRoot(host).render(
      <MemoryRouter>
        <PageCard botId="b1" pageId="p1" title="One" />
        <PageCard botId="b1" pageId="p2" title="Two" />
        <PageCard botId="b1" pageId="p3" title="Three" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {
    window.dispatchEvent(new Event(SIDEBAR_PAGES_CHANGED_EVENT));
  });
  expect(rpcMock.list).toHaveBeenCalledTimes(2);
});
const button = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === label);

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

it("shows the current title, opens the page route, and adds then removes it from the sidebar", async () => {
  // The server's state: the sidebar change event makes the card list again.
  let server: SidebarPagesState = notAdded;
  rpcMock.list.mockImplementation(async () => server);
  rpcMock.add.mockImplementation(async () => (server = added));
  rpcMock.remove.mockImplementation(async () => (server = notAdded));
  const changed = vi.fn();
  window.addEventListener(SIDEBAR_PAGES_CHANGED_EVENT, changed);
  const host = await render();
  expect(host.textContent).toContain("Support (renamed)");
  await click(button(host, "Add to sidebar"));
  expect(rpcMock.add).toHaveBeenCalledWith({ pageId: "p1" });
  expect(changed).toHaveBeenCalledTimes(1);
  await click(button(host, "Remove from sidebar"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ pageId: "p1" });
  expect(button(host, "Add to sidebar")).toBeTruthy();
  await click(button(host, "Support (renamed)"));
  expect(path).toBe("/app/pages/b1/p1");
});

it("shows an error when the save fails and keeps the add button", async () => {
  rpcMock.list.mockResolvedValue(notAdded);
  rpcMock.add.mockRejectedValue(new Error("boom"));
  const host = await render();
  await click(button(host, "Add to sidebar"));
  expect(host.querySelector("[role=alert]")?.textContent).toBe("Could not save");
  expect(button(host, "Add to sidebar")).toBeTruthy();
});

it("says a deleted page is unavailable instead of linking to it", async () => {
  rpcMock.list.mockResolvedValue({ pages: [], addable: [], botPages: [] });
  const host = await render();
  expect(host.textContent).toContain("Support");
  expect(host.textContent).toContain("This page is no longer available.");
  expect(host.querySelector("button")).toBeNull();
});
