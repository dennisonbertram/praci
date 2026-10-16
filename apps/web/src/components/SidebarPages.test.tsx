// @vitest-environment jsdom

import type { SidebarPageTemplate } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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
vi.mock("../lib/rpc", () => ({ rpc: { sidebarPages: rpcMock } }));

import { SidebarPages } from "./SidebarPages";

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
function Path() {
  path = useLocation().pathname;
  return null;
}

async function render(templates: SidebarPageTemplate[], at = "/app") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <Path />
        <SidebarPages templates={templates} />
      </MemoryRouter>,
    );
  });
}
const byText = (value: string) =>
  [...document.body.querySelectorAll<HTMLElement>("[role=menuitem], button")].find((el) =>
    el.textContent?.includes(value),
  );
const click = async (el: HTMLElement | null | undefined) => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el?.click();
  });
};

beforeEach(() => {
  rpcMock.list.mockReset().mockResolvedValue([]);
  rpcMock.add.mockReset().mockResolvedValue({ ok: true });
  rpcMock.remove.mockReset().mockResolvedValue({ ok: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("hides the add row when no template is available", async () => {
  await render([template({ available: false })]);
  expect(container.querySelector("[data-testid=sidebar-add-page]")).toBeNull();
  expect(rpcMock.list).not.toHaveBeenCalled();
});

it("adds an available page and shows its link", async () => {
  await render([template()]);
  await click(container.querySelector("[data-testid=sidebar-add-page]"));
  await click(byText("Team health"));
  expect(rpcMock.add).toHaveBeenCalledWith({ templateKey: "team-health" });
  expect(container.querySelector("[data-testid=sidebar-page-team-health]")).not.toBeNull();
  // Nothing left to add, so the row goes away.
  expect(container.querySelector("[data-testid=sidebar-add-page]")).toBeNull();
});

it("shows pages the user already added, and opens the route", async () => {
  rpcMock.list.mockResolvedValue([{ templateKey: "team-health" }]);
  await render([template()]);
  await click(container.querySelector("[data-testid=sidebar-page-team-health]"));
  expect(path).toBe("/app/team-health");
});

it("removes a page and leaves its route", async () => {
  rpcMock.list.mockResolvedValue([{ templateKey: "team-health" }]);
  await render([template()], "/app/team-health");
  await click(container.querySelector("[aria-label='Page options']"));
  await click(byText("Remove from sidebar"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ templateKey: "team-health" });
  expect(container.querySelector("[data-testid=sidebar-page-team-health]")).toBeNull();
  expect(path).toBe("/app");
});
