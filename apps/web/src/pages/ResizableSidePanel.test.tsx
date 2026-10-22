// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (s: TemplateStringsArray) => s.join("") }));

import { ResizableSidePanel } from "./ResizableSidePanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setup(narrow: boolean) {
  window.matchMedia = (() => ({ matches: narrow })) as unknown as typeof window.matchMedia;
  const el = document.createElement("div");
  document.body.append(el);
  const onClose = vi.fn();
  const root = createRoot(el);
  act(() =>
    root.render(
      <ResizableSidePanel open panel="settings" onClose={onClose}>
        <p>Panel</p>
      </ResizableSidePanel>,
    ),
  );
  return { el, onClose, root };
}

afterEach(() => {
  document.body.innerHTML = "";
});

it("below xl a scrim click and Escape close the panel that lies over the chat", () => {
  const { el, onClose, root } = setup(true);
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() => el.querySelector<HTMLElement>("[data-testid=side-panel-scrim]")?.click());
  expect(onClose).toHaveBeenCalledTimes(2);
  act(() => root.unmount());
});

it("from xl the panel sits beside the chat, so Escape leaves it open", () => {
  const { onClose, root } = setup(false);
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(onClose).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it("Escape handled by an overlay above the panel leaves the panel open", () => {
  const { onClose, root } = setup(true);
  const above = (event: KeyboardEvent) => event.preventDefault();
  window.addEventListener("keydown", above, true);
  act(() =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })),
  );
  window.removeEventListener("keydown", above, true);
  expect(onClose).not.toHaveBeenCalled();
  act(() => root.unmount());
});
