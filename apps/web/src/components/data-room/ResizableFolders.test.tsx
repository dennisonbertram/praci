// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { ResizableFolders } from "./ResizableFolders";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let body: HTMLDivElement;
const tree = () => <ResizableFolders bounds={body}>tree</ResizableFolders>;
beforeEach(() => {
  localStorage.clear();
  // A 1000px page: the tree may grow to 500px.
  body = document.createElement("div");
  Object.defineProperty(body, "clientWidth", { configurable: true, value: 1000 });
  HTMLElement.prototype.setPointerCapture = () => undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(tree()));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const handle = () => container.querySelector<HTMLElement>('[aria-label="Resize folders"]');
const width = () => handle()?.getAttribute("aria-valuenow");
const key = (name: string) =>
  act(() => {
    handle()?.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  });
const pointer = (type: string, x: number) =>
  act(() => {
    handle()?.dispatchEvent(
      new MouseEvent(type, { clientX: x, button: 0, bubbles: true, cancelable: true }),
    );
  });

it("resizes with the arrow keys within the minimum and the half-page maximum", () => {
  expect(width()).toBe("244");
  key("ArrowRight");
  expect(width()).toBe("276");
  key("ArrowLeft");
  key("ArrowLeft");
  expect(width()).toBe("212");
  key("Home");
  expect(width()).toBe("180");
  key("ArrowLeft");
  expect(width()).toBe("180");
  key("End");
  expect(width()).toBe("500");
  key("ArrowRight");
  expect(width()).toBe("500");
});

it("takes its maximum from the body, not from its own column width", () => {
  // The column itself reports 244px (as a shrink-to-fit parent would); the body is 1000px.
  const column = container.firstElementChild as HTMLElement;
  Object.defineProperty(column, "clientWidth", { configurable: true, value: 244 });
  Object.defineProperty(column.parentElement, "clientWidth", { configurable: true, value: 244 });
  expect(column.style.maxWidth).toBe("");
  key("End");
  expect(width()).toBe("500");
});

it("shows a narrower width when the body shrinks, and keeps the saved one", () => {
  key("End");
  Object.defineProperty(body, "clientWidth", { configurable: true, value: 600 });
  act(() => root.render(tree()));
  act(() => root.unmount());
  root = createRoot(container);
  act(() => root.render(tree()));
  expect(width()).toBe("300");
  expect(localStorage.getItem("rakazo:data-room-folders-width")).toBe("500");
});

it("resizes by dragging, remembers the width and resets on double-click", () => {
  pointer("pointerdown", 100);
  pointer("pointermove", 160);
  expect(width()).toBe("304");
  pointer("pointermove", 5000);
  expect(width()).toBe("500");
  pointer("pointerup", 5000);
  pointer("pointermove", 0);
  expect(width()).toBe("500");
  expect(localStorage.getItem("rakazo:data-room-folders-width")).toBe("500");

  act(() => root.render(tree()));
  act(() => root.unmount());
  root = createRoot(container);
  act(() => root.render(tree()));
  expect(width()).toBe("500");

  act(() => {
    handle()?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  expect(width()).toBe("244");
  expect(localStorage.getItem("rakazo:data-room-folders-width")).toBe("244");
});
