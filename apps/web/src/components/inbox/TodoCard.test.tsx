// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t, i18n: { locale: "en" } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("../../lib/rpc", () => ({ rpc: { inbox: { todos: { setDone: vi.fn() } } } }));

import { TodoCard } from "./TodoCard";

const todo = (n: number, doneAt: string | null = null) => ({
  id: `t${n}`,
  connectionId: "c1",
  messageId: null,
  text: `Todo ${n}`,
  detail: null,
  from: null,
  priority: null,
  dueOn: null,
  doneAt,
});

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const hiddenTexts = () =>
  [...document.querySelectorAll("li")]
    .filter((li) => li.className.includes("hidden"))
    .map((li) => li.textContent);
const toggle = () => document.querySelector("button[aria-expanded]") as HTMLButtonElement | null;

it("collapses open to-dos beyond two and expands them", () => {
  const todos = [1, 2, 3, 4, 5].map((n) => todo(n));
  act(() =>
    root.render(<TodoCard todos={[...todos, todo(6, "2026-10-01")]} onChange={() => {}} />),
  );
  expect(hiddenTexts()).toEqual(["Todo 3", "Todo 4", "Todo 5"]);
  expect(toggle()?.textContent).toBe("3 more");
  act(() => toggle()?.click());
  expect(hiddenTexts()).toEqual([]);
  expect(toggle()?.textContent).toBe("Show less");
});

it("shows no toggle when two or fewer are open", () => {
  act(() => root.render(<TodoCard todos={[todo(1), todo(2)]} onChange={() => {}} />));
  expect(toggle()).toBeNull();
});

const texts = () => [...document.querySelectorAll("li")].map((li) => li.textContent);

it("keeps a ticked to-do in its place, struck through, until the next visit", () => {
  const todos = [1, 2, 3].map((n) => todo(n));
  act(() => root.render(<TodoCard todos={todos} onChange={() => {}} />));
  const ticked = todos.map((item) => (item.id === "t1" ? { ...item, doneAt: "2026-10-17" } : item));
  act(() => root.render(<TodoCard todos={ticked} onChange={() => {}} />));
  expect(texts()).toEqual(["Todo 1", "Todo 2", "Todo 3"]);
  expect(document.querySelector("li div")?.className).toContain("line-through");
  // Todo 3 is still the one collapsed, and the count says so.
  expect(hiddenTexts()).toEqual(["Todo 3"]);
  expect(toggle()?.textContent).toBe("1 more");
});

it("opens the email a to-do came from", () => {
  const onOpen = vi.fn();
  act(() =>
    root.render(
      <TodoCard
        todos={[{ ...todo(1), messageId: "m1" }, todo(2)]}
        onChange={() => {}}
        onOpen={onOpen}
      />,
    ),
  );
  const title = [...document.querySelectorAll("button")].find((b) => b.textContent === "Todo 1");
  act(() => title?.click());
  expect(onOpen).toHaveBeenCalledWith("m1");
  // A to-do whose email left the cache has nothing to open.
  expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Todo 2")).toBe(
    false,
  );
});
