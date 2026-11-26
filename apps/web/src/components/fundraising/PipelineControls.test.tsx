// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toPipelineRow } from "../../lib/pipeline-rows";
import { InterestChoice, InterestPick, NextCallEditor, ReferredByPicker } from "./PipelineControls";
import { prospect } from "./pipeline-fixtures";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// cmdk measures and scrolls its list, which jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

let el: HTMLDivElement;
beforeEach(() => {
  el = document.createElement("div");
  document.body.append(el);
});
afterEach(() => {
  el.remove();
});

const render = (node: ReactNode) => act(async () => createRoot(el).render(node));
const click = (node: Element | null | undefined) => act(async () => (node as HTMLElement)?.click());
const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const byLabel = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);

it("saves a date and a time once, when the next call editor is closed", async () => {
  const contact = prospect("n1", "Oak Example Angels", { nextCallAt: null });
  const onSave = vi.fn();
  await render(
    <NextCallEditor row={toPipelineRow(contact)} onSave={onSave}>
      <span>Set date</span>
    </NextCallEditor>,
  );
  await click(byLabel("Next call with Oak Example Angels"));
  const date = document.querySelector("#n1-date") as HTMLInputElement;
  await type(date, "2026-11-12");
  expect(onSave).not.toHaveBeenCalled();
  const time = document.querySelector("#n1-time") as HTMLInputElement;
  await type(time, "15:30");
  expect(onSave).not.toHaveBeenCalled();
  await act(async () => {
    date.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({ day: "2026-11-12", time: "15:30" });
});

it("offers Nobody first when the row already has a referrer, and calls onPick(null)", async () => {
  const contact = prospect("n2", "Peak Example", { referredBy: { id: "c1", name: "Sam Example" } });
  const row = toPipelineRow(contact);
  const onPick = vi.fn();
  await render(
    <ReferredByPicker
      row={row}
      contacts={[]}
      trigger={<span>Sam Example</span>}
      onPick={onPick}
      onCreate={vi.fn()}
    />,
  );
  await click(byLabel("Add who referred Peak Example"));
  const items = [...document.querySelectorAll('[role="option"]')].map((n) => n.textContent?.trim());
  expect(items[0]).toBe("Nobody");
  await click(document.querySelector('[role="option"]'));
  expect(onPick).toHaveBeenCalledWith(null);
});

it("has no Nobody item when the row has no referrer", async () => {
  const contact = prospect("n3", "Birch Example");
  const row = toPipelineRow(contact);
  await render(
    <ReferredByPicker
      row={row}
      contacts={[]}
      trigger={<span>Add</span>}
      onPick={vi.fn()}
      onCreate={vi.fn()}
    />,
  );
  await click(byLabel("Add who referred Birch Example"));
  const items = [...document.querySelectorAll('[role="option"]')].map((n) => n.textContent?.trim());
  expect(items).not.toContain("Nobody");
});

const buttonNamed = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const pressEscape = (node: Element) =>
  act(async () => {
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
const leave = (node: Element) =>
  act(async () => {
    node.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  });

it("clears the draft itself, so leaving the empty date does not put the old one back", async () => {
  const contact = prospect("n4", "Cedar Example", { nextCallAt: "2026-11-20" });
  const onSave = vi.fn();
  await render(
    <NextCallEditor row={toPipelineRow(contact)} onSave={onSave}>
      <span>Nov 20</span>
    </NextCallEditor>,
  );
  await click(byLabel("Next call with Cedar Example"));
  await click(buttonNamed("Clear"));
  expect(onSave).toHaveBeenCalledWith(null);
  const date = document.querySelector("#n4-date") as HTMLInputElement;
  expect(date.value).toBe("");
  await leave(date);
  expect(onSave).toHaveBeenCalledTimes(1);
});

it("saves the same value again when the first save failed", async () => {
  const contact = prospect("n5", "Fir Example", { nextCallAt: null });
  const onSave = vi.fn().mockRejectedValueOnce(new Error("offline"));
  await render(
    <NextCallEditor row={toPipelineRow(contact)} onSave={onSave}>
      <span>Set date</span>
    </NextCallEditor>,
  );
  await click(byLabel("Next call with Fir Example"));
  await type(document.querySelector("#n5-date") as HTMLInputElement, "2026-11-12");
  await pressEscape(document.querySelector("#n5-date") as HTMLElement);
  expect(onSave).toHaveBeenCalledTimes(1);
  await click(byLabel("Next call with Fir Example"));
  await type(document.querySelector("#n5-date") as HTMLInputElement, "2026-11-12");
  await pressEscape(document.querySelector("#n5-date") as HTMLElement);
  expect(onSave).toHaveBeenCalledTimes(2);
});

it("saves null when Unknown is chosen", async () => {
  const row = toPipelineRow(
    prospect("u1", "Aster Example", { status: "reached_out", interest: "in" }),
  );
  const onChange = vi.fn();
  await render(<InterestChoice row={row} onChange={onChange} />);
  await click(buttonNamed("Unknown"));
  expect(onChange).toHaveBeenCalledWith(null);
});

it("shows Unknown pressed when the row has no stance yet", async () => {
  const row = toPipelineRow(
    prospect("u2", "Birch Example", { status: "reached_out", interest: null }),
  );
  await render(<InterestChoice row={row} onChange={vi.fn()} />);
  expect(buttonNamed("Unknown")?.getAttribute("aria-pressed")).toBe("true");
  expect(buttonNamed("In")?.getAttribute("aria-pressed")).toBe("false");
});

it("shows no interest control for a row nobody has contacted yet", async () => {
  const row = toPipelineRow(
    prospect("u3", "Cold Example", { status: "not_reached", interest: "in" }),
  );
  await render(
    <>
      <InterestChoice row={row} onChange={vi.fn()} />
      <InterestPick row={row} onChange={vi.fn()} />
    </>,
  );
  expect(el.querySelector("[role=group]")).toBeNull();
  expect(el.querySelector("button")).toBeNull();
});
