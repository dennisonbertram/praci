// @vitest-environment jsdom

import type { SidebarPageTemplate } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
const tt = vi.hoisted(
  () =>
    (x: unknown, ...v: unknown[]) =>
      Array.isArray(x)
        ? (text as (...a: unknown[]) => string)(x, ...v)
        : typeof x === "string"
          ? x
          : (x as { message: string }).message,
);
vi.mock("@lingui/core/macro", () => ({ msg: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tt, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Could not add the page" }));
vi.mock("../lib/rpc", () => ({ rpc: { sidebarPages: rpcMock } }));

import { SIDEBAR_PAGES_CHANGED_EVENT, SidebarPages } from "./SidebarPages";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const template = (over: Partial<SidebarPageTemplate> = {}): SidebarPageTemplate => ({
  key: "team-health",
  route: "/app/team-health",
  platforms: ["web"],
  available: true,
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let path = "";
let goTo: (to: string) => void;
function Path() {
  path = useLocation().pathname;
  goTo = useNavigate();
  return null;
}

const bots = [{ id: "bot1", name: "Finance agent", color: "#336699", status: "idle" as const }];
async function render(templates: SidebarPageTemplate[], at = "/app") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <Path />
        <SidebarPages templates={templates} bots={bots} />
      </MemoryRouter>,
    );
  });
}
const state = (
  pages: unknown[],
  addable: string[],
  botPages: { botId: string; pages: { id: string; title: string }[] }[] = [],
) => ({
  pages: pages.map((page) => (typeof page === "string" ? { templateKey: page } : page)),
  addable,
  botPages,
});
const cash = { pageId: "pg1", botId: "bot1", title: "Cash" };
const byText = (value: string) =>
  [...document.body.querySelectorAll<HTMLElement>("[role=menuitem], button")].find((el) =>
    el.textContent?.includes(value),
  );
const click = async (el: Element | null | undefined) => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    (el as HTMLElement | null | undefined)?.click();
  });
};
beforeEach(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  rpcMock.list.mockReset().mockResolvedValue(state([], ["team-health"]));
  rpcMock.add.mockReset().mockResolvedValue(state(["team-health"], []));
  rpcMock.remove.mockReset().mockResolvedValue(state([], ["team-health"]));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

const addRow = () => container.querySelector("[data-testid=sidebar-add-page]");
const pageRow = () => container.querySelector("[data-testid=sidebar-page-team-health]");

it("hides the add row when nothing can be added", async () => {
  rpcMock.list.mockResolvedValue(state([], []));
  await render([template({ available: false })]);
  expect(addRow()).toBeNull();
});

it("shows the add row only after the list has loaded", async () => {
  let resolve!: (value: unknown) => void;
  rpcMock.list.mockReturnValue(new Promise((r) => (resolve = r)));
  await render([template()]);
  expect(addRow()).toBeNull();
  await act(async () => resolve(state([], ["team-health"])));
  expect(addRow()).not.toBeNull();
});

it("does not offer a template the server did not list as addable", async () => {
  rpcMock.list.mockResolvedValue(state([], []));
  await render([template()]);
  expect(addRow()).toBeNull();
});

it("adds an available page and shows its link", async () => {
  await render([template()]);
  await click(addRow());
  await click(byText("Team health"));
  expect(rpcMock.add).toHaveBeenCalledWith({ templateKey: "team-health" });
  expect(pageRow()).not.toBeNull();
  expect(addRow()).toBeNull();
});

it("shows the error and adds no row when add fails", async () => {
  rpcMock.add.mockRejectedValue(new Error("nope"));
  // The jsdom pointer events can reopen the menu afterwards, which clears the error as designed,
  // so record that the alert appeared.
  const seen: string[] = [];
  const observer = new MutationObserver(() => {
    const alert = container.querySelector("[role=alert]")?.textContent;
    if (alert) seen.push(alert);
  });
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  await render([template()]);
  await click(addRow());
  await click(byText("Team health"));
  observer.disconnect();
  expect(seen).toContain("Could not add the page");
  expect(pageRow()).toBeNull();
  expect(addRow()).not.toBeNull();
});

it("shows pages the user already added, and opens the route", async () => {
  rpcMock.list.mockResolvedValue(state(["team-health"], []));
  await render([template()]);
  await click(pageRow());
  expect(path).toBe("/app/team-health");
});

it("removes a page and leaves its route", async () => {
  rpcMock.list.mockResolvedValue(state(["team-health"], []));
  await render([template()], "/app/team-health");
  await click(container.querySelector("[aria-label='Page options']"));
  await click(byText("Remove from sidebar"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ templateKey: "team-health" });
  expect(pageRow()).toBeNull();
  expect(path).toBe("/app");
});

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

it("does not redirect when the user navigated elsewhere before remove finished", async () => {
  rpcMock.list.mockResolvedValue(state(["team-health"], []));
  const pending = deferred();
  rpcMock.remove.mockReturnValue(pending.promise);
  await render([template()], "/app/team-health");
  await click(container.querySelector("[aria-label='Page options']"));
  await click(byText("Remove from sidebar"));
  await act(async () => goTo("/app/inbox"));
  await act(async () => pending.resolve(state([], ["team-health"])));
  expect(path).toBe("/app/inbox");
  expect(pageRow()).toBeNull();
});

it("applies only the latest mutation when responses arrive out of order", async () => {
  const alpha = template({ key: "alpha", route: "/app/alpha" });
  const beta = template({ key: "beta", route: "/app/beta" });
  rpcMock.list.mockResolvedValue(state([], ["alpha", "beta"]));
  const slowAdd = deferred();
  const fastAdd = deferred();
  rpcMock.add.mockReturnValueOnce(slowAdd.promise).mockReturnValueOnce(fastAdd.promise);
  await render([alpha, beta]);
  await click(addRow());
  await click(byText("alpha"));
  for (
    let attempt = 0;
    attempt < 3 && addRow()?.getAttribute("aria-expanded") !== "true";
    attempt++
  ) {
    await act(async () => (addRow() as HTMLElement).click());
  }
  expect(addRow()?.getAttribute("aria-expanded")).toBe("true");
  await click(byText("beta"));
  expect(rpcMock.add).toHaveBeenNthCalledWith(2, { templateKey: "beta" });
  await act(async () => fastAdd.resolve(state(["beta"], ["alpha"])));
  await act(async () => slowAdd.resolve(state(["alpha"], ["beta"])));
  expect(container.querySelector("[data-testid=sidebar-page-beta]")).not.toBeNull();
  expect(container.querySelector("[data-testid=sidebar-page-alpha]")).toBeNull();
});

it("shows an alert when the initial list fails", async () => {
  rpcMock.list.mockRejectedValue(new Error("down"));
  await render([template()]);
  expect(container.querySelector("[role=alert]")?.textContent).toBe("Could not add the page");
  expect(addRow()).toBeNull();
});

it("opens the page after adding it", async () => {
  await render([template()]);
  await click(addRow());
  await click(byText("Team health"));
  expect(path).toBe("/app/team-health");
});

it("does not render saved pages whose template is not available", async () => {
  rpcMock.list.mockResolvedValue(state(["team-health"], []));
  await render([template({ available: false }), template({ key: "other", available: true })]);
  expect(pageRow()).toBeNull();
});

const menuTexts = () =>
  [...document.body.querySelectorAll("[role=menuitem], [role=presentation]")].map(
    (el) => el.textContent,
  );

it("lists bot pages under their bot, adds one, and opens its full-width route", async () => {
  rpcMock.list.mockResolvedValue(
    state([], [], [{ botId: "bot1", pages: [{ id: "pg1", title: "Cash" }] }]),
  );
  rpcMock.add.mockResolvedValue(state([cash], []));
  await render([template({ available: false })]);
  await click(addRow());
  expect(document.body.textContent).toContain("Finance agent");
  await click(byText("Cash"));
  expect(rpcMock.add).toHaveBeenCalledWith({ pageId: "pg1" });
  expect(path).toBe("/app/pages/bot1/pg1");
  expect(container.querySelector("[data-testid='sidebar-page-page:pg1']")?.textContent).toBe(
    "Cash",
  );
  expect(addRow()).toBeNull();
});

it("opens an added bot page and removes it by page id", async () => {
  rpcMock.list.mockResolvedValue(state([cash], []));
  rpcMock.remove.mockResolvedValue(state([], []));
  await render([template({ available: false })], "/app/pages/bot1/pg1");
  await click(container.querySelector("[data-testid='sidebar-page-page:pg1']"));
  expect(path).toBe("/app/pages/bot1/pg1");
  await click(container.querySelector("[aria-label='Page options']"));
  await click(byText("Remove from sidebar"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ pageId: "pg1" });
  expect(path).toBe("/app");
  expect(menuTexts()).not.toContain("Cash");
});

it("re-lists when the sidebar pages change event fires", async () => {
  rpcMock.list
    .mockResolvedValueOnce(state([{ ...cash, title: "Board prep" }], []))
    .mockResolvedValueOnce(state([{ ...cash, title: "Board notes" }], []));
  await render([]);
  expect(container.textContent).toContain("Board prep");
  await act(async () => {
    window.dispatchEvent(new CustomEvent(SIDEBAR_PAGES_CHANGED_EVENT));
  });
  expect(container.textContent).toContain("Board notes");
  expect(rpcMock.list).toHaveBeenCalledTimes(2);
});
