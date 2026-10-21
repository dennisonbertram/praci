// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

import { SelectionBar } from "./SelectionBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows nothing until a row is ticked, then Download, Send and Clear", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  const onDownload = vi.fn();
  const onSend = vi.fn();
  const onClear = vi.fn();
  act(() => root.render(<SelectionBar count={0} {...{ onDownload, onSend, onClear }} />));
  expect(el.textContent).toBe("");
  act(() => root.render(<SelectionBar count={3} {...{ onDownload, onSend, onClear }} />));
  const buttons = [...el.querySelectorAll("button")];
  expect(buttons.map((b) => b.textContent)).toEqual(["Download", "Send", ""]);
  for (const b of buttons) act(() => b.click());
  expect([onDownload, onSend, onClear].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  act(() => root.unmount());
});
