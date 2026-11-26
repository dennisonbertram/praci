// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + (values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { PhoneDateRange, PickFilter, SearchField, SortControl } from "./ListControls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setPhone = (matches: boolean) =>
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

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

const onKind = vi.fn();
const onField = vi.fn();
const toolbar = (kind: string | undefined) =>
  act(() =>
    root.render(
      <div className="flex flex-wrap">
        <SearchField
          value=""
          onChange={() => undefined}
          placeholder="Search"
          label="Search"
          name="s"
        />
        <PickFilter
          label="Kind"
          value={kind}
          options={[
            ["founder", "Founder"],
            ["advisor", "Advisor"],
          ]}
          onChange={onKind}
        />
        <span>
          <SortControl
            fields={[
              ["name", "Name"],
              ["kind", "Kind"],
            ]}
            field="name"
            fieldLabel="Name"
            direction="asc"
            onField={onField}
            onDirection={() => undefined}
          />
        </span>
      </div>,
    ),
  );

const buttons = (scope: ParentNode = document) =>
  [...scope.querySelectorAll("button")].map((button) => button.textContent?.trim());

it("on a phone shows one Filters button with the count, and the active filter as a removable chip", () => {
  setPhone(true);
  toolbar("advisor");
  expect(buttons(container)).toEqual(["Filters1", "Kind: Advisor"]);
  const chip = [...container.querySelectorAll("button")][1];
  act(() => chip?.click());
  expect(onKind).toHaveBeenCalledWith(undefined);
});

it("on a phone the sheet lists every filter and the sort, and Clear all clears the filters", () => {
  setPhone(true);
  toolbar("advisor");
  act(() => container.querySelector<HTMLButtonElement>("[data-testid=filters-button]")?.click());
  const sheet = document.querySelector("[data-slot=sheet-content]") as HTMLElement;
  expect(buttons(sheet)).toEqual([
    "Founder",
    "Advisor",
    "Name",
    "Kind",
    "Sort ascending",
    "Sort descending",
    "Clear all",
    "Done",
  ]);
  act(() => [...sheet.querySelectorAll("button")].find((b) => b.textContent === "Kind")?.click());
  expect(onField).toHaveBeenCalledWith("kind");
  act(() =>
    [...sheet.querySelectorAll("button")].find((b) => b.textContent === "Clear all")?.click(),
  );
  expect(onKind).toHaveBeenCalledWith(undefined);
});

it("wider than a phone keeps the pills and the sort menu in place", () => {
  setPhone(false);
  toolbar(undefined);
  expect(buttons(container)).toEqual(["Kind", "Sort: Name", ""]);
});

it("on a phone a date range sits in the sheet, counts as a filter, and clears with Clear all", () => {
  setPhone(true);
  const onRange = vi.fn();
  act(() =>
    root.render(
      <div>
        <SearchField
          value=""
          onChange={() => undefined}
          placeholder="Search"
          label="Search"
          name="s"
        />
        <PhoneDateRange label="Dates" from="2026-01-02" to={undefined} onChange={onRange} />
      </div>,
    ),
  );
  expect(buttons(container)).toEqual(["Filters1", "Dates: 2026-01-02 – …"]);
  act(() => container.querySelector<HTMLButtonElement>("[data-testid=filters-button]")?.click());
  const sheet = document.querySelector("[data-slot=sheet-content]") as HTMLElement;
  expect(sheet.querySelectorAll("input[type=date]")).toHaveLength(2);
  act(() =>
    [...sheet.querySelectorAll("button")].find((b) => b.textContent === "Clear all")?.click(),
  );
  expect(onRange).toHaveBeenCalledWith(undefined, undefined);
});

it("wider than a phone a date range renders nothing", () => {
  setPhone(false);
  act(() =>
    root.render(
      <PhoneDateRange label="Dates" from={undefined} to={undefined} onChange={() => undefined} />,
    ),
  );
  expect(container.innerHTML).toBe("");
});

it("on a phone a data-list-toolbar without a search box gets one Filters button holding the filter and the sort", () => {
  setPhone(true);
  act(() =>
    root.render(
      <div data-list-toolbar>
        <PickFilter label="Kind" value={undefined} options={[["a", "Alpha"]]} onChange={onKind} />
        <span>
          <SortControl
            fields={[["name", "Name"]]}
            field="name"
            fieldLabel="Name"
            direction="asc"
            onField={onField}
            onDirection={() => undefined}
          />
        </span>
      </div>,
    ),
  );
  expect(container.querySelectorAll("[data-testid=filters-button]")).toHaveLength(1);
  act(() => container.querySelector<HTMLButtonElement>("[data-testid=filters-button]")?.click());
  const sheet = document.querySelector("[data-slot=sheet-content]") as HTMLElement;
  expect(buttons(sheet)).toContain("Alpha");
  expect(buttons(sheet)).toContain("Name");
});
