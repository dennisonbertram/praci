// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));

import { byStakeholderFixture } from "./fixtures";
import { StakeholderCapTable } from "./StakeholderCapTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;

it("lists holders with shares per class and opens a row to its securities", () => {
  act(() =>
    root.render(
      <MemoryRouter>
        <StakeholderCapTable table={byStakeholderFixture} fullyDiluted={false} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("5,000,000");
  expect(button("Ada Founder").getAttribute("aria-expanded")).toBe("false");
  expect(host.textContent).not.toContain("CS-1");
  act(() => button("Ada Founder").click());
  expect(button("Ada Founder").getAttribute("aria-expanded")).toBe("true");
  expect(host.textContent).toContain("CS-1 · Shares · Common");
  expect(
    host.querySelector('a[href="/app/cap-table/securities?certificate=cert-1"]'),
  ).not.toBeNull();
  expect(host.textContent).not.toContain("Available for grant");
});

it("adds options and the unallocated pool when fully diluted", () => {
  act(() =>
    root.render(
      <MemoryRouter>
        <StakeholderCapTable table={byStakeholderFixture} fullyDiluted />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Available for grant");
  const headers = [...host.querySelectorAll("th")].map((th) => th.textContent);
  expect(headers).toContain("Options");
  expect(headers).toContain("Fully diluted");
  // 8,500,000 held fully diluted plus 500,000 left in the pool.
  expect(host.textContent).toContain("9,000,000");
});

it("shows an empty state", () => {
  act(() =>
    root.render(
      <MemoryRouter>
        <StakeholderCapTable table={{ ...byStakeholderFixture, rows: [] }} fullyDiluted={false} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("No holders yet");
});

it("puts the totals right after the name, then options and the shares per class", () => {
  act(() =>
    root.render(
      <MemoryRouter>
        <StakeholderCapTable table={byStakeholderFixture} fullyDiluted />
      </MemoryRouter>,
    ),
  );
  const headers = [...host.querySelectorAll("th")].map((th) => th.textContent);
  expect(headers).toEqual([
    "Stakeholder",
    "Fully diluted",
    "Ownership",
    "Convertibles",
    "Options",
    "Common",
    "Series Seed",
  ]);
  const widths = [...host.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].reduce((sum, cell) => sum + (cell.colSpan || 1), 0),
  );
  expect(new Set(widths)).toEqual(new Set([7]));
  act(() => (host.querySelector("tbody button") as HTMLElement).click());
  const expandedWidths = [...host.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].reduce((sum, cell) => sum + (cell.colSpan || 1), 0),
  );
  expect(new Set(expandedWidths)).toEqual(new Set([7]));
});
