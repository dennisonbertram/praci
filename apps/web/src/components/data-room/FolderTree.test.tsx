// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { FolderTree } from "./FolderTree";
import { folderNodes } from "./folders";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const nodes = folderNodes([
  { id: "f-fin", name: "Finance", parentId: null, createdAt: "" },
  { id: "f-inv", name: "Invoices", parentId: "f-fin", createdAt: "" },
  { id: "f-legal", name: "Legal", parentId: null, createdAt: "" },
]);

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

const entries = () => Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));

it("is one Tab stop: only the selected folder can be tabbed to", () => {
  act(() => root.render(<FolderTree nodes={nodes} selected="f-inv" onSelect={vi.fn()} />));
  expect(entries().map((entry) => entry.tabIndex)).toEqual([-1, -1, 0, -1]);
  // A selection that is not in the list (a stale link) leaves All items as the stop.
  act(() => root.render(<FolderTree nodes={nodes} selected="gone" onSelect={vi.fn()} />));
  expect(entries().map((entry) => entry.tabIndex)).toEqual([0, -1, -1, -1]);
});

it("opens Move, Rename and Delete for a top-level folder on right-click", async () => {
  const onAction = vi.fn();
  act(() =>
    root.render(
      <FolderTree nodes={nodes} selected={undefined} onSelect={vi.fn()} onAction={onAction} />,
    ),
  );
  const legal = entries().find((entry) => entry.textContent === "Legal");
  await act(async () => {
    legal?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
  expect(items.map((item) => item.textContent)).toEqual(["Move", "Rename", "Delete"]);
  await act(async () => (items[1] as HTMLElement).click());
  expect(onAction).toHaveBeenCalledWith("rename", expect.objectContaining({ id: "f-legal" }));
  // All items is not a folder, so it has no menu.
  expect(entries()[0]?.querySelector("button")).toBeNull();
});

it("styles New folder like a folder row and marks the selected folder medium, not bold", () => {
  act(() =>
    root.render(
      <FolderTree nodes={nodes} selected="f-inv" onSelect={vi.fn()} onNewFolder={vi.fn()} />,
    ),
  );
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "New folder",
  );
  expect(button?.className).toContain("text-sm");
  expect(button?.className).toContain("min-h-8");
  expect(button?.querySelector("svg")?.getAttribute("class")).toContain("size-3.5");
  const selected = entries().find((e) => e.getAttribute("aria-selected") === "true");
  expect(selected?.className).toContain("font-medium");
  expect(selected?.className).not.toContain("font-semibold");
  expect(container.firstElementChild?.className).not.toContain("border-e");
});

it("marks a folder with subfolders as expanded and leaves the others without the attribute", () => {
  act(() => root.render(<FolderTree nodes={nodes} selected={undefined} onSelect={vi.fn()} />));
  expect(entries().map((entry) => entry.getAttribute("aria-expanded"))).toEqual([
    "true",
    "true",
    null,
    null,
  ]);
});

it("scrolls to the selected folder only when the selection changes", () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const render = (selected: string) =>
    act(() => root.render(<FolderTree nodes={nodes} selected={selected} onSelect={vi.fn()} />));
  render("f-inv");
  expect(scroll).toHaveBeenCalledTimes(1);
  render("f-inv");
  expect(scroll).toHaveBeenCalledTimes(1);
  render("f-legal");
  expect(scroll).toHaveBeenCalledTimes(2);
});
