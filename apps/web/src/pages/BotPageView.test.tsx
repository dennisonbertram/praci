// @vitest-environment jsdom
import type { BotPage, ProductEvent } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  data: vi.fn(),
  sources: vi.fn(),
  head: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    pages: {
      get: mocks.get,
      save: mocks.save,
      list: mocks.list,
      create: mocks.create,
      rename: mocks.rename,
      remove: mocks.remove,
      data: mocks.data,
      sources: mocks.sources,
    },
    threads: { head: mocks.head, subscribe: mocks.subscribe },
  },
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotPageView } from "./BotPageView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out: ProseMirror asks for a caret's rect when it scrolls to it after a change.
const noRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect;
for (const { prototype } of [Node, Element, Range])
  for (const name of ["getClientRects", "getBoundingClientRect"] as const)
    Object.defineProperty(prototype, name, {
      value: () => (name === "getClientRects" ? [noRect] : noRect),
      configurable: true,
    });

const page = (content: string, revision: number): BotPage => ({
  id: "p1",
  kind: "blocks",
  botId: "bot_demo",
  title: "Cash",
  content,
  revision,
  updatedBy: "bot",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const queued: ProductEvent[] = [];
let wake: (() => void) | undefined;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  queued.length = 0;
  mocks.list.mockResolvedValue([
    { id: "p1", title: "Cash", kind: "blocks", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  mocks.get.mockResolvedValue(page("Cash text", 1));
  mocks.save.mockResolvedValue({ ok: true, page: page("Cash text", 1) });
  mocks.data.mockResolvedValue(null);
  mocks.sources.mockResolvedValue([]);
  mocks.head.mockResolvedValue({ threadId: "t1", cursor: 0 });
  const stream = {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        while (queued.length === 0) await new Promise<void>((resolve) => (wake = resolve));
        return { value: queued.shift() as ProductEvent, done: false };
      },
      return: async () => ({ value: undefined, done: true }),
    }),
  };
  mocks.subscribe.mockResolvedValue(stream);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

const render = () =>
  act(async () => {
    root.render(
      <MemoryRouter>
        <BotPageView botId="bot_demo" pageId="p1" />
      </MemoryRouter>,
    );
  });

const event = (type: string, seq: number, payload: Record<string, unknown>) =>
  ({
    id: `event_${seq}`,
    spaceId: "space_demo",
    botId: "bot_demo",
    threadId: "t1",
    seq,
    type,
    payload,
    createdAt: "2026-01-01T00:00:00.000Z",
  }) as unknown as ProductEvent;

const push = async (next: ProductEvent) => {
  queued.push(next);
  wake?.();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

it("reloads the open page when the agent saves it during a visit", async () => {
  await render();
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text");
  expect(mocks.head).toHaveBeenCalledWith({ botId: "bot_demo" });
  expect(mocks.subscribe).toHaveBeenCalledWith({ botId: "bot_demo", cursor: 0 }, expect.anything());

  mocks.get.mockResolvedValue(page("Cash text v2", 2));
  const reads = mocks.get.mock.calls.length;
  await push(event("page.updated", 1, { pageId: "p1", revision: 2, updatedBy: "bot" }));
  expect(mocks.get.mock.calls.length).toBeGreaterThan(reads);
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text v2");
});

it("loads the page's live data again when the agent refreshes it", async () => {
  await render();
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text");
  mocks.data.mockClear();
  mocks.sources.mockClear();
  await push(event("page.data", 2, { pageId: "p1" }));
  expect(mocks.data).toHaveBeenCalledTimes(1);
  expect(mocks.data).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p1" });
});

it("re-reads the page once the thread's head is known", async () => {
  let resolveHead: (head: { threadId: string; cursor: number }) => void = () => undefined;
  mocks.head.mockReturnValue(
    new Promise((resolve) => {
      resolveHead = resolve;
    }),
  );
  await render();
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text");
  // The agent saved after this page was read but before the head cursor was known.
  mocks.get.mockResolvedValue(page("Cash text v2", 2));
  await act(async () => {
    resolveHead({ threadId: "t1", cursor: 7 });
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  expect(mocks.get.mock.calls.length).toBeGreaterThan(1);
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text v2");
});

it("loads fresh page state when switching bots", async () => {
  await render();
  mocks.get.mockClear();
  mocks.data.mockClear();
  let resolveHead: (head: { threadId: string; cursor: number }) => void = () => undefined;
  mocks.head.mockImplementation(({ botId }: { botId: string }) =>
    botId === "bot_b"
      ? new Promise((resolve) => {
          resolveHead = resolve;
        })
      : Promise.resolve({ threadId: "t1", cursor: 0 }),
  );

  await act(async () => {
    root.render(
      <MemoryRouter>
        <BotPageView botId="bot_b" pageId="p1" />
      </MemoryRouter>,
    );
  });
  mocks.get.mockClear();
  mocks.data.mockClear();

  await act(async () => {
    resolveHead({ threadId: "t2", cursor: 0 });
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  expect(mocks.get).toHaveBeenCalledWith({ botId: "bot_b", pageId: "p1" });
  expect(mocks.data).toHaveBeenCalledWith({ botId: "bot_b", pageId: "p1" });
});
