// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + (values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { SeeAll, useCappedRows } from "./CappedList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setPhone = (matches: boolean) =>
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

const items = Array.from({ length: 9 }, (_, i) => `row ${i + 1}`);

function Demo({ to, keep }: { to?: string; keep?: string }) {
  const list = useCappedRows(items, { desktop: 5, keep: (row) => row === keep });
  return (
    <div>
      <ul>
        {list.rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <SeeAll list={list} {...(to ? { to } : {})} />
    </div>
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (node: ReactNode) => act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
const rows = () => container.querySelectorAll("li").length;

it("shows 3 rows and a link to the full list on a phone", () => {
  setPhone(true);
  render(<Demo to="/app/all" />);
  expect(rows()).toBe(3);
  const link = container.querySelector("a");
  expect(link?.textContent).toBe("See all (9)");
  expect(link?.getAttribute("href")).toBe("/app/all");
});

it("expands in place on a phone when there is no full page", () => {
  setPhone(true);
  render(<Demo />);
  act(() => container.querySelector("button")?.click());
  expect(rows()).toBe(9);
  expect(container.querySelector("button")?.textContent).toBe("Show less");
});

it("keeps the desktop cap and expands in place", () => {
  setPhone(false);
  render(<Demo to="/app/all" />);
  expect(rows()).toBe(5);
  expect(container.querySelector("a")).toBeNull();
  act(() => container.querySelector("button")?.click());
  expect(rows()).toBe(9);
});

it("opens the list when a row that must stay visible would be cut off", () => {
  setPhone(true);
  render(<Demo keep="row 7" />);
  expect(rows()).toBe(9);
  expect(container.querySelector("button")?.textContent).toBe("Show less");
});
