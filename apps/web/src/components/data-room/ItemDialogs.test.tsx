// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpc = vi.hoisted(() => ({ folderCreate: vi.fn(), itemMove: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: rpc } }));

import { ItemDialog } from "./ItemDialogs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  id: "i1",
  name: "Lease.pdf",
  folderId: null,
} as DataRoomApiItem;

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
  vi.clearAllMocks();
});

const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
};

it("moves an item into a folder it creates on the spot", async () => {
  rpc.folderCreate.mockResolvedValue({ id: "f-new", name: "Legal", parentId: null });
  rpc.itemMove.mockResolvedValue({ ...item, folderId: "f-new" });
  const onDone = vi.fn();
  await act(async () =>
    root.render(
      <ItemDialog action="move" item={item} folders={[]} onClose={vi.fn()} onDone={onDone} />,
    ),
  );
  expect(document.body.textContent).toContain("Move Lease.pdf to");
  const select = document.querySelector<HTMLSelectElement>('select[name="folder"]');
  if (!select) throw new Error("no folder select");
  await act(async () => setValue(select, "__new__"));
  const name = document.querySelector<HTMLInputElement>('input[name="folderName"]');
  if (!name) throw new Error("no folder name field");
  await act(async () => setValue(name, "Legal"));
  await act(async () => name.form?.requestSubmit());
  expect(rpc.folderCreate).toHaveBeenCalledExactlyOnceWith({ name: "Legal" });
  expect(rpc.itemMove).toHaveBeenCalledExactlyOnceWith({ id: "i1", folderId: "f-new" });
  expect(onDone).toHaveBeenCalledWith("move", { ...item, folderId: "f-new" });
});

it("refuses a new folder name with a slash and marks the field", async () => {
  await act(async () =>
    root.render(
      <ItemDialog action="move" item={item} folders={[]} onClose={vi.fn()} onDone={vi.fn()} />,
    ),
  );
  const select = document.querySelector<HTMLSelectElement>('select[name="folder"]');
  if (!select) throw new Error("no folder select");
  await act(async () => setValue(select, "__new__"));
  const name = document.querySelector<HTMLInputElement>('input[name="folderName"]');
  if (!name) throw new Error("no folder name field");
  await act(async () => setValue(name, "a/b"));
  await act(async () => name.form?.requestSubmit());
  expect(rpc.folderCreate).not.toHaveBeenCalled();
  expect(name.getAttribute("aria-invalid")).toBe("true");
});
