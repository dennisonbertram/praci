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
  expect(document.querySelector("li div div")?.className).toContain("line-through");
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
  expect(title?.className).not.toContain("line-through");
  act(() =>
    root.render(
      <TodoCard
        todos={[{ ...todo(1, "2026-10-17"), messageId: "m1" }, todo(2)]}
        onChange={() => {}}
        onOpen={onOpen}
      />,
    ),
  );
  // The title is a button, which does not inherit the row's strike-through.
  expect(title?.className).toContain("line-through");
  // A to-do whose email left the cache has nothing to open.
  expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Todo 2")).toBe(
    false,
  );
});

const meetingTodo = (n: number, doneAt: string | null = null) => ({
  ...todo(n, doneAt),
  connectionId: null,
  meetingId: `m${n}`,
  detail: "Planning, Oct 19",
});
const source = { source: true, syncing: false, ready: true };

it("shows a meeting to-do as plain text with only the checkbox to act on, and a hit area of 32px or more", () => {
  act(() =>
    root.render(<TodoCard todos={[meetingTodo(1)]} onChange={() => {}} onOpen={() => {}} />),
  );
  expect(document.querySelectorAll("button:not([role=checkbox])")).toHaveLength(0);
  expect(document.querySelector("li")?.textContent).toContain("Todo 1");
  expect(document.querySelector("li")?.textContent).toContain("Planning, Oct 19");
  // The 16px box is padded by 8px above and below, so its target is 32px tall.
  expect(document.querySelector("[role=checkbox]")?.className).toContain("after:-inset-y-2");
});

it("shows Syncing while the first sync runs, even with no to-dos", () => {
  act(() =>
    root.render(
      <TodoCard todos={[]} meetings={{ ...source, syncing: true }} onChange={() => {}} />,
    ),
  );
  expect(document.body.textContent).toContain("To do");
  expect(document.body.textContent).toContain("Syncing");
  expect(document.body.textContent).not.toContain("No follow-ups from meetings yet");
});

it("says there are no follow-ups only for a synced source with consent, including after the last one is done", () => {
  const render = (todos: ReturnType<typeof meetingTodo>[], meetings?: typeof source) =>
    act(() => root.render(<TodoCard todos={todos} meetings={meetings} onChange={() => {}} />));
  render([], source);
  expect(document.body.textContent).toContain("No follow-ups from meetings yet");
  render([meetingTodo(1)], source);
  expect(document.body.textContent).not.toContain("No follow-ups from meetings yet");
  render([meetingTodo(1, "2026-10-17")], source);
  expect(document.body.textContent).toContain("To do");
  expect(document.body.textContent).toContain("No follow-ups from meetings yet");
  // Without consent, or without a source, an empty card shows nothing.
  render([], { ...source, ready: false });
  expect(document.body.textContent).toBe("");
  render([], undefined);
  expect(document.body.textContent).toBe("");
});
