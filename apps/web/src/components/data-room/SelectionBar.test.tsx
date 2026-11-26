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

it("disables Select all and the bulk actions until every file is loaded", async () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  let finish!: () => void;
  const onSelectAll = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  const onMove = vi.fn();
  const onDownload = vi.fn();
  const onSend = vi.fn();
  const onClear = vi.fn();
  act(() =>
    root.render(
      <SelectionBar
        count={2}
        total={5}
        onSelectAll={onSelectAll}
        onMove={onMove}
        onDownload={onDownload}
        onSend={onSend}
        agents={[{ id: "agent", name: "Agent", color: "#6366f1" }]}
        onSendToAgent={vi.fn()}
        onClear={onClear}
      />,
    ),
  );
  const button = (label: string) =>
    [...el.querySelectorAll("button")].find((b) => b.textContent === label);
  const selectAll = button("Select all 5");
  act(() => selectAll?.click());
  act(() => selectAll?.click());
  expect(onSelectAll).toHaveBeenCalledTimes(1);
  expect(selectAll?.disabled).toBe(true);
  expect(selectAll?.getAttribute("aria-busy")).toBe("true");
  for (const label of ["Move", "Download", "Email", "Send to agent"]) {
    expect(button(label)?.disabled).toBe(true);
  }
  expect(button("")?.disabled).toBe(false);
  expect(selectAll?.querySelector("svg")).toBeTruthy();

  await act(async () => finish());
  expect(selectAll?.disabled).toBe(false);
  for (const label of ["Move", "Download", "Email", "Send to agent"]) {
    expect(button(label)?.disabled).toBe(false);
  }
  act(() => root.unmount());
});

it("offers Share only when onShare is passed", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  const props = { count: 2, onDownload: vi.fn(), onClear: vi.fn() };
  act(() => root.render(<SelectionBar {...props} />));
  expect([...el.querySelectorAll("button")].some((b) => b.textContent === "Share")).toBe(false);
  const onShare = vi.fn();
  act(() => root.render(<SelectionBar {...props} onShare={onShare} />));
  const share = [...el.querySelectorAll("button")].find((b) => b.textContent === "Share");
  act(() => share?.click());
  expect(onShare).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

it("offers Move first, only when onMove is passed, and disables it while busy", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  const props = { count: 2, onDownload: vi.fn(), onClear: vi.fn() };
  act(() => root.render(<SelectionBar {...props} />));
  expect([...el.querySelectorAll("button")].some((b) => b.textContent === "Move")).toBe(false);
  const onMove = vi.fn();
  act(() => root.render(<SelectionBar {...props} onMove={onMove} />));
  const buttons = [...el.querySelectorAll("button")];
  expect(buttons[0]?.textContent).toBe("Move");
  act(() => buttons[0]?.click());
  expect(onMove).toHaveBeenCalledTimes(1);
  act(() => root.render(<SelectionBar {...props} onMove={onMove} busy />));
  expect(el.querySelector("button")?.disabled).toBe(true);
  act(() => root.unmount());
});

it("keeps every control on one row so a narrow window does not wrap the bar", () => {
  const el = document.createElement("div");
  const root = createRoot(el);
  act(() =>
    root.render(
      <SelectionBar
        count={1}
        total={67}
        onSelectAll={vi.fn()}
        onMove={vi.fn()}
        onDownload={vi.fn()}
        onClear={vi.fn()}
      />,
    ),
  );
  expect(el.querySelector('[role="toolbar"]')?.className).toContain("flex-nowrap");
  const all = [...el.querySelectorAll("button")].find((b) => b.textContent === "Select all 67");
  expect(all).toBeTruthy();
  expect(all?.closest("span.truncate")).toBeNull();
  act(() => root.unmount());
});
