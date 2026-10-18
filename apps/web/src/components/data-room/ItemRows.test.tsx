// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { GridView, ListView, type RowInteraction, SubfolderList } from "./ItemRows";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string, folderId: string | null) =>
  ({
    id,
    name: `${id}.pdf`,
    folderId,
    status: "ready",
    mimeType: "application/pdf",
    source: "upload",
    facets: { docType: null, docDate: null, parties: [] },
  }) as unknown as DataRoomApiItem;

const o = (openFolderId?: string): RowInteraction => ({
  shownId: undefined,
  onSelect: () => undefined,
  onToggle: () => undefined,
  onAction: () => undefined,
  folderPath: (id) => (id === "f-legal" ? "Legal" : ""),
  openFolderId,
});

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

const names = () =>
  Array.from(container.querySelectorAll('[data-testid="data-room-name"]')).map(
    (cell) => cell.textContent,
  );

it("names each row's folder in All items, and not inside that folder", () => {
  const rows = [item("lease", "f-legal"), item("loose", null)].map((i) => ({
    item: i,
    snippets: [],
  }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  expect(names()).toEqual(["lease.pdfLegal", "loose.pdf"]);
  act(() => root.render(<ListView rows={rows.slice(0, 1)} o={o("f-legal")} />));
  expect(names()).toEqual(["lease.pdf"]);
});

it("puts the status in its own column, so every row has the cell and only the failed one fills it", () => {
  const rows = [
    { ...item("junk", null), status: "failed" },
    item("a-much-longer-file-name", null),
  ].map((i) => ({ item: i as DataRoomApiItem, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const cells = Array.from(container.querySelectorAll('[data-testid="data-room-status"]'));
  expect(cells.map((cell) => cell.textContent)).toEqual(["Failed", ""]);
  // The failed row also says why under its name, so phones (no Status column) still explain it.
  expect(names()).toEqual([
    "junk.pdfCould not read this file. Delete it and upload it again.",
    "a-much-longer-file-name.pdf",
  ]);
  expect(container.querySelectorAll('[data-testid="data-room-failed-reason"]')).toHaveLength(1);
});

it("says in the row why a file failed, not only in a tooltip", () => {
  const rows = [
    { ...item("scan", null), status: "failed", error: "This file isn't a readable PDF." },
    item("fine", null),
  ].map((i) => ({ item: i as DataRoomApiItem, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const errors = Array.from(container.querySelectorAll('[data-testid="data-room-error"]'));
  expect(errors.map((cell) => cell.textContent)).toEqual(["This file isn't a readable PDF."]);
});

it("gives every sub-folder a More actions menu", () => {
  const onAction = vi.fn();
  const invoices = { id: "f2", name: "Invoices", parentId: "f1", createdAt: "" };
  for (const tiles of [false, true]) {
    act(() =>
      root.render(
        <SubfolderList
          folders={[invoices]}
          contents={() => "2 items"}
          onOpen={vi.fn()}
          onAction={onAction}
          tiles={tiles}
        />,
      ),
    );
    expect(container.querySelector('li button[aria-label^="More actions for"]')).not.toBeNull();
  }
});

it("keeps a renamed file's type while search re-indexes it, and names a failure under the name", () => {
  const typed = (id: string, status: string) =>
    ({
      ...item(id, null),
      status,
      facets: { docType: "Roadmap", docDate: null, parties: [] },
    }) as unknown as DataRoomApiItem;
  const rows = [typed("roadmap", "indexing"), typed("scan", "failed")].map((i) => ({
    item: i,
    snippets: [],
  }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  expect(container.textContent).toContain("Roadmap");
  expect(container.textContent).not.toContain("Reading");
  // The phone-only line under the name, for where the Type column is hidden.
  expect(names()[1]).toBe("scan.pdfFailed");
});

const tagged = (id: string, docType: string | null, docDate: string | null) =>
  ({
    ...item(id, null),
    facets: { docType, docDate, parties: docType ? ["Quill Capital (Mock)"] : [] },
  }) as unknown as DataRoomApiItem;

it("puts the type and date under the name for a phone, and says when a file is not tagged", () => {
  const rows = [
    tagged("deck", "presentation", "2025-12-21T00:00:00.000Z"),
    tagged("sheet", null, null),
  ].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const lines = Array.from(container.querySelectorAll('[data-testid="data-room-subline"]')).map(
    (line) => line.textContent,
  );
  expect(lines[0]).toMatch(/^Presentation · Dec 21, 2025$/);
  expect(lines[1]).toBe("Not tagged");
});

it("bolds only the shown row's name, so its type and parties keep their width", () => {
  const rows = [tagged("deck", "investor", null)].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={{ ...o(), shownId: "deck" }} />));
  const row = container.querySelector('[data-item-id="deck"]');
  expect(row?.className).not.toContain("font-medium");
  expect(row?.querySelector('[title="deck.pdf"]')?.className).toContain("font-medium");
  // A long party wraps to a second line instead of losing the end of its name.
  const parties = row?.querySelector('[data-testid="data-room-parties"]')?.className ?? "";
  expect(parties).toContain("line-clamp-2");
  expect(parties).not.toContain("truncate");
});

it("gives a tile's type and date a line each, and marks an untagged tile", () => {
  const rows = [
    tagged("deck", "presentation", "2025-12-21T00:00:00.000Z"),
    tagged("sheet", null, null),
  ].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<GridView rows={rows} o={o()} />));
  const tiles = Array.from(container.querySelectorAll("[data-item-id]"));
  const lines = (tile: Element) =>
    Array.from(tile.querySelectorAll('[data-testid="data-room-tile-meta"] > span')).map(
      (s) => s.textContent,
    );
  expect(lines(tiles[0] as Element)).toEqual(["Presentation", "Dec 21, 2025"]);
  expect(tiles[1]?.textContent).toContain("Not tagged");
});
