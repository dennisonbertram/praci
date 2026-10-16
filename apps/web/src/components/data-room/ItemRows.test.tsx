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

import { ListView, type RowInteraction } from "./ItemRows";

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
