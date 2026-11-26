// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
const rpcMock = vi.hoisted(() => ({
  equity: {
    stakeholders: { list: vi.fn() },
    convertibleBlocks: { list: vi.fn(), create: vi.fn() },
    convertibles: { create: vi.fn() },
  },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: rpcMock }));

import { ConvertibleForm } from "./ConvertibleForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  rpcMock.equity.stakeholders.list
    .mockReset()
    .mockResolvedValue({ items: [{ id: "sh-1", name: "Ada Example" }] });
  rpcMock.equity.convertibleBlocks.list.mockReset().mockResolvedValue([]);
  rpcMock.equity.convertibleBlocks.create
    .mockReset()
    .mockResolvedValue({ id: "cb-new", name: "Seed", kind: "safe" });
  rpcMock.equity.convertibles.create.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const fill = async (id: string, value: string) => {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
};
const press = async (label: string) => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
  await act(async () => button.click());
};

it("retries new terms and the convertible with the keys of the first attempt", async () => {
  rpcMock.equity.convertibles.create
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce({ id: "c1" });
  const onSaved = vi.fn();
  await act(async () =>
    root.render(<ConvertibleForm convertible={null} onOpenChange={vi.fn()} onSaved={onSaved} />),
  );
  await fill("convertible-stakeholder", "sh-1");
  await fill("convertible-block", "__new");
  await fill("convertible-block-name", "Seed");
  await fill("convertible-amount", "1000");
  await press("Review");
  await press("Save");
  expect(onSaved).not.toHaveBeenCalled();
  await press("Save");
  expect(onSaved).toHaveBeenCalledTimes(1);

  const [first, second] = rpcMock.equity.convertibleBlocks.create.mock.calls.map(([arg]) => arg);
  expect(first.requestKey).toEqual(expect.any(String));
  expect(second.requestKey).toBe(first.requestKey);
  const [firstCreate, secondCreate] = rpcMock.equity.convertibles.create.mock.calls.map(
    ([arg]) => arg,
  );
  expect(firstCreate.requestKey).toEqual(expect.any(String));
  expect(secondCreate.requestKey).toBe(firstCreate.requestKey);
  expect(firstCreate.requestKey).not.toBe(first.requestKey);
  expect(secondCreate.blockId).toBe("cb-new");
});
