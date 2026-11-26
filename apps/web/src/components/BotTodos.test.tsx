// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const api = vi.hoisted(() => ({ waiting: vi.fn(), update: vi.fn() }));
vi.mock("../lib/rpc", () => ({
  rpc: { scratchpad: { waitingOnYou: api.waiting, update: api.update } },
}));

import { BotTodos } from "./BotTodos";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const day = 86_400_000;
const item = (id: string, over = {}) => ({
  id,
  botId: "bot_ada",
  botName: "Ada",
  title: `Todo ${id}`,
  waitingOn: "you",
  dueAt: null,
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const mount = async (props: Parameters<typeof BotTodos>[0] = {}) => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <BotTodos {...props} />
      </MemoryRouter>,
    ),
  );
};
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.waiting.mockReset();
  api.update.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("lists undated and overdue items with a link to the bot", async () => {
  api.waiting.mockResolvedValue([
    item("1"),
    item("2", { dueAt: new Date(Date.now() - 3 * day).toISOString() }),
  ]);
  await mount();
  expect(container.textContent).toContain("Todo 1");
  expect(container.querySelector('a[href="/app/bot_ada"]')).not.toBeNull();
  expect(container.querySelector(".text-destructive")).not.toBeNull();
});

it("renders nothing when there are no items or loading fails", async () => {
  api.waiting.mockResolvedValue([]);
  await mount();
  expect(container.innerHTML).toBe("");
  api.waiting.mockRejectedValue(new Error("down"));
  await mount();
  expect(container.innerHTML).toBe("");
});

it("skips items whose due date is already on the grid", async () => {
  const from = new Date(Date.now() - day);
  const to = new Date(Date.now() + 7 * day);
  api.waiting.mockResolvedValue([
    item("1", { dueAt: new Date(Date.now() + 2 * day).toISOString() }),
    item("2"),
  ]);
  await mount({ hideDueBetween: { from, to } });
  expect(container.textContent).not.toContain("Todo 1");
  expect(container.textContent).toContain("Todo 2");
});

it("marks an item done and removes it", async () => {
  api.waiting.mockResolvedValue([item("1")]);
  api.update.mockResolvedValue({});
  await mount();
  await act(async () => {
    container.querySelector<HTMLElement>('[role="checkbox"]')?.click();
  });
  expect(api.update).toHaveBeenCalledWith({ itemId: "1", status: "done" });
  expect(container.innerHTML).toBe("");
});

it("refetches when the window regains focus", async () => {
  api.waiting.mockResolvedValue([item("1")]);
  await mount();
  api.waiting.mockResolvedValue([item("1"), item("2")]);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(api.waiting).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Todo 2");
});

it("shows a retry action after its first request fails", async () => {
  api.waiting.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([item("1")]);
  await mount();
  await act(async () => Promise.resolve());
  expect(container.textContent).toContain("Could not load");
  expect(container.querySelector('[aria-label="Todo 1"]')).toBeNull();
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  await act(async () => retry?.click());
  expect(container.textContent).toContain("Todo 1");
});

it("keeps a successful empty result empty when a later refresh fails", async () => {
  api.waiting.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
  await mount();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.innerHTML).toBe("");
});

it("sends only one completion update when a checkbox is clicked twice while pending", async () => {
  let resolveUpdate!: (value: unknown) => void;
  api.waiting.mockResolvedValue([item("1"), item("2")]);
  api.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
  );
  await mount();
  const checkbox = container.querySelector<HTMLElement>('[aria-label="Todo 1"]');
  await act(async () => {
    checkbox?.click();
    checkbox?.click();
  });
  expect(api.update).toHaveBeenCalledTimes(1);
  expect(checkbox?.getAttribute("aria-disabled")).toBe("true");
  expect(
    container.querySelector('[aria-label="Todo 2"]')?.getAttribute("aria-disabled"),
  ).toBeNull();
  await act(async () => resolveUpdate({}));
});

it("shows three items and reveals the rest on request", async () => {
  api.waiting.mockResolvedValue([item("1"), item("2"), item("3"), item("4"), item("5")]);
  await mount();
  expect(container.querySelectorAll("li")).toHaveLength(3);
  const more = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Show 2 more",
  );
  expect(more).toBeDefined();
  await act(async () => more?.click());
  expect(container.querySelectorAll("li")).toHaveLength(5);
  expect(container.textContent).not.toContain("Show 2 more");
});

it("hides the waiting-on line when the item waits on the person", async () => {
  api.waiting.mockResolvedValue([
    item("1", { waitingOn: "you to sign", dueAt: new Date(Date.now() + 2 * day).toISOString() }),
  ]);
  await mount();
  expect(container.textContent).not.toContain("Waiting on you to sign");
  expect(container.textContent).toContain("due ");
});

it("keeps a completed to-do gone when a slower refresh answers afterwards", async () => {
  api.waiting.mockResolvedValueOnce([item("1"), item("2")]);
  await mount();
  let answer!: (rows: unknown[]) => void;
  api.waiting.mockReturnValueOnce(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await act(async () => window.dispatchEvent(new Event("focus")));
  api.update.mockResolvedValue({});
  await act(async () => container.querySelector<HTMLElement>('[aria-label="Todo 1"]')?.click());
  await act(async () => answer([item("1"), item("2")]));
  expect(container.textContent).not.toContain("Todo 1");
  expect(container.textContent).toContain("Todo 2");
});
