// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DataRoomPage />
      </MemoryRouter>,
    );
  });
}

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
