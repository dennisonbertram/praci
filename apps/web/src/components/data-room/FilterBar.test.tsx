// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { FilterBar } from "./FilterBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
