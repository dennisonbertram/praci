// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  folders: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  item: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    dataRoom: {
      folders: rpcMock.folders,
      items: { list: rpcMock.list },
      search: rpcMock.search,
      item: rpcMock.item,
    },
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
  status: "ready",
  error: null,
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
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  rpcMock.folders.mockResolvedValue([]);
  rpcMock.list.mockResolvedValue({ items: [item("b.txt"), item("a.txt")], nextCursor: null });
  rpcMock.search.mockResolvedValue({ results: [], nextCursor: null });
  rpcMock.item.mockResolvedValue(item("b.txt"));
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

async function renderPage(entry = "/") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <DataRoomPage />
        <GoToB />
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

const names = () =>
  Array.from(container.querySelectorAll("li[data-item-id] span[title]"))
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

  const direction = container.querySelector<HTMLButtonElement>('button[aria-label="Descending"]');
  await act(async () => {
    direction?.click();
  });
  expect(rpcMock.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: { field: "createdAt", direction: "asc" } }),
  );
  expect(names()).toEqual(["b.txt", "a.txt"]);
});

it("keeps a pinned item only while it is in the results, else pins the first or closes", async () => {
  await renderPage();
  const preview = () =>
    container.querySelector('[data-testid="data-room-preview"] h3')?.textContent;
  // b.txt is pinned first; pin a.txt by clicking it.
  await act(async () => {
    container.querySelectorAll<HTMLElement>("li[data-item-id]")[1]?.click();
  });
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
  await search("one", [item("c.txt")]);
  expect(preview()).toBe("c.txt");
  // Still in the results: stays pinned.
  await search("two", [item("d.txt"), item("c.txt")]);
  expect(preview()).toBe("c.txt");
  await search("none", []);
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
  const row = container.querySelector("li[data-item-id]");
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

it("does not let a late status poll overwrite a newer list", async () => {
  rpcMock.list.mockResolvedValueOnce({
    items: [{ ...item("p.txt"), status: "pending" }],
    nextCursor: null,
  });
  await renderPage();
  const poll = deferred<DataRoomApiItem>();
  rpcMock.item.mockReturnValueOnce(poll.promise);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_100);
  });
  expect(rpcMock.item).toHaveBeenCalledTimes(1);
  // The item is renamed and ready before the poll answers.
  rpcMock.list.mockResolvedValueOnce({
    items: [{ ...item("renamed.txt"), id: "id-p.txt" }],
    nextCursor: null,
  });
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:data-room-changed"));
  });
  await settle();
  expect(names()).toEqual(["renamed.txt"]);
  poll.resolve({ ...item("p.txt"), id: "id-p.txt", status: "pending" });
  await settle();
  expect(names()).toEqual(["renamed.txt"]);
});

it("applies a deep-link item only while it is still the one in the URL", async () => {
  const a = deferred<DataRoomApiItem>();
  const b = deferred<DataRoomApiItem>();
  rpcMock.item.mockImplementation(({ id }: { id: string }) => (id === "A" ? a.promise : b.promise));
  await renderPage("/?item=A");
  await act(async () => {
    container.querySelector<HTMLElement>('[data-testid="go-b"]')?.click();
  });
  b.resolve({ ...item("b-doc.txt"), id: "B" });
  await settle();
  a.resolve({ ...item("a-doc.txt"), id: "A" });
  await settle();
  expect(container.querySelector('[data-testid="data-room-preview"] h3')?.textContent).toBe(
    "b-doc.txt",
  );
});

it("offers a folder picker that chooses and clears a folder at any width", async () => {
  rpcMock.folders.mockResolvedValue([
    { id: "f1", name: "Legal", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  ]);
  await renderPage();
  const trigger = () =>
    container.querySelector<HTMLElement>('[data-testid="data-room-folder-picker"]');
  const choose = async (label: string) => {
    await act(async () => {
      trigger()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const option = Array.from(document.querySelectorAll('[role="menuitemradio"]')).find(
      (el) => el.textContent === label,
    );
    await act(async () => {
      (option as HTMLElement).click();
    });
    await settle();
  };
  await choose("Legal");
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: "f1" }));
  expect(trigger()?.textContent).toContain("Legal");
  await choose("All items");
  expect(rpcMock.list.mock.lastCall?.[0]).not.toHaveProperty("folderId", "f1");
});

it("on a narrow page opens the preview in a dialog only on click, not on hover", async () => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 400 });
  await renderPage();
  const row = container.querySelectorAll<HTMLElement>("li[data-item-id]")[1];
  await act(async () => {
    row?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    row?.dispatchEvent(new MouseEvent("mouseenter"));
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('[data-testid="data-room-preview"]')).toBeNull();
  await act(async () => {
    row?.focus();
    row?.click();
    await vi.advanceTimersByTimeAsync(50);
  });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("a.txt");
  expect(dialog?.contains(document.activeElement)).toBe(true);
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});
