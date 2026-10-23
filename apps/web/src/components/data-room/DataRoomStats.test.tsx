// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (n: number, o: { one: string; other: string }) =>
    (n === 1 ? o.one : o.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { manyDocuments, noDocuments } from "../../stories/fixtures/data-room-stats";
import { bucketRange, DataRoomStats } from "./DataRoomStats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onPick = vi.fn();
const onOpenItem = vi.fn();
beforeEach(() => {
  setHideAmounts(false);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const render = (stats: Parameters<typeof DataRoomStats>[0]["stats"]) =>
  act(() =>
    root.render(
      <DataRoomStats
        stats={stats}
        scope="All items"
        filtered={false}
        onClearFilters={vi.fn()}
        onPick={onPick}
        onOpenItem={onOpenItem}
      />,
    ),
  );
const button = (label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(label)) ??
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.getAttribute("aria-label")?.startsWith(label),
  );

it("shows every section and applies the filter of what is clicked", () => {
  render(manyDocuments);
  for (const title of [
    "Documents by document date",
    "Types",
    "Sources",
    "Top parties",
    "Largest files",
    "Status",
    "Amounts",
  ]) {
    expect(container.textContent).toContain(title);
  }
  expect(container.textContent).toContain("1,104");
  expect(container.textContent).toContain("92%");
  act(() => button("Legal document")?.click());
  expect(onPick).toHaveBeenLastCalledWith({ docType: "legal" });
  act(() => button("Google Drive")?.click());
  expect(onPick).toHaveBeenLastCalledWith({ source: "drive" });
  act(() => button("Acme Capital (Mock)")?.click());
  expect(onPick).toHaveBeenLastCalledWith({ party: "Acme Capital (Mock)" });
  act(() => button("Jan 2025")?.click());
  expect(onPick).toHaveBeenLastCalledWith({
    docDateFrom: "2025-01-01T00:00:00.000Z",
    docDateTo: "2025-01-31T23:59:59.999Z",
  });
  act(() => button("Data export.zip")?.click());
  expect(onOpenItem).toHaveBeenCalledWith("f2");
});

it("masks amounts while they are hidden", () => {
  render(manyDocuments);
  expect(container.textContent).toContain("$12,500,000");
  act(() => setHideAmounts(true));
  expect(container.textContent).not.toContain("12,500,000");
});

it("shows an empty state and a loading state", () => {
  render(noDocuments);
  expect(container.textContent).toContain("No results");
  render(null);
  expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
});

it("turns a month or a year into the date range it covers", () => {
  expect(bucketRange("2026-02")).toEqual({
    docDateFrom: "2026-02-01T00:00:00.000Z",
    docDateTo: "2026-02-28T23:59:59.999Z",
  });
  expect(bucketRange("2024")).toEqual({
    docDateFrom: "2024-01-01T00:00:00.000Z",
    docDateTo: "2024-12-31T23:59:59.999Z",
  });
});

it("leaves out the Sources card when every file has the same source", () => {
  render({ ...manyDocuments, sources: [{ value: "upload", count: 3 }] });
  expect(container.textContent).not.toContain("Sources");
});

it("makes the Failed card a button that filters to failed files", () => {
  render({
    ...manyDocuments,
    status: { ...manyDocuments.status, failed: 2 },
  } as typeof manyDocuments);
  const card = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Failed2",
  );
  act(() => card?.click());
  expect(onPick).toHaveBeenCalledWith({ status: "failed" });
  // It looks clickable and red, as the other clickable cards look clickable.
  expect(card?.className).toContain("cursor-pointer");
  expect(card?.querySelector(".text-destructive")?.textContent).toBe("2");
});
