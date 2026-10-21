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

const thumbnailUrl = vi.hoisted(() => vi.fn());
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  dataRoomThumbnailUrl: thumbnailUrl,
}));

import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import type { RowInteraction } from "./ItemRows";
import { GridView, ListView, SubfolderList } from "./ItemRows";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string, folderId: string | null) =>
  ({
    id,
    name: `${id}.pdf`,
    folderId,
    status: "ready",
    mimeType: "application/pdf",
    source: "upload",
    createdAt: "2026-03-04T12:00:00.000Z",
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
  // The agent avatars read the reduced-motion preference.
  window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  setHideAmounts(false);
  resetHideAmountsMemory();
  thumbnailUrl.mockReset();
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
  expect(names()).toEqual([
    "lease.pdfLegalNot tagged · Mar 4, 2026",
    "loose.pdfNot tagged · Mar 4, 2026",
  ]);
  act(() => root.render(<ListView rows={rows.slice(0, 1)} o={o("f-legal")} />));
  expect(names()).toEqual(["lease.pdfNot tagged · Mar 4, 2026"]);
});

it("renders a native table in the Cap table style, with the header hidden on a phone", () => {
  const rows = [item("lease", "f-legal")].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const table = container.querySelector("table");
  for (const cls of ["w-full", "table-fixed", "text-sm"])
    expect(table?.classList.contains(cls)).toBe(true);
  const row = container.querySelector("[data-row]");
  expect(row?.tagName).toBe("TR");
  for (const cls of ["h-14", "border-t", "border-border", "hover:bg-muted/50"])
    expect(row?.classList.contains(cls)).toBe(true);
  const cell = container.querySelector("td");
  for (const cls of ["py-2", "pe-3"]) expect(cell?.classList.contains(cls)).toBe(true);
  const head = container.querySelector('[data-testid="data-room-head"]');
  expect(head?.className).toContain("hidden");
  expect(head?.querySelector("th")?.className).toContain("text-xs");
  expect(head?.textContent).toBe("NameTypeAddedPartiesStatus");
  expect(container.querySelectorAll("colgroup > col")).toHaveLength(6);
});

it("cuts parties to one line with the full value in the title, and shows a dash when empty", () => {
  const rows = [
    {
      ...tagged("deck", "investor", null),
      facets: {
        docType: "investor",
        docDate: null,
        parties: ["Quill Capital (Mock)", "Acme Servo Supply (Mock)"],
      },
    },
    item("bare", null),
  ].map((i) => ({ item: i as DataRoomApiItem, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const cells = Array.from(container.querySelectorAll('[data-testid="data-room-parties"]'));
  expect(cells[0]?.className).toContain("truncate");
  expect(cells[0]?.className).not.toContain("line-clamp");
  expect(cells[0]?.getAttribute("title")).toBe("Quill Capital (Mock), Acme Servo Supply (Mock)");
  expect(cells[1]?.textContent).toBe("—");
});

it("shows the row's menu on hover or focus, and always on touch", () => {
  act(() => root.render(<ListView rows={[{ item: item("a", null), snippets: [] }]} o={o()} />));
  const row = container.querySelector("[data-row]");
  expect(row?.className).toContain("group/row");
  const menu = row?.querySelector('button[aria-label^="More actions for"]')?.className ?? "";
  for (const c of [
    "opacity-0",
    "group-hover/row:opacity-100",
    "group-focus-visible/row:opacity-100",
    "data-popup-open:opacity-100",
    "pointer-coarse:opacity-100",
  ])
    expect(menu).toContain(c);
});

it("puts the status in its own column as a badge, and never in the Type cell", () => {
  const rows = [
    { ...item("junk", null), status: "failed" },
    { ...item("busy", null), status: "processing" },
    item("a-much-longer-file-name", null),
  ].map((i) => ({ item: i as DataRoomApiItem, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const cells = Array.from(container.querySelectorAll('[data-testid="data-room-status"]'));
  expect(cells.map((cell) => cell.textContent)).toEqual(["Failed", "Reading", ""]);
  expect(cells[0]?.querySelector("[data-slot=badge]")).not.toBeNull();
  // The Type cell (second) never holds a status word.
  for (const row of container.querySelectorAll("[data-row]")) {
    expect(row.children[1]?.textContent).not.toMatch(/Reading|Failed/);
  }
  // The failed row also says why under its name, so phones (no Status column) still explain it.
  expect(names()[0]).toContain("Could not read this file. Delete it and upload it again.");
  expect(container.querySelectorAll('[data-testid="data-room-failed-reason"]')).toHaveLength(1);
});

it("has an inline Try again on a failed row that retries once and does not open the preview", () => {
  const onAction = vi.fn();
  const onToggle = vi.fn();
  const rows = [{ ...item("junk", null), status: "failed" }, item("fine", null)].map((i) => ({
    item: i as DataRoomApiItem,
    snippets: [],
  }));
  act(() => root.render(<ListView rows={rows} o={{ ...o(), onAction, onToggle }} />));
  const retry = Array.from(container.querySelectorAll("button")).filter(
    (b) => b.textContent === "Try again",
  );
  expect(retry).toHaveLength(1);
  expect(retry[0]?.closest("[data-item-id]")?.getAttribute("data-item-id")).toBe("junk");
  act(() => retry[0]?.click());
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onAction).toHaveBeenCalledWith("retry", expect.objectContaining({ id: "junk" }));
  expect(onToggle).not.toHaveBeenCalled();
});

it("follows the sort in the Date column: Added by default, Document date when sorted by it", () => {
  const rows = [
    {
      ...tagged("deck", "investor", "2025-12-21T00:00:00.000Z"),
      createdAt: "2026-03-04T12:00:00.000Z",
    },
  ].map((i) => ({ item: i, snippets: [] }));
  const header = () => container.querySelector('[data-testid="data-room-head"]')?.textContent;
  const dateCell = () => container.querySelector("[data-row]")?.children[2]?.textContent;
  act(() => root.render(<ListView rows={rows} o={o()} />));
  expect(header()).toContain("Added");
  expect(header()).not.toContain("Document date");
  expect(dateCell()).toBe("Mar 4, 2026");
  act(() => root.render(<ListView rows={rows} o={o()} sortField="createdAt" />));
  expect(dateCell()).toBe("Mar 4, 2026");
  act(() => root.render(<ListView rows={rows} o={o()} sortField="date" />));
  expect(header()).toContain("Document date");
  expect(dateCell()).toBe("Dec 21, 2025");
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
        <table>
          <SubfolderList
            folders={[invoices]}
            contents={() => "2 items"}
            onOpen={vi.fn()}
            onAction={onAction}
            tiles={tiles}
          />
        </table>,
      ),
    );
    expect(container.querySelector('button[aria-label^="More actions for"]')).not.toBeNull();
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
  expect(names()[1]).toContain("scan.pdfFailed");
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
  act(() => root.render(<ListView rows={rows} o={o()} sortField="date" />));
  const lines = Array.from(container.querySelectorAll('[data-testid="data-room-subline"]')).map(
    (line) => line.textContent,
  );
  expect(lines[0]).toMatch(/^Presentation · Dec 21, 2025$/);
  expect(lines[1]).toBe("Not tagged");
});

it("highlights the shown row and bolds only its name cell's text via the name style", () => {
  const rows = [tagged("deck", "investor", null)].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<ListView rows={rows} o={{ ...o(), shownId: "deck" }} />));
  const row = container.querySelector('[data-item-id="deck"]');
  expect(row?.getAttribute("aria-current")).toBe("true");
  expect(row?.className).toContain("bg-sidebar-accent");
});

it("gives a tile's type and date a line each, and marks an untagged tile", () => {
  const rows = [
    tagged("deck", "presentation", "2025-12-21T00:00:00.000Z"),
    tagged("sheet", null, null),
  ].map((i) => ({ item: i, snippets: [] }));
  act(() => root.render(<GridView rows={rows} o={o()} sortField="date" />));
  const tiles = Array.from(container.querySelectorAll("[data-item-id]"));
  const lines = (tile: Element) =>
    Array.from(tile.querySelectorAll('[data-testid="data-room-tile-meta"] > span')).map(
      (s) => s.textContent,
    );
  expect(lines(tiles[0] as Element)).toEqual(["Presentation", "Dec 21, 2025"]);
  expect(tiles[1]?.textContent).toContain("Not tagged");
});

it("sizes the columns with table-column <col>s, not table-cell", () => {
  act(() => root.render(<ListView rows={[{ item: item("a", null), snippets: [] }]} o={o()} />));
  const cols = Array.from(container.querySelectorAll("col")).map((c) => c.className);
  expect(cols.some((c) => c.includes("table-cell"))).toBe(false);
  expect(cols.filter((c) => c.includes("table-column"))).toHaveLength(4);
});

it("opens the file when its search snippet is clicked", () => {
  const onToggle = vi.fn();
  const rows = [{ item: item("lease", null), snippets: ["a «match» here"] }];
  act(() => root.render(<ListView rows={rows} o={{ ...o(), onToggle }} />));
  // The snippet sits in the name cell, under the name, so a narrow page never squeezes the name.
  const nameCell = container.querySelector('[data-testid="data-room-name"]');
  expect(nameCell?.textContent).toContain("match");
  expect(container.querySelectorAll('tbody[aria-label="Items"] tr')).toHaveLength(1);
  act(() => nameCell?.querySelector("p")?.click());
  expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "lease" }));
});

it("makes only the first row a Tab stop, with menus out of the Tab order", () => {
  const rows = [item("a", null), item("b", null), item("c", null)].map((i) => ({
    item: i,
    snippets: [],
  }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  expect(
    Array.from(container.querySelectorAll<HTMLElement>("[data-row]")).map((r) => r.tabIndex),
  ).toEqual([0, -1, -1]);
  const menus = Array.from(
    container.querySelectorAll<HTMLElement>('button[aria-label^="More actions"]'),
  );
  expect(menus.map((m) => m.tabIndex)).toEqual([-1, -1, -1]);
});

it("shows the added date under the name of an untagged file on a phone", () => {
  const rows = [{ item: item("loose", null), snippets: [] }];
  act(() => root.render(<ListView rows={rows} o={o()} />));
  expect(container.querySelector('[data-testid="data-room-subline"]')?.textContent).toBe(
    "Not tagged · Mar 4, 2026",
  );
});

it("puts a sub-folder's menu in the same column as a file's at every list width", () => {
  const invoices = { id: "f2", name: "Invoices", parentId: "f1", createdAt: "" };
  act(() =>
    root.render(
      <ListView
        rows={[{ item: item("a", null), snippets: [] }]}
        o={o()}
        lead={() => (
          <SubfolderList
            folders={[invoices]}
            contents={() => "2 items"}
            onOpen={vi.fn()}
            onAction={vi.fn()}
            tiles={false}
          />
        )}
      />,
    ),
  );
  const rowsOf = (label: string) =>
    container.querySelector(`tbody[aria-label="${label}"] tr`) as HTMLTableRowElement;
  // jsdom has no container queries: read the width from each cell's hidden, container-query table-cell class.
  const visible = (cell: Element, width: number) => {
    const min = /@min-\[(\d+)px\]\/list:table-cell/.exec(cell.className)?.[1];
    return !cell.classList.contains("hidden") || (min !== undefined && width >= Number(min));
  };
  for (const width of [400, 560, 700]) {
    const layout = (tr: HTMLTableRowElement) =>
      Array.from(tr.children)
        .filter((c) => visible(c, width))
        .map((c) => (c as HTMLTableCellElement).colSpan);
    const files = layout(rowsOf("Items"));
    const folders = layout(rowsOf("Sub-folders"));
    expect(folders.reduce((a, b) => a + b, 0)).toBe(files.reduce((a, b) => a + b, 0));
    expect(folders.at(-1)).toBe(1);
  }
});

const tile = (over: Partial<DataRoomApiItem>) => [
  {
    item: { ...item("tile", null), hasThumbnail: false, previewText: null, ...over },
    snippets: [],
  },
];
const showGrid = async (over: Partial<DataRoomApiItem>) => {
  await act(async () => root.render(<GridView rows={tile(over)} o={o()} />));
};

it("shows the drawn thumbnail of a PDF in its tile", async () => {
  thumbnailUrl.mockResolvedValue("blob:thumb");
  await showGrid({ hasThumbnail: true });
  const img = container.querySelector("img");
  expect(img?.getAttribute("src")).toBe("blob:thumb");
  expect(img?.className).toContain("object-contain");
  expect(thumbnailUrl).toHaveBeenCalledWith({ id: "tile" });
});

it("keeps the file icon when the thumbnail cannot be read", async () => {
  thumbnailUrl.mockRejectedValue(new Error("404"));
  await showGrid({ hasThumbnail: true });
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});

it("shows no thumbnail while amounts are hidden", async () => {
  setHideAmounts(true);
  await showGrid({ hasThumbnail: true });
  expect(container.querySelector("img")).toBeNull();
  expect(thumbnailUrl).not.toHaveBeenCalled();
});

const sheet = {
  name: "budget.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  previewText: "Item\tCost\nWidget\t$1,250,000.00",
};

it("shows the start of a spreadsheet's text as a small page", async () => {
  await showGrid(sheet);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("Item | Cost");
  expect(container.textContent).toContain("$1,250,000.00");
});

it("masks amounts in the text preview while they are hidden", async () => {
  setHideAmounts(true);
  await showGrid(sheet);
  expect(container.textContent).toContain("Item | Cost");
  expect(container.textContent).not.toContain("1,250,000");
});

it("shows only the file icon when there is nothing to preview", async () => {
  await showGrid({});
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("li svg")).not.toBeNull();
});
const agents = [
  { id: "bot_ada", name: "Ada", color: "#6366f1" },
  { id: "bot_ben", name: "Ben", color: "#10b981" },
];

const withAgents = (pick: (item: DataRoomApiItem, agent: { id: string }) => void) => ({
  ...o(),
  agents,
  onSendToAgent: pick,
});

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const menuItem = (name: string) =>
  Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
    (element) => element.textContent?.trim() === name,
  ) as HTMLElement | undefined;

async function sendFrom(target: Element, pick: ReturnType<typeof vi.fn>) {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
  });
  await flush();
  const sub = menuItem("Send to agent");
  expect(sub).toBeDefined();
  await act(async () => sub?.click());
  await flush();
  expect(menuItem("Ada")).toBeDefined();
  expect(menuItem("Ben")).toBeDefined();
  await act(async () => menuItem("Ben")?.click());
  expect(pick).toHaveBeenCalledTimes(1);
}

it("sends a list row to an agent from its right-click menu", async () => {
  const pick = vi.fn();
  const file = item("lease", null);
  act(() => root.render(<ListView rows={[{ item: file, snippets: [] }]} o={withAgents(pick)} />));
  await sendFrom(container.querySelector("[data-row]") as Element, pick);
  expect(pick).toHaveBeenCalledWith(file, expect.objectContaining({ id: "bot_ben" }));
});

it("sends a grid tile to an agent from its right-click menu", async () => {
  const pick = vi.fn();
  const file = item("lease", null);
  act(() => root.render(<GridView rows={[{ item: file, snippets: [] }]} o={withAgents(pick)} />));
  await sendFrom(container.querySelector("[data-row]") as Element, pick);
  expect(pick).toHaveBeenCalledWith(file, expect.objectContaining({ id: "bot_ben" }));
});

it("offers the same four actions in the right-click menu as in the row's More actions menu", async () => {
  const names = () =>
    Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((e) =>
      e.textContent?.trim(),
    );
  act(() =>
    root.render(
      <ListView rows={[{ item: item("lease", null), snippets: [] }]} o={withAgents(vi.fn())} />,
    ),
  );
  await act(async () => {
    container
      .querySelector("[data-row]")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  await flush();
  expect(names()).toEqual(["Send to agent", "Move", "Rename", "Delete"]);
});

it("keeps Move, Rename and Delete in the right-click menu when there is no agent to send to", async () => {
  act(() => root.render(<ListView rows={[{ item: item("lease", null), snippets: [] }]} o={o()} />));
  await act(async () => {
    container
      .querySelector("[data-row]")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  await flush();
  expect(menuItem("Send to agent")).toBeUndefined();
  expect(menuItem("Rename")).toBeDefined();
});

it("offers Send to agent in the row's More actions menu too", async () => {
  const pick = vi.fn();
  act(() =>
    root.render(
      <ListView rows={[{ item: item("lease", null), snippets: [] }]} o={withAgents(pick)} />,
    ),
  );
  const button = container.querySelector('button[aria-label^="More actions for"]') as HTMLElement;
  await act(async () => button.click());
  await flush();
  expect(menuItem("Send to agent")).toBeDefined();
});

it("names the step a working item is in on its spinner, and leaves ready items plain", () => {
  const rows = ["pending", "classifying", "indexing", "ready"].map((status) => ({
    item: { ...item(status, null), status } as DataRoomApiItem,
    snippets: [],
  }));
  act(() => root.render(<ListView rows={rows} o={o()} />));
  const titles = Array.from(
    container.querySelectorAll("[data-row] span[title]:has(> [role=presentation])"),
  ).map((el) => el.getAttribute("title"));
  expect(titles).toEqual(["Reading text", "Tagging", "Indexing for search"]);
});

it("offers Try again on a failed grid tile", () => {
  const onAction = vi.fn();
  const rows = [{ ...item("junk", null), status: "failed" }, item("fine", null)].map((i) => ({
    item: i as DataRoomApiItem,
    snippets: [],
  }));
  act(() => root.render(<GridView rows={rows} o={{ ...o(), onAction }} />));
  const retry = Array.from(container.querySelectorAll("button")).filter(
    (b) => b.textContent === "Try again",
  );
  expect(retry).toHaveLength(1);
  act(() => retry[0]?.click());
  expect(onAction).toHaveBeenCalledWith("retry", expect.objectContaining({ id: "junk" }));
});

it("shows the date the list is sorted on in a grid tile", async () => {
  const base = tile({})[0]?.item as DataRoomApiItem;
  const over = {
    createdAt: "2026-03-04T12:00:00.000Z",
    facets: { ...base.facets, docDate: "2025-09-01" },
  };
  await act(async () => root.render(<GridView rows={tile(over)} o={o()} sortField="createdAt" />));
  expect(container.querySelector('[data-testid="data-room-tile-meta"]')?.textContent).toContain(
    "2026",
  );
  await act(async () => root.render(<GridView rows={tile(over)} o={o()} sortField="date" />));
  expect(container.querySelector('[data-testid="data-room-tile-meta"]')?.textContent).toContain(
    "2025",
  );
});

it("lets a long file name wrap and keeps the Type column off narrow lists", () => {
  act(() => root.render(<ListView rows={tile({ name: "A long name" })} o={o()} />));
  const name = container.querySelector('[data-testid="data-room-name"] span[title]');
  expect(name?.className).toContain("line-clamp-2");
  expect(name?.className).not.toContain("truncate");
  expect(container.querySelector("tbody td:nth-child(2)")?.className).toContain(
    "@min-[640px]/list",
  );
});
