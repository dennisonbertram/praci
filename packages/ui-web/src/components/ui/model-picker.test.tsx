// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModelPicker } from "./model-picker.js";

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();
const defaults = {
  label: "Model",
  searchLabel: "Search models",
  emptyLabel: "No matching models",
  loadingLabel: "Loading models…",
  value: "two::second-id",
  onChange,
  options: [
    {
      value: "one::first-id",
      id: "first-id",
      label: "First model",
      provider: "one",
      providerName: "One cloud",
    },
    {
      value: "two::second-id",
      id: "second-id",
      label: "Second model",
      provider: "two",
      providerName: "Two cloud",
    },
    {
      value: "one::third-id",
      id: "third-id",
      label: "Third model",
      provider: "one",
      providerName: "One cloud",
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  onChange.mockReset();
});

async function open(props: Partial<ComponentProps<typeof ModelPicker>> = {}) {
  await act(async () => root.render(<ModelPicker {...defaults} {...props} />));
  const trigger = container.querySelector<HTMLButtonElement>("button")!;
  await act(async () => trigger.click());
  return trigger;
}

function optionLabels() {
  return [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent);
}

async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function key(key: string) {
  await act(async () => {
    document
      .querySelector("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

it("puts the current model first, then groups the others without duplicate options", async () => {
  await open();
  expect(optionLabels()).toEqual(["Second model", "First model", "Third model"]);
  expect(document.querySelector("[cmdk-group-heading]")?.textContent).toBe("One cloud");
});

it("filters by name, provider name and id without retaining an unrelated current option", async () => {
  await open();
  await search(" THIRD ");
  expect(optionLabels()).toEqual(["Third model"]);
  await search("One cloud");
  expect(optionLabels()).toEqual(["First model", "Third model"]);
  await search("second-id");
  expect(optionLabels()).toEqual(["Second model"]);
  await search("not found");
  expect(optionLabels()).toEqual([]);
  expect(document.body.textContent).toContain("No matching models");
});

it("navigates by keyboard and returns the unchanged stored key", async () => {
  const trigger = await open();
  await key("ArrowDown");
  await key("Enter");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("one::first-id");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("keeps unlisted current values and supports the empty default value", async () => {
  await open({ value: "retired::id", options: [{ value: "", label: "Space default" }] });
  expect(optionLabels()).toEqual(["retired::id", "Space default"]);
  await key("ArrowDown");
  await key("Enter");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("");
});

it("shows loading without selectable options", async () => {
  await open({ loading: true });
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Loading models…");
  expect(optionLabels()).toEqual([]);
  await key("Enter");
  expect(onChange).not.toHaveBeenCalled();
});

it("only permits a custom id when explicitly enabled for freeform model settings", async () => {
  await open({ options: [], value: "", allowCustom: true });
  await search(" sample/embedding-v2 ");
  expect(optionLabels()).toEqual(["sample/embedding-v2"]);
  await key("Enter");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("sample/embedding-v2");
});
