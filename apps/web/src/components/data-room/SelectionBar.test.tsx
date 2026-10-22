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

it("shows nothing until a row is ticked, then Download, Email, Send to agent and Clear", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  const onDownload = vi.fn();
  const onSend = vi.fn();
  const onClear = vi.fn();
  act(() => root.render(<SelectionBar count={0} {...{ onDownload, onSend, onClear }} />));
  expect(el.textContent).toBe("");
  const agents = [{ id: "b1", name: "Ada", color: "#6366f1" }];
  const onSendToAgent = vi.fn();
  act(() =>
    root.render(
      <SelectionBar count={3} {...{ onDownload, onSend, onClear, agents, onSendToAgent }} />,
    ),
  );
  const buttons = [...el.querySelectorAll("button")];
  expect(buttons.map((b) => b.textContent)).toEqual(["Download", "Email", "Send to agent", ""]);
  for (const b of buttons.filter((b) => b.textContent !== "Send to agent")) act(() => b.click());
  expect([onDownload, onSend, onClear].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  act(() => root.unmount());
});

it("says how many of the total are ticked, offers Select all N and does not take table space", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  const onSelectAll = vi.fn();
  const props = { onDownload: vi.fn(), onClear: vi.fn(), onSelectAll };
  act(() => root.render(<SelectionBar count={50} total={69} {...props} />));
  expect(el.querySelector('[role="toolbar"]')?.textContent).toContain("50 of 69 selected");
  expect(el.firstElementChild?.className).toContain("absolute");
  const all = [...el.querySelectorAll("button")].find((b) => b.textContent === "Select all 69");
  act(() => all?.click());
  expect(onSelectAll).toHaveBeenCalledTimes(1);
  act(() => root.render(<SelectionBar count={69} total={69} {...props} />));
  expect(el.textContent).toContain("69 selected");
  expect(el.textContent).not.toContain("Select all");
  act(() => root.unmount());
});
