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
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpc = vi.hoisted(() => ({
  folderCreate: vi.fn(),
  itemMove: vi.fn(),
  folderMove: vi.fn(),
  folderDelete: vi.fn(),
  itemDelete: vi.fn(),
}));
const legal = vi.hoisted(() => ({ itemLinks: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: rpc, legal } }));

import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import { folderNodes } from "./folders";
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
  legal.itemLinks.mockResolvedValue({ contractTitle: null, deadlines: 0 });
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

it("closes every item dialog with Cancel only, like the Delete confirmation", async () => {
  for (const action of ["move", "rename", "delete"] as const) {
    await act(async () =>
      root.render(
        <ItemDialog action={action} item={item} folders={[]} onClose={vi.fn()} onDone={vi.fn()} />,
      ),
    );
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();
    const buttons = Array.from(
      document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button'),
    );
    expect(buttons.map((b) => b.textContent)).toContain("Cancel");
  }
});

const folder = (id: string, name: string, parentId: string | null) => ({
  id,
  name,
  parentId,
  createdAt: "2026-10-01T00:00:00.000Z",
});

it("moves a folder anywhere but into itself or a folder under it", async () => {
  const finance = folder("f1", "Finance", null);
  const tree = folderNodes([
    finance,
    folder("f2", "Invoices", "f1"),
    folder("f3", "2026", "f2"),
    folder("f4", "Legal", null),
  ]);
  rpc.folderMove.mockResolvedValue({ ...finance, parentId: "f4" });
  const onDone = vi.fn();
  await act(async () =>
    root.render(
      <ItemDialog action="move" item={finance} folders={tree} onClose={vi.fn()} onDone={onDone} />,
    ),
  );
  const select = document.querySelector<HTMLSelectElement>('select[name="folder"]');
  if (!select) throw new Error("no folder select");
  expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
    "Top level",
    "Legal",
    "New folder…",
  ]);
  await act(async () => setValue(select, "f4"));
  await act(async () => select.form?.requestSubmit());
  expect(rpc.folderMove).toHaveBeenCalledExactlyOnceWith({ id: "f1", parentId: "f4" });
  expect(rpc.itemMove).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalledWith("move", { ...finance, parentId: "f4" });
});

it("says to empty a folder first when the server refuses to delete it", async () => {
  rpc.folderDelete.mockRejectedValue(new Error("Folder is not empty"));
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      <ItemDialog
        action="delete"
        item={folder("f1", "Finance", null)}
        folders={[]}
        onClose={onClose}
        onDone={vi.fn()}
      />,
    ),
  );
  expect(document.body.textContent).toContain("Delete the folder Finance?");
  const confirm = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button'),
  ).find((button) => button.textContent === "Delete");
  await act(async () => confirm?.click());
  expect(rpc.folderDelete).toHaveBeenCalledExactlyOnceWith({ id: "f1" });
  expect(document.body.textContent).toContain("Move or delete what is in this folder first.");
  expect(onClose).not.toHaveBeenCalled();
});

const flushAll = () => act(async () => {});
const dialogText = () => document.body.textContent ?? "";

it("says the file's Legal contract and its deadlines go with it", async () => {
  legal.itemLinks.mockResolvedValue({ contractTitle: "MOCK Office Lease", deadlines: 2 });
  await act(async () =>
    root.render(
      <ItemDialog action="delete" item={item} folders={[]} onClose={() => {}} onDone={() => {}} />,
    ),
  );
  await flushAll();
  expect(legal.itemLinks).toHaveBeenCalledWith({ itemId: "i1" });
  expect(dialogText()).toContain(
    "This also removes the Legal contract MOCK Office Lease, its 2 deadlines (including ones added by hand)",
  );
});

it("keeps the plain warning when Legal has nothing for the file or cannot be asked", async () => {
  legal.itemLinks.mockRejectedValue(new Error("offline"));
  await act(async () =>
    root.render(
      <ItemDialog action="delete" item={item} folders={[]} onClose={() => {}} onDone={() => {}} />,
    ),
  );
  await flushAll();
  expect(dialogText()).toContain("This can't be undone.");
  expect(dialogText()).not.toContain("Legal contract");
});

it.each([
  [2, "This also removes the Legal contract"],
  [0, "This also removes the Legal contract"],
])(
  "masks a currency amount in the contract title while amounts are hidden (%i deadlines)",
  async (deadlines, lead) => {
    setHideAmounts(true);
    try {
      legal.itemLinks.mockResolvedValue({ contractTitle: "Lease — $12,500 deposit", deadlines });
      await act(async () =>
        root.render(
          <ItemDialog
            action="delete"
            item={item}
            folders={[]}
            onClose={() => {}}
            onDone={() => {}}
          />,
        ),
      );
      await flushAll();
      expect(dialogText()).toContain(lead);
      expect(dialogText()).not.toContain("12,500");
    } finally {
      setHideAmounts(false);
      resetHideAmountsMemory();
    }
  },
);
