// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (original) => ({
  ...(await original<typeof import("@rakazo/ui-web")>()),
  enqueueNotificationToast: toast,
}));
const toastTitles = () => toast.mock.calls.map(([toast]) => toast.title as string);

const rpcMock = vi.hoisted(() => ({
  folders: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  item: vi.fn(),
  connections: vi.fn(),
  consent: vi.fn(),
  itemDelete: vi.fn(),
  itemRetry: vi.fn(),
  facetValues: vi.fn(),
  stats: vi.fn(),
  processing: vi.fn(),
  imports: vi.fn(),
  inboxList: vi.fn(),
}));
const bulk = vi.hoisted(() => ({ save: vi.fn(), blob: vi.fn(), composed: vi.fn() }));
vi.mock("../lib/data-room", async (original) => ({
  ...(await original<typeof import("../lib/data-room")>()),
  saveDataRoomItem: bulk.save,
  fetchDataRoomBlob: bulk.blob,
}));
vi.mock("../components/ComposeEmail", () => ({
  NEW_MESSAGE: { kind: "new" },
  ComposeEmail: (props: { restore?: { files: File[] } }) => {
    bulk.composed(props.restore?.files.map((file) => file.name));
    return null;
  },
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    investors: { shares: async () => [] },
    inbox: { list: rpcMock.inboxList },
    connections: { list: rpcMock.connections, catalog: async () => [] },
    mcp: { servers: { list: async () => [] } },
    dataRoom: {
      folders: rpcMock.folders,
      items: { list: rpcMock.list },
      search: rpcMock.search,
      item: rpcMock.item,
      consent: rpcMock.consent,
      itemDelete: rpcMock.itemDelete,
      itemRetry: rpcMock.itemRetry,
      facetValues: rpcMock.facetValues,
      stats: rpcMock.stats,
      processing: rpcMock.processing,
      imports: rpcMock.imports,
    },
    legal: { itemLinks: async () => ({ contractTitle: null, deadlines: 0 }) },
  },
  withSpaceHeaders: () => new Headers(),
  selectedSpaceId: () => "s1",
}));

import { Snippet } from "../components/data-room/ItemRows";
import { DataRoomPage } from "./DataRoom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (name: string): DataRoomApiItem => ({
  id: `id-${name}`,
  name,
  mimeType: "text/plain",
  size: 10,
  folderId: null,
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  notIndexed: false,
  facets: {
    docType: "Memo",
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  hasThumbnail: false,
  previewText: null,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  rpcMock.connections.mockResolvedValue([]);
  rpcMock.folders.mockResolvedValue([]);
  rpcMock.imports.mockResolvedValue([]);
  rpcMock.processing.mockResolvedValue({
    reading: 0,
    tagging: 0,
    indexing: 0,
    failed: 0,
    current: null,
  });
  rpcMock.facetValues.mockResolvedValue({ types: [], parties: [], sources: [], hasDates: false });
  rpcMock.list.mockResolvedValue({ items: [item("b.txt"), item("a.txt")], nextCursor: null });
  rpcMock.search.mockResolvedValue({ results: [], nextCursor: null });
  rpcMock.item.mockResolvedValue(item("b.txt"));
  rpcMock.consent.mockResolvedValue({
    key: "k",
    version: "v",
    allowed: true,
    disclosure: "",
    recipients: [],
  });
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function GoToB() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go-b" onClick={() => navigate("/?item=B")}>
      go
    </button>
  );
}

function GoFailed() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go-failed" onClick={() => navigate("/?status=failed")}>
      failed
    </button>
  );
}

async function renderPage(entry = "/") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <DataRoomPage />
        <GoToB />
        <GoFailed />
      </MemoryRouter>,
    );
  });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });

/** Clicks the nth row, as a user choosing a file to preview. */
const clickRow = (n: number) =>
  act(async () => {
    container.querySelectorAll<HTMLElement>("[data-item-id]")[n]?.click();
  });

const names = () =>
  Array.from(container.querySelectorAll("[data-item-id] span[title]"))
    .map((el) => el.getAttribute("title"))
    .filter((title) => title?.endsWith(".txt"));

it("renders search highlights as text and <mark>, never as HTML", () => {
  const html = renderToStaticMarkup(
    <Snippet text={"before \u0001<script>alert(1)</script>\u0002 after"} />,
  );
  expect(html).toContain("<mark");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).not.toContain("<script");
});

it("waits for typing to pause, then searches on the server", async () => {
  await renderPage();
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
  expect(rpcMock.list).toHaveBeenCalledTimes(1);

  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  if (!input) throw new Error("no search box");
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  const type = async (value: string) => {
    await act(async () => {
      set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await type("lea");
  await type("lease");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(rpcMock.search).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(rpcMock.search).toHaveBeenCalledTimes(1);
  expect(rpcMock.search.mock.calls[0]?.[0]).toMatchObject({ query: "lease", filters: {} });
  // Relevance is the default order, so no sort is sent.
  expect(rpcMock.search.mock.calls[0]?.[0]).not.toHaveProperty("sort");
});

it("sends the chosen sort to the server and keeps the order it returns", async () => {
  await renderPage();
  // The server returned b before a; the page must not reorder that.
  expect(names()).toEqual(["b.txt", "a.txt"]);

  const direction = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Sort ascending"]',
  );
  await act(async () => {
    direction?.click();
  });
  expect(rpcMock.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: { field: "createdAt", direction: "asc" } }),
  );
  expect(names()).toEqual(["b.txt", "a.txt"]);
});

it("keeps a pinned item only while it is in the results, else closes without picking another", async () => {
  await renderPage();
  const preview = () =>
    container.querySelector('[data-testid="data-room-preview"] h3')?.textContent;
  await clickRow(1);
  expect(preview()).toBe("a.txt");

  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  const search = async (value: string, results: DataRoomApiItem[]) => {
    rpcMock.search.mockResolvedValue({
      results: results.map((hit) => ({ item: hit, ordinal: 0, snippet: "x", score: 1 })),
      nextCursor: null,
    });
    await act(async () => {
      set?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
  };
  // Still in the results: stays pinned.
  await search("one", [item("c.txt"), item("a.txt")]);
  expect(preview()).toBe("a.txt");
  // Gone from the results: the preview closes; the first result is not chosen for the user.
  await search("two", [item("d.txt")]);
  expect(container.querySelector('[data-testid="data-room-preview"]')).toBeNull();
});

it("restarts a search from the first page, without an error, when the cursor no longer fits", async () => {
  await renderPage();
  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  rpcMock.search
    .mockResolvedValueOnce({
      results: [{ item: item("c.txt"), ordinal: 0, snippet: "x", score: 1 }],
      nextCursor: "c000000000000000000000009",
    })
    .mockRejectedValueOnce(new ORPCError("CONFLICT", { message: "Search changed; start again" }))
    .mockResolvedValue({
      results: [{ item: item("d.txt"), ordinal: 0, snippet: "y", score: 1 }],
      nextCursor: null,
    });
  await act(async () => {
    set?.call(input, "lease");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  const more = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Load more",
  );
  await act(async () => {
    more?.click();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(rpcMock.search).toHaveBeenCalledTimes(3);
  // The third call is the first page again: no cursor.
  expect(rpcMock.search.mock.calls[2]?.[0].cursor).toBeUndefined();
  expect(names()).toEqual(["d.txt"]);
  expect(container.textContent).not.toContain("Search changed");
});

it("marks only failed items as failed; a ready item with an error gets a muted preview line", async () => {
  rpcMock.list.mockResolvedValue({
    items: [{ ...item("ok.txt"), error: "classifier timeout" }],
    nextCursor: null,
  });
  await renderPage();
  await clickRow(0);
  const row = container.querySelector("[data-item-id]");
  expect(row?.querySelector('[aria-label="Failed"]')).toBeNull();
  expect(row?.textContent).not.toContain("classifier timeout");
  expect(container.querySelector('[data-testid="data-room-preview"]')?.textContent).toContain(
    "Couldn't classify",
  );
  expect(container.querySelector('[data-testid="data-room-preview"]')?.textContent).not.toContain(
    "classifier timeout",
  );
});

it("disables Load more while a refresh is in flight", async () => {
  rpcMock.list.mockResolvedValueOnce({
    items: [item("a.txt")],
    nextCursor: "c000000000000000000000001",
  });
  await renderPage();
  const more = () =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Load more");
  expect(more()?.disabled).toBe(false);
  const refresh = deferred<unknown>();
  rpcMock.list.mockReturnValueOnce(refresh.promise);
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  expect(more()?.disabled).toBe(true);
  refresh.resolve({ items: [item("fresh.txt")], nextCursor: null });
  await settle();
  expect(names()).toEqual(["fresh.txt"]);
});

it("asks for a file being read no more than once per 10 seconds, and only through the processing counts", async () => {
  const reading = { reading: 1, tagging: 0, indexing: 0, failed: 0, current: "p.txt" };
  rpcMock.processing.mockResolvedValue(reading);
  rpcMock.list.mockResolvedValue({
    items: [{ ...item("p.txt"), status: "pending" }],
    nextCursor: null,
  });
  await renderPage();
  const before = [rpcMock.item, rpcMock.list, rpcMock.processing].map((m) => m.mock.calls.length);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(31_000);
  });
  const after = [rpcMock.item, rpcMock.list, rpcMock.processing].map((m) => m.mock.calls.length);
  // The item is not read on its own; the processing counts are read at 10, 20 and 30 seconds.
  expect(after[0]).toBe(before[0]);
  expect(after[1]).toBe(before[1]);
  expect((after[2] ?? 0) - (before[2] ?? 0)).toBe(3);
});

it("keeps the rows on screen while a new search loads, instead of a skeleton", async () => {
  await renderPage();
  expect(names()).toEqual(["b.txt", "a.txt"]);
  const answer = deferred<unknown>();
  rpcMock.search.mockReturnValueOnce(answer.promise);
  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  if (!input) throw new Error("no search box");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "lease");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(rpcMock.search).toHaveBeenCalledTimes(1);
  expect(names()).toEqual(["b.txt", "a.txt"]);
  expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  answer.resolve({ results: [], nextCursor: null });
  await settle();
  expect(names()).toEqual([]);
});

it("closes the preview when a reload drops the pinned item and it can no longer be read", async () => {
  await renderPage();
  await clickRow(0);
  const preview = () => container.querySelector('[data-testid="data-room-preview"]');
  expect(preview()).not.toBeNull();
  rpcMock.list.mockResolvedValueOnce({ items: [item("a.txt")], nextCursor: null });
  rpcMock.item.mockRejectedValue(new Error("gone"));
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  await settle();
  expect(names()).toEqual(["a.txt"]);
  expect(preview()).toBeNull();
});

const previewName = () =>
  container.querySelector('[data-testid="data-room-preview"] h3')?.textContent;

it("changes the preview only on a click, so the highlight stays on the chosen row", async () => {
  await renderPage();
  const rows = container.querySelectorAll<HTMLElement>("[data-item-id]");
  await clickRow(0);
  expect(previewName()).toBe("b.txt");
  await act(async () => {
    rows[1]?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    rows[1]?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    rows[1]?.focus();
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(previewName()).toBe("b.txt");
  expect(rows[0]?.getAttribute("aria-current")).toBe("true");
  await act(async () => {
    rows[1]?.click();
  });
  expect(previewName()).toBe("a.txt");
  expect(rows[1]?.getAttribute("aria-current")).toBe("true");
  // An arrow key selects the row it moves to.
  await act(async () => {
    rows[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  });
  expect(previewName()).toBe("b.txt");
});

it("keeps the chosen item through a narrow and back to wide resize, opening no dialog", async () => {
  let resize: () => void = () => undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const width = (value: number) =>
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value });
  width(1000);
  await renderPage();
  await clickRow(0);
  expect(previewName()).toBe("b.txt");
  width(400);
  await act(async () => resize());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(previewName()).toBeUndefined();
  width(1000);
  await act(async () => resize());
  expect(previewName()).toBe("b.txt");
  expect(container.querySelector('[aria-current="true"]')?.getAttribute("data-item-id")).toBe(
    "id-b.txt",
  );
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  vi.unstubAllGlobals();
});

it("shows the list again as soon as the search is cleared, without asking for fewer words", async () => {
  await renderPage();
  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  const type = async (value: string) => {
    await act(async () => {
      set?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  // The server already falls back to any of the words, so fewer words would find no more.
  await type("notice of renewal");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(container.textContent).toContain("No results");
  expect(container.textContent).not.toContain("fewer words");

  const lists = rpcMock.list.mock.calls.length;
  const answer = deferred<{ items: DataRoomApiItem[]; nextCursor: null }>();
  rpcMock.list.mockReturnValueOnce(answer.promise);
  await type("");
  // The old empty results must not flash the first-run screen (which would also remount the
  // consent card and ask for its status again).
  expect(container.textContent).not.toContain("Drop files here");
  expect(rpcMock.consent).toHaveBeenCalledTimes(1);
  answer.resolve({ items: [item("b.txt")], nextCursor: null });
  await settle();
  expect(rpcMock.list.mock.calls.length).toBe(lists + 1);
  expect(container.textContent).not.toContain("No results");
  expect(container.textContent).not.toContain("Relevance");
});

it("offers Date and Type sorts only once some item has a date or type", async () => {
  rpcMock.list.mockResolvedValue({
    items: [{ ...item("a.txt"), facets: { ...item("a.txt").facets, docType: null } }],
    nextCursor: null,
  });
  await renderPage();
  const sortTrigger = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith("Sort:"),
  );
  await act(async () => {
    sortTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const options = Array.from(document.querySelectorAll('[role="menuitemradio"]')).map(
    (el) => el.textContent,
  );
  expect(options).toEqual(["Name", "Added"]);
});

it("previews nothing until a file is chosen, also after opening a folder", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage();
  await settle();
  const preview = () => container.querySelector('[data-testid="data-room-preview"]');
  expect(names()).toEqual(["b.txt", "a.txt"]);
  expect(preview()).toBeNull();
  expect(container.querySelector('[aria-current="true"]')).toBeNull();
  const legal = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
    (el) => el.textContent === "Legal",
  );
  await act(async () => legal?.click());
  await settle();
  expect(preview()).toBeNull();
});

it("keeps the open folder in the URL, and opens it again from there", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  let search = "";
  function Location() {
    search = useLocation().search;
    return null;
  }
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/?folder=f1"]}>
        <DataRoomPage />
        <Location />
      </MemoryRouter>,
    );
  });
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "f1" }));
  const all = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
    (el) => el.textContent === "All items",
  );
  await act(async () => all?.click());
  await settle();
  expect(search).toBe("");
  const legal = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
    (el) => el.textContent === "Legal",
  );
  await act(async () => legal?.click());
  await settle();
  expect(search).toBe("?folder=f1");
});

it("lists only the documents Legal has not checked when the Legal page links here", async () => {
  await renderPage("/?legal=unchecked");
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ legalUnchecked: true }));
  expect(container.querySelector('[data-testid="data-room-filters"]')?.textContent).toContain(
    "Not checked",
  );
});

it("falls back to All items when the folder in the URL no longer exists", async () => {
  await renderPage("/?folder=gone");
  await settle();
  expect(rpcMock.list.mock.lastCall?.[0]).not.toHaveProperty("folderId", "gone");
});

it("says a failed file could not be read, with its reason and a Delete button", async () => {
  rpcMock.list.mockResolvedValue({
    items: [{ ...item("junk.pdf"), status: "failed", error: "This file isn't a readable PDF." }],
    nextCursor: null,
  });
  await renderPage();
  await clickRow(0);
  const preview = container.querySelector('[data-testid="data-room-preview"]');
  expect(preview?.textContent).toContain("Couldn't read this file");
  expect(preview?.textContent).toContain("This file isn't a readable PDF.");
  const remove = Array.from(preview?.querySelectorAll("button") ?? []).find(
    (b) => b.textContent === "Delete",
  );
  await act(async () => {
    remove?.click();
  });
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("junk.pdf");
});

it("keeps the Type, Party and Date filters while no item has them, and keeps the same columns", async () => {
  const bare = (name: string) => ({
    ...item(name),
    facets: { ...item(name).facets, docType: null },
  });
  rpcMock.list.mockResolvedValue({ items: [bare("a.txt"), bare("b.txt")], nextCursor: null });
  await renderPage();
  const labels = () =>
    Array.from(container.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"));
  // The pills stay, so the bar keeps one shape from folder to folder; each says it has nothing.
  expect(labels()).toContain("Filter by Type");
  expect(labels()).toContain("Filter by Party");
  expect(labels()).toContain("Filter by Document date");
  // One source filters nothing, and a source with no files would only lead to "No results".
  expect(labels()).not.toContain("Filter by Source");
  // The header is the same whether or not a file has a status.
  const head = () => container.querySelector('[data-testid="data-room-head"]')?.textContent;
  const bareHead = head();
  expect(bareHead).toBe("NameTypeAddedPartiesStatus");

  rpcMock.list.mockResolvedValue({
    items: [item("a.txt"), { ...bare("m.txt"), source: "gmail" }],
    nextCursor: null,
  });
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  await settle();
  expect(labels()).toContain("Filter by Type");
  expect(labels()).toContain("Filter by Source");
  expect(head()).toBe(bareHead);
});

it("offers to clear filters when they leave no results, keeping the folder", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage();
  const typeChip = container.querySelector<HTMLElement>('button[aria-label="Filter by Type"]');
  await act(async () => {
    typeChip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  rpcMock.list.mockResolvedValue({ items: [], nextCursor: null });
  const memo = Array.from(document.querySelectorAll('[role="menuitemradio"]')).find(
    (el) => el.textContent === "Memo",
  );
  await act(async () => {
    (memo as HTMLElement).click();
  });
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ docType: "Memo" }));
  const clear = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Clear filters",
  );
  rpcMock.list.mockResolvedValue({ items: [item("a.txt")], nextCursor: null });
  await act(async () => {
    clear?.click();
  });
  await settle();
  expect(rpcMock.list.mock.lastCall?.[0]).not.toHaveProperty("docType", "Memo");
  expect(names()).toEqual(["a.txt"]);
});

it("opens a linked item in its own folder, so the list shows it", async () => {
  rpcMock.item.mockResolvedValue({ ...item("x.txt"), id: "X", folderId: "f2" });
  await renderPage("/?item=X");
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "f2" }));
  expect(previewName()).toBe("x.txt");
});

it("keeps a linked item selected when it is not on the first page of its folder", async () => {
  const linked = deferred<DataRoomApiItem>();
  rpcMock.item.mockReturnValue(linked.promise);
  await renderPage("/?item=X");
  await settle();
  linked.resolve({ ...item("x.txt"), id: "X", folderId: "f2" });
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "f2" }));
  expect(previewName()).toBe("x.txt");
});

it("follows the folder in the URL when it changes, and Back returns to the previous folder", async () => {
  rpcMock.folders.mockResolvedValue(
    ["A", "B"].map((name) => ({
      id: `f${name}`,
      name,
      parentId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
    })),
  );
  let go: ReturnType<typeof useNavigate> = () => undefined;
  function Nav() {
    go = useNavigate();
    return null;
  }
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/?folder=fA"]}>
        <DataRoomPage />
        <Nav />
      </MemoryRouter>,
    );
  });
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "fA" }));
  await act(async () => go("/?folder=fB"));
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "fB" }));
  // Choosing a folder adds a history entry.
  const tree = (label: string) =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
      (el) => el.textContent === label,
    );
  await act(async () => tree("A")?.click());
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "fA" }));
  await act(async () => go(-1));
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "fB" }));
});

it("shows no snippet when only the name matched", async () => {
  await renderPage();
  rpcMock.search.mockResolvedValue({
    results: [
      { item: item("lease.pdf"), ordinal: -1, snippet: "\u0001lease\u0002.pdf Legal", score: 1 },
      { item: item("memo.txt"), ordinal: 0, snippet: "the \u0001lease\u0002 ends", score: 1 },
      {
        item: item("deal.pdf"),
        ordinal: -1,
        snippet: "deal.pdf\nOffice \u0001lease\u0002 renewal",
        score: 1,
      },
    ],
    nextCursor: null,
  });
  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    set?.call(input, "lease");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  // Results are the list's own rows, with the matching text under the name.
  const rows = container.querySelectorAll('tbody[aria-label="Items"] > tr[data-row]');
  expect(rows).toHaveLength(3);
  // A snippet is under the name, in the file's own row.
  const mark = (row?: Element) => row?.querySelector("mark") ?? null;
  expect(mark(rows[0])).toBeNull();
  expect(mark(rows[1])?.textContent).toBe("lease");
  // A metadata hit on the summary is not a name match, so its snippet stays.
  expect(mark(rows[2])?.textContent).toBe("lease");
});

it("remembers the view and sort across visits", async () => {
  await renderPage();
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Grid view"]')?.click();
    container.querySelector<HTMLButtonElement>('button[aria-label="Sort ascending"]')?.click();
  });
  act(() => root.unmount());
  root = createRoot(container);
  await renderPage();
  expect(
    container.querySelector('button[aria-label="Grid view"]')?.getAttribute("aria-pressed"),
  ).toBe("true");
  expect(rpcMock.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: { field: "createdAt", direction: "asc" } }),
  );
});

it("lists an open folder's sub-folders above its files, and opens one on click", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Finance", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
    {
      id: "f2",
      name: "Invoices",
      parentId: "f1",
      createdAt: "2026-10-01T00:00:00.000Z",
      itemCount: 2,
    },
  ]);
  await renderPage();
  rpcMock.list.mockResolvedValue({ items: [], nextCursor: null });
  const finance = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
    (el) => el.textContent === "Finance",
  );
  await act(async () => finance?.click());
  await settle();
  // A folder holding only a sub-folder is not "empty" and not "No results".
  expect(container.textContent).not.toContain("No results");
  expect(container.textContent).not.toContain("This folder is empty");
  const sub = container.querySelector<HTMLElement>('[aria-label="Sub-folders"] button');
  // The row says what is inside, so Finance never looks emptier than it is.
  expect(sub?.textContent).toBe("Invoices2 items");
  await act(async () => sub?.click());
  await settle();
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "f2" }));
  expect(container.textContent).toContain("This folder is empty. Drop files here or add them.");
  // A phone cannot drop files: the empty folder has its own Add files button.
  expect(
    Array.from(container.querySelectorAll("[data-testid=data-room-list] button")).some(
      (b) => b.textContent === "Add files",
    ),
  ).toBe(true);
});

it("shows the next item after deleting the previewed one, so the preview stays open", async () => {
  rpcMock.list.mockResolvedValue({
    items: [item("a.txt"), item("b.txt"), item("c.txt")],
    nextCursor: null,
  });
  rpcMock.itemDelete.mockResolvedValue(undefined);
  await renderPage();
  await clickRow(0);
  const heading = () => container.querySelector('[data-testid="data-room-preview"] h3');
  expect(heading()?.textContent).toBe("a.txt");
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(
        '[data-testid="data-room-preview"] button[aria-label="More actions for a.txt"]',
      )
      ?.click();
  });
  await settle();
  const menuDelete = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (el) => el.textContent?.includes("Delete"),
  );
  await act(async () => menuDelete?.click());
  await settle();
  rpcMock.list.mockResolvedValue({ items: [item("b.txt"), item("c.txt")], nextCursor: null });
  const confirm = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button'),
  ).find((b) => b.textContent === "Delete");
  await act(async () => confirm?.click());
  await settle();
  expect(rpcMock.itemDelete).toHaveBeenCalledWith({ id: "id-a.txt" });
  expect(heading()?.textContent).toBe("b.txt");
});

const typeSearch = async (value: string) => {
  const input = container.querySelector<HTMLInputElement>('input[name="data-room-search"]');
  if (!input) throw new Error("no search box");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
};

it("says a search covers only the open folder, and Search all items looks everywhere", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Fundraising", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage("/?folder=f1");
  await settle();
  await typeSearch("lease");
  expect(rpcMock.search.mock.lastCall?.[0]).toMatchObject({ filters: { folderId: "f1" } });
  expect(container.textContent).toContain("Searching in Fundraising");
  const all = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Search all items",
  );
  await act(async () => all?.click());
  await settle();
  expect(rpcMock.search.mock.lastCall?.[0]).toMatchObject({ query: "lease", filters: {} });
  expect(container.textContent).not.toContain("Searching in");
});

it("says a linked document could not be found and drops it from the URL", async () => {
  rpcMock.item.mockRejectedValue(new ORPCError("NOT_FOUND"));
  let search = "";
  function Location() {
    search = useLocation().search;
    return null;
  }
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/?item=nonexistent"]}>
        <DataRoomPage />
        <Location />
      </MemoryRouter>,
    );
  });
  await settle();
  expect(search).toBe("");
  expect(toastTitles()).toContain("That document could not be found");
});

it("reads a failed file again from its preview", async () => {
  const junk = { ...item("junk.pdf"), status: "failed", error: "Not a PDF" };
  rpcMock.list.mockResolvedValue({ items: [junk], nextCursor: null });
  rpcMock.itemRetry.mockResolvedValue({ ...junk, status: "pending", error: null });
  await renderPage();
  await clickRow(0);
  const again = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => again?.click());
  await settle();
  expect(rpcMock.itemRetry).toHaveBeenCalledWith({ id: junk.id });
  expect(rpcMock.list.mock.calls.length).toBeGreaterThan(1);
});

it("offers every type and party in the folder, also those not on the loaded page", async () => {
  rpcMock.facetValues.mockResolvedValue({
    types: ["contract", "statement"],
    parties: ["Mercury (Mock)"],
    sources: ["upload"],
    hasDates: true,
  });
  await renderPage();
  await settle();
  const typeFilter = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Filter by Type"]',
  );
  await act(async () => {
    typeFilter?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const options = Array.from(document.querySelectorAll('[role="menuitemradio"]')).map(
    (el) => el.textContent,
  );
  // "Memo" is on the loaded rows; the other two only in the folder's values.
  expect(options).toEqual(["Contract", "Memo", "Statement"]);
  expect(container.querySelector('button[aria-label="Filter by Party"]')).not.toBeNull();
  expect(rpcMock.facetValues).toHaveBeenCalledWith({});
  // A picked type narrows what the other filters offer, so no pick combines into nothing.
  const contract = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
  ).find((el) => el.textContent === "Contract");
  await act(async () => contract?.click());
  await settle();
  expect(rpcMock.facetValues).toHaveBeenLastCalledWith({ docType: "contract" });
});

it("says so when the open folder was deleted elsewhere, and shows All items", async () => {
  const legal = { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" };
  rpcMock.folders.mockResolvedValue([legal]);
  const gone = () =>
    toastTitles().filter((title) => title === "That folder no longer exists").length;
  await renderPage("/?folder=f1");
  await settle();
  const before = gone();
  rpcMock.folders.mockResolvedValue([]);
  await act(async () => window.dispatchEvent(new Event("focus")));
  await settle();
  expect(gone()).toBe(before + 1);
  expect(rpcMock.list.mock.lastCall?.[0]).not.toHaveProperty("folderId", "f1");
});

it("confirms Try again at once, so the click visibly did something", async () => {
  const junk = { ...item("junk.pdf"), status: "failed", error: "Not a PDF" };
  rpcMock.list.mockResolvedValue({ items: [junk], nextCursor: null });
  rpcMock.itemRetry.mockResolvedValue({ ...junk, status: "pending", error: null });
  await renderPage();
  await clickRow(0);
  const again = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => again?.click());
  await settle();
  expect(toastTitles()).toContain("Reading junk.pdf again");
});

const running = {
  id: "imp1",
  source: "drive",
  total: 5,
  done: 3,
  failed: 0,
  inProgress: 2,
  finished: false,
  latest: [],
};
const activity = () => container.querySelector('[role="status"]')?.textContent ?? "";

it("shows an import's progress, reloads the list while it runs, and stops when it is done", async () => {
  rpcMock.imports.mockResolvedValue([running]);
  await renderPage();
  await settle();
  expect(activity()).toContain("Importing 3 of 5");
  const listCalls = rpcMock.list.mock.calls.length;
  const importCalls = rpcMock.imports.mock.calls.length;

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_100);
  });
  expect(rpcMock.imports.mock.calls.length).toBeGreaterThan(importCalls);
  expect(rpcMock.list.mock.calls.length).toBeGreaterThan(listCalls);

  rpcMock.imports.mockResolvedValue([
    {
      ...running,
      done: 4,
      failed: 1,
      inProgress: 0,
      finished: true,
      latest: ["a.txt", "x.txt", "y.txt"].map((name) => ({ id: `id-${name}`, name })),
    },
  ]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_100);
  });
  expect(activity()).toContain("Imported 4 files");
  expect(activity()).toContain("Couldn't import 1 file");
  expect(activity()).toContain("a.txt");

  // Nothing is running any more, so nothing asks again.
  const settledImports = rpcMock.imports.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(rpcMock.imports.mock.calls.length).toBe(settledImports);
});

/** The import was started (or still running) on this visit, then finished: its row shows. */
const finishedThisVisit = async (finished: object) => {
  rpcMock.imports.mockResolvedValueOnce([running]).mockResolvedValue([finished]);
  await renderPage();
  await settle();
  await act(async () => void window.dispatchEvent(new Event("rakazo:data-room-import-started")));
  await settle();
};

it("opens a file of a finished import, and lets the row be dismissed", async () => {
  await finishedThisVisit({
    ...running,
    done: 5,
    inProgress: 0,
    finished: true,
    latest: ["b.txt", "c.txt", "d.txt"].map((name, n) => ({ id: n ? name : "B", name })),
  });
  rpcMock.item.mockResolvedValue({ ...item("b.txt"), id: "B" });
  const link = Array.from(container.querySelectorAll("[role=status] button")).find(
    (b) => b.textContent === "b.txt",
  );
  await act(async () => (link as HTMLElement).click());
  await settle();
  expect(rpcMock.item).toHaveBeenCalledWith({ id: "B" });

  const dismiss = container.querySelector<HTMLElement>(
    '[role=status] button[aria-label="Dismiss"]',
  );
  await act(async () => dismiss?.click());
  expect(activity()).toBe("");
});

it("clears the finished-import row when the open folder changes", async () => {
  rpcMock.imports
    .mockResolvedValueOnce([running])
    .mockResolvedValue([
      { ...running, done: 5, inProgress: 0, finished: true, latest: [{ id: "B", name: "b.txt" }] },
    ]);
  rpcMock.folders.mockResolvedValue(
    ["A", "B"].map((name) => ({
      id: `f${name}`,
      name,
      parentId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
    })),
  );
  let go: ReturnType<typeof useNavigate> = () => undefined;
  function Nav() {
    go = useNavigate();
    return null;
  }
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/?folder=fA"]}>
        <DataRoomPage />
        <Nav />
      </MemoryRouter>,
    );
  });
  await settle();
  await act(async () => void window.dispatchEvent(new Event("rakazo:data-room-import-started")));
  await settle();
  expect(activity()).toContain("Imported 5 files");
  await act(async () => go("/?folder=fB"));
  await settle();
  expect(activity()).toBe("");
});

it("shows no activity row when no import is running or recent", async () => {
  await renderPage();
  await settle();
  expect(activity()).toBe("");
});

it("shows Ask only when the page can open the agent, and clicking it asks for the agent", async () => {
  const onAskAgent = vi.fn();
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DataRoomPage onAskAgent={onAskAgent} />
      </MemoryRouter>,
    );
  });
  const ask = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Ask Data room agent"]',
  );
  expect(ask).not.toBeNull();
  await act(async () => ask?.click());
  expect(onAskAgent).toHaveBeenCalledOnce();

  await act(async () => {
    root.render(
      <MemoryRouter>
        <DataRoomPage />
      </MemoryRouter>,
    );
  });
  expect(container.querySelector('button[aria-label="Ask Data room agent"]')).toBeNull();
});

it("shows stats for the open filters, and a click on a type filters the list", async () => {
  rpcMock.stats.mockResolvedValue({
    documents: 2,
    bytes: 20,
    duplicates: 0,
    status: { ready: 2, processing: 0, failed: 0, notSearchable: 0 },
    types: [{ value: "legal", count: 2 }],
    sources: [{ value: "upload", count: 2 }],
    dates: { unit: "month", buckets: [] },
    parties: [],
    largest: [],
    amounts: [],
  });
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Deals", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage("/?folder=f1");
  const stats = container.querySelector<HTMLButtonElement>('button[aria-label="Stats"]');
  await act(async () => {
    stats?.click();
  });
  expect(rpcMock.stats).toHaveBeenLastCalledWith({ folderId: "f1" });
  expect(container.querySelector('[data-testid="data-room-stats"]')).not.toBeNull();
  const legal = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Legal document"),
  );
  await act(async () => {
    legal?.click();
  });
  expect(container.querySelector('[data-testid="data-room-stats"]')).toBeNull();
  expect(rpcMock.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ folderId: "f1", docType: "legal" }),
  );
});

it("keeps the consent card in Stats, so the folder tree does not move", async () => {
  rpcMock.consent.mockResolvedValue({
    key: "k",
    version: "v",
    allowed: false,
    disclosure: "",
    recipients: [{ name: "Model", provider: "p" }],
  });
  rpcMock.stats.mockResolvedValue({
    documents: 0,
    bytes: 0,
    duplicates: 0,
    status: { ready: 0, processing: 0, failed: 0, notSearchable: 0 },
    types: [],
    sources: [],
    dates: { unit: "month", buckets: [] },
    parties: [],
    largest: [],
    amounts: [],
  });
  await renderPage();
  expect(container.textContent).toContain("Let Praci read your documents");
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Stats"]')?.click();
  });
  expect(container.querySelector('[data-testid="data-room-stats"]')).not.toBeNull();
  expect(container.textContent).toContain("Let Praci read your documents");
});

it("does not ask for the list again while a request is still in flight", async () => {
  const slow = deferred<{ items: DataRoomApiItem[]; nextCursor: null }>();
  rpcMock.list.mockReturnValue(slow.promise);
  await renderPage();
  expect(rpcMock.list).toHaveBeenCalledTimes(1);
  // A poll tick from the processing strip.
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  expect(rpcMock.list).toHaveBeenCalledTimes(1);
  await act(async () => {
    slow.resolve({ items: [item("a.txt")], nextCursor: null });
  });
  expect(names()).toEqual(["a.txt"]);
});

// Index 0 is the header's Select all.
const tick = (n: number) =>
  act(async () => {
    container.querySelectorAll<HTMLElement>('[role="checkbox"]')[n + 1]?.click();
  });
const barButton = (label: string) =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-testid="data-room-selection"] button'),
  ).find((button) => (button.textContent || button.ariaLabel) === label);

it("downloads the ticked files and opens the mail composer with them attached", async () => {
  bulk.blob.mockResolvedValue(new Blob(["x"]));
  rpcMock.inboxList.mockResolvedValue({ accounts: [{ connectionId: "c1", label: "Work" }] });
  await renderPage();
  expect(container.querySelector('[data-testid="data-room-selection"]')).toBeNull();
  await tick(0);
  await tick(1);
  expect(container.querySelector('[data-testid="data-room-selection"]')?.textContent).toContain(
    "2 selected",
  );
  // Ticking never opens the preview.
  expect(container.querySelector('[aria-current="true"]')).toBeNull();
  await act(async () => barButton("Download")?.click());
  await settle();
  expect(bulk.save.mock.calls.map(([saved]) => saved.name)).toEqual(["b.txt", "a.txt"]);
  await act(async () => barButton("Email")?.click());
  await settle();
  expect(bulk.composed).toHaveBeenLastCalledWith(["b.txt", "a.txt"]);
  await act(async () => barButton("Clear selection")?.click());
  expect(container.querySelector('[data-testid="data-room-selection"]')).toBeNull();
});

it("sends every ticked file to the chosen agent in one go", async () => {
  const onSendToAgent = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: true }) as MediaQueryList);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <DataRoomPage
          agents={[{ id: "bot_ada", name: "Ada", color: "#6366f1" }]}
          onSendToAgent={onSendToAgent}
        />
      </MemoryRouter>,
    );
  });
  await act(async () => container.querySelector<HTMLElement>('[aria-label="Select all"]')?.click());
  await act(async () => barButton("Send to agent")?.click());
  const ada = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (el) => el.textContent === "Ada",
  );
  await act(async () => ada?.click());
  expect(onSendToAgent).toHaveBeenCalledTimes(1);
  expect(onSendToAgent.mock.calls[0]?.[0].map((file: DataRoomApiItem) => file.name)).toEqual([
    "b.txt",
    "a.txt",
  ]);
  expect(container.querySelector('[data-testid="data-room-selection"]')).toBeNull();
});

it("lists only the new folder's items when it is opened with the preview open", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage();
  await settle();
  await clickRow(0);
  expect(previewName()).toBe("b.txt");
  const inFolder = deferred<{ items: DataRoomApiItem[]; nextCursor: null }>();
  rpcMock.list.mockImplementation((input: { folderId?: string }) =>
    input.folderId === "f1"
      ? inFolder.promise
      : Promise.resolve({ items: [item("b.txt"), item("a.txt")], nextCursor: null }),
  );
  const legal = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]')).find(
    (el) => el.textContent === "Legal",
  );
  await act(async () => legal?.click());
  // A background change announcement arrives while the folder's answer is on its way.
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  inFolder.resolve({ items: [item("c.txt")], nextCursor: null });
  await settle();
  await settle();
  expect(names()).toEqual(["c.txt"]);
});

it("filters to failed files when the sidebar badge link is followed while the page is open", async () => {
  await renderPage();
  await act(async () => {
    container.querySelector<HTMLElement>('[data-testid="go-failed"]')?.click();
  });
  expect(rpcMock.list.mock.calls.at(-1)?.[0]).toMatchObject({ status: "failed" });
});
