// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { FilterBar, facetOptions } from "./FilterBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const onNewFolder = vi.fn();
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
});

const render = (query: string, onQuery: (query: string) => void) =>
  act(() =>
    root.render(
      <FilterBar
        query={query}
        onQuery={onQuery}
        searching={query !== ""}
        filters={{}}
        onFilters={() => undefined}
        sort={null}
        onSort={() => undefined}
        types={[]}
        parties={[]}
        sources={[]}
        hasDates={false}
        folders={[]}
        folderId={undefined}
        onFolder={() => undefined}
        onNewFolder={onNewFolder}
      />,
    ),
  );
const clear = () => container.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]');

it("offers a named Clear search button only while there is a query, and it empties the box", () => {
  const onQuery = vi.fn();
  render("", onQuery);
  expect(clear()).toBeNull();
  render("lease", onQuery);
  act(() => clear()?.click());
  expect(onQuery).toHaveBeenCalledWith("");
});

const renderSorted = (sort: { field: "createdAt"; direction: "desc" } | null) =>
  act(() =>
    root.render(
      <FilterBar
        query="lease"
        onQuery={() => undefined}
        searching
        filters={{}}
        onFilters={() => undefined}
        sort={sort}
        onSort={() => undefined}
        types={[]}
        parties={[]}
        sources={[]}
        hasDates={false}
        folders={[
          {
            folder: { id: "f2", name: "Invoices", parentId: "f1", createdAt: "" },
            path: "Finance / Invoices",
            depth: 1,
          },
        ]}
        folderId="f2"
        onFolder={() => undefined}
        onNewFolder={onNewFolder}
      />,
    ),
  );

it("shows the sort direction only for a field sort, never for Relevance", () => {
  renderSorted(null);
  expect(container.querySelector('button[aria-label="Descending"]')).toBeNull();
  renderSorted({ field: "createdAt", direction: "desc" });
  expect(container.querySelector('button[aria-label="Descending"]')).not.toBeNull();
});

it("names the open folder by its own name on the picker, with the full path as its title", () => {
  renderSorted(null);
  const picker = container.querySelector('[data-testid="data-room-folder-picker"]');
  expect(picker?.textContent).toBe("Invoices");
  expect(picker?.getAttribute("title")).toBe("Finance / Invoices");
});

it("offers only the sources that have files, in label order", () => {
  const item = (source: string) =>
    ({ source, facets: { docType: null, docDate: null, parties: [] } }) as never;
  expect(facetOptions([item("upload"), item("gmail"), item("upload")]).sources).toEqual([
    "gmail",
    "upload",
  ]);
  expect(facetOptions([item("upload")]).sources).toEqual(["upload"]);
});

it("keeps the Type, Party and Document date pills where nothing has one, so the bar never changes shape", () => {
  render("", vi.fn());
  const pills = Array.from(container.querySelectorAll('[data-testid="data-room-filters"] button'));
  expect(pills.map((pill) => pill.textContent)).toEqual(["Type", "Party", "Document date"]);
});

it("has a visible New folder button beside the folder picker that opens the dialog", () => {
  onNewFolder.mockClear();
  renderSorted(null);
  const add = container.querySelector<HTMLButtonElement>('button[aria-label="New folder"]');
  expect(add).not.toBeNull();
  act(() => add?.click());
  expect(onNewFolder).toHaveBeenCalledTimes(1);
});

it("labels the date sort Document date, so it is not mistaken for when a file was added", () => {
  renderSorted({ field: "createdAt", direction: "desc" });
  expect(container.textContent).toContain("Sort: Added");
  expect(container.textContent).not.toMatch(/Sort: Date\b/);
});
