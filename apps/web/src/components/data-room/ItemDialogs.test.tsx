// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const investors = vi.hoisted(() => ({ shares: vi.fn(), share: vi.fn(), unshare: vi.fn() }));
const contacts = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: rpc, legal, investors, contacts } }));

const notice = vi.hoisted(() => vi.fn());
const scopeToken = vi.hoisted(() => vi.fn(() => 7));
vi.mock("./upload-toasts", () => ({ showNoticeToast: notice, uploadScopeToken: scopeToken }));

import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import { folderNodes } from "./folders";
import { ItemDialog, MoveFilesDialog, ShareFilesDialog } from "./ItemDialogs";

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
  expect(rpc.folderCreate).toHaveBeenCalledExactlyOnceWith({ name: "Legal", parentId: null });
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
    "All items",
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

it("creates the new folder inside the item's current folder unless another is chosen", async () => {
  const folders = folderNodes([
    { id: "f-product", name: "Product", parentId: null, createdAt: "" },
    { id: "f-legal", name: "Legal", parentId: null, createdAt: "" },
  ]);
  rpc.folderCreate.mockResolvedValue({ id: "f-new", name: "Roadmaps", parentId: "f-product" });
  rpc.itemMove.mockResolvedValue({ ...item, folderId: "f-new" });
  await act(async () =>
    root.render(
      <ItemDialog
        action="move"
        item={{ ...item, folderId: "f-product" }}
        folders={folders}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    ),
  );
  const select = document.querySelector<HTMLSelectElement>('select[name="folder"]');
  if (!select) throw new Error("no folder select");
  await act(async () => setValue(select, "__new__"));
  const parent = document.querySelector<HTMLSelectElement>('select[name="parent"]');
  expect(parent?.value).toBe("f-product");
  const name = document.querySelector<HTMLInputElement>('input[name="folderName"]');
  if (!name) throw new Error("no folder name field");
  await act(async () => setValue(name, "Roadmaps"));
  await act(async () => name.form?.requestSubmit());
  expect(rpc.folderCreate).toHaveBeenCalledExactlyOnceWith({
    name: "Roadmaps",
    parentId: "f-product",
  });
});

it("selects the name without its extension when renaming", async () => {
  await act(async () =>
    root.render(
      <ItemDialog action="rename" item={item} folders={[]} onClose={vi.fn()} onDone={vi.fn()} />,
    ),
  );
  const name = document.querySelector<HTMLInputElement>('input[name="name"]');
  expect([name?.selectionStart, name?.selectionEnd]).toEqual([0, "Lease".length]);
});

it("says up front that a folder with files cannot be deleted, and offers to open it instead", async () => {
  const hr = { id: "f-hr", name: "HR", parentId: null, createdAt: "", itemCount: 3 };
  const onOpenFolder = vi.fn();
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      <ItemDialog
        action="delete"
        item={hr}
        folders={folderNodes([hr])}
        onClose={onClose}
        onDone={vi.fn()}
        onOpenFolder={onOpenFolder}
      />,
    ),
  );
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("It holds 3 items");
  const buttons = Array.from(dialog?.querySelectorAll("button") ?? []);
  expect(buttons.map((b) => b.textContent)).toEqual(["Cancel", "Open folder"]);
  await act(async () => buttons[1]?.click());
  expect(onOpenFolder).toHaveBeenCalledWith("f-hr");
  expect(onClose).toHaveBeenCalled();
  expect(rpc.folderDelete).not.toHaveBeenCalled();
});

it("still deletes an empty folder after a confirmation", async () => {
  const old = { id: "f-old", name: "Old", parentId: null, createdAt: "", itemCount: 0 };
  rpc.folderDelete.mockResolvedValue({ ok: true });
  await act(async () =>
    root.render(
      <ItemDialog
        action="delete"
        item={old}
        folders={folderNodes([old])}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    ),
  );
  const remove = Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(
    (b) => b.textContent === "Delete",
  ) as HTMLButtonElement;
  await act(async () => remove.click());
  expect(rpc.folderDelete).toHaveBeenCalledWith({ id: "f-old" });
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

describe("Share with investors", () => {
  const investor = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    email: `${name.toLowerCase()}@example.test`,
    kind: "investor",
    ...extra,
  });
  const dialog = () => document.querySelector('[role="dialog"]');
  const named = (label: string) =>
    [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);
  const open = async () => {
    await act(async () =>
      root.render(
        <ItemDialog
          action="share"
          item={item}
          folders={folderNodes([])}
          onClose={onClose}
          onDone={() => {}}
        />,
      ),
    );
    await act(async () => {});
  };
  const onClose = vi.fn();

  beforeEach(() => {
    contacts.list.mockResolvedValue([
      investor("c1", "Ada"),
      investor("c2", "Bo"),
      investor("c3", "Cy", { portalBlockedAt: "2026-10-01T00:00:00.000Z" }),
    ]);
    investors.shares.mockResolvedValue(["c1"]);
  });

  it("lists investors: Unshare for those who have the file, a checkbox for the others", async () => {
    await open();
    expect(contacts.list).toHaveBeenCalledWith({ kind: "investor" });
    expect(investors.shares).toHaveBeenCalledWith({ itemId: "i1" });
    expect(dialog()?.textContent).toContain("Share Lease.pdf");
    expect(named("Unshare")).toBeDefined();
    expect(dialog()?.textContent).toContain("Ada");
    expect(document.getElementById("share-c2")).not.toBeNull();
    expect(document.getElementById("share-c1")).toBeNull();
    // A revoked investor cannot be given a file.
    expect(document.getElementById("share-c3")).toBeNull();
    expect(named("Share")?.hasAttribute("disabled")).toBe(true);
  });

  it("Share gives the ticked investors the file and emails a link by default", async () => {
    investors.share.mockResolvedValue({ links: [] });
    await open();
    await act(async () => document.getElementById("share-c2")?.click());
    expect(named("Share")?.hasAttribute("disabled")).toBe(false);
    expect(dialog()?.textContent).toContain("Email them a link");
    await act(async () => named("Share")?.click());
    expect(investors.share).toHaveBeenCalledWith({
      itemId: "i1",
      contactIds: ["c2"],
      emailLink: true,
    });
    expect(onClose).toHaveBeenCalled();
    // The dialog closes, so a toast naming who got the file is the only confirmation.
    expect(notice).toHaveBeenCalledWith("Shared Lease.pdf with Bo", 7);
  });

  it("ticks 'Email them a link' on open, and unticking it shares without emailing", async () => {
    investors.share.mockResolvedValue({ links: [] });
    await open();
    const box = () => document.getElementById("share-email-link") as HTMLInputElement | null;
    expect(box()?.checked).toBe(true);
    await act(async () => document.getElementById("share-c2")?.click());
    await act(async () => box()?.click());
    expect(box()?.checked).toBe(false);
    await act(async () => named("Share")?.click());
    expect(investors.share).toHaveBeenCalledWith({
      itemId: "i1",
      contactIds: ["c2"],
      emailLink: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the links when they could not be emailed", async () => {
    investors.share.mockResolvedValue({
      links: [{ contactId: "c2", name: "Bo", link: "https://app.example.test/portal/open#t" }],
    });
    await open();
    await act(async () => document.getElementById("share-c2")?.click());
    await act(async () => named("Share")?.click());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>("input[readonly]")?.value).toBe(
      "https://app.example.test/portal/open#t",
    );
  });

  it("Unshare takes the file away from that investor and offers the checkbox again", async () => {
    investors.unshare.mockResolvedValue({ ok: true });
    await open();
    await act(async () => named("Unshare")?.click());
    expect(investors.unshare).toHaveBeenCalledWith({ itemId: "i1", contactId: "c1" });
    expect(document.getElementById("share-c1")).not.toBeNull();
    expect(named("Unshare")).toBeUndefined();
  });

  it("says so when there are no investors", async () => {
    contacts.list.mockResolvedValue([]);
    investors.shares.mockResolvedValue([]);
    await open();
    expect(dialog()?.textContent).toContain("No investors yet");
  });
});

describe("Share files with investors (batch)", () => {
  const investor = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    email: `${name.toLowerCase()}@example.test`,
    kind: "investor",
    ...extra,
  });
  const files = [
    { ...item, id: "i1", name: "One.pdf" },
    { ...item, id: "i2", name: "Two.pdf" },
    { ...item, id: "i3", name: "Three.pdf" },
  ] as DataRoomApiItem[];
  const dialog = () => document.querySelector('[role="dialog"]');
  const named = (label: string) =>
    [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);
  const onClose = vi.fn();
  const open = async (onDone = vi.fn()) => {
    await act(async () =>
      root.render(<ShareFilesDialog items={files} onClose={onClose} onDone={onDone} />),
    );
    await act(async () => {});
    return onDone;
  };

  beforeEach(() => {
    contacts.list.mockResolvedValue([
      investor("c1", "Ada"),
      investor("c2", "Bo"),
      investor("c3", "Cy", { portalBlockedAt: "2026-10-01T00:00:00.000Z" }),
    ]);
  });

  it("titles the count and offers a checkbox for every unrevoked investor, with no Unshare", async () => {
    await open();
    expect(contacts.list).toHaveBeenCalledWith({ kind: "investor" });
    // A batch cannot list who has what, so there is no per-file shares read and no Unshare.
    expect(investors.shares).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain("Share 3 files");
    expect(document.getElementById("share-c1")).not.toBeNull();
    expect(document.getElementById("share-c2")).not.toBeNull();
    expect(document.getElementById("share-c3")).toBeNull();
    expect(named("Unshare")).toBeUndefined();
  });

  it("makes one share call for the whole batch and reports what it shared", async () => {
    investors.share.mockResolvedValue({
      links: [],
      items: files.map((f) => ({ itemId: f.id, shared: true })),
    });
    const onDone = await open();
    await act(async () => document.getElementById("share-c2")?.click());
    await act(async () => named("Share")?.click());
    expect(investors.share).toHaveBeenCalledTimes(1);
    expect(investors.share).toHaveBeenCalledWith({
      itemIds: ["i1", "i2", "i3"],
      contactIds: ["c2"],
      emailLink: true,
    });
    expect(onDone).toHaveBeenCalledWith({ shared: ["i1", "i2", "i3"], failed: [] });
    expect(onClose).toHaveBeenCalled();
    expect(notice).toHaveBeenCalledWith("Shared 3 files with Bo", 7);
  });

  it("reports the files that failed, so they can stay ticked for a retry", async () => {
    investors.share.mockResolvedValue({
      links: [],
      items: [
        { itemId: "i1", shared: true },
        { itemId: "i2", shared: false },
        { itemId: "i3", shared: true },
      ],
    });
    const onDone = await open();
    await act(async () => document.getElementById("share-c2")?.click());
    await act(async () => named("Share")?.click());
    expect(onDone).toHaveBeenCalledWith({ shared: ["i1", "i3"], failed: ["i2"] });
    expect(notice).toHaveBeenCalledWith("Couldn't share 1 file", 7);
  });

  it("treats an answer without per-file results as fully shared", async () => {
    investors.share.mockResolvedValue({ links: [] });
    const onDone = await open();
    await act(async () => document.getElementById("share-c1")?.click());
    await act(async () => named("Share")?.click());
    expect(onDone).toHaveBeenCalledWith({ shared: ["i1", "i2", "i3"], failed: [] });
  });
});

describe("MoveFilesDialog", () => {
  const file = (id: string, folderId: string | null) =>
    ({ ...item, id, name: `${id}.pdf`, folderId }) as DataRoomApiItem;
  const nodes = folderNodes([
    { id: "fa", name: "A", parentId: null },
    { id: "fb", name: "B", parentId: null },
  ] as never);
  const select = () => {
    const el = document.querySelector<HTMLSelectElement>('select[name="folder"]');
    if (!el) throw new Error("no folder select");
    return el;
  };
  const save = () =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Save",
    ) as HTMLButtonElement;

  it("skips files already in the target and reports the ones that fail", async () => {
    rpc.itemMove.mockImplementation(async ({ id }: { id: string }) => {
      if (id === "b") throw new Error("gone");
      return file(id, "fb");
    });
    const onDone = vi.fn();
    const onClose = vi.fn();
    const items = [file("a", "fa"), file("b", "fa"), file("c", "fb")];
    await act(async () =>
      root.render(
        <MoveFilesDialog items={items} folders={nodes} onClose={onClose} onDone={onDone} />,
      ),
    );
    expect(document.body.textContent).toContain("Move 3 files to");
    await act(async () => setValue(select(), "fb"));
    await act(async () => select().form?.requestSubmit());
    expect(rpc.itemMove).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith({ moved: ["a"], failed: ["b"], folderId: "fb" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps Save disabled for files from different folders until a folder is chosen", async () => {
    await act(async () =>
      root.render(
        <MoveFilesDialog
          items={[file("a", "fa"), file("b", "fb")]}
          folders={nodes}
          onClose={vi.fn()}
          onDone={vi.fn()}
        />,
      ),
    );
    expect(select().value).toBe("__choose__");
    expect(save().disabled).toBe(true);
    await act(async () => setValue(select(), ""));
    expect(save().disabled).toBe(false);
  });

  it("counts a move that never answers as failed, so the dialog can finish", async () => {
    vi.useFakeTimers();
    try {
      rpc.itemMove.mockImplementation(() => new Promise(() => {}));
      const onDone = vi.fn();
      const onClose = vi.fn();
      await act(async () =>
        root.render(
          <MoveFilesDialog
            items={[file("a", "fa")]}
            folders={nodes}
            onClose={onClose}
            onDone={onDone}
          />,
        ),
      );
      await act(async () => setValue(select(), "fb"));
      await act(async () => select().form?.requestSubmit());
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ moved: [], failed: ["a"] }));
      expect(onClose).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows progress and stays open until every file has moved", async () => {
    const pending: Array<(value: DataRoomApiItem) => void> = [];
    rpc.itemMove.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve as (value: DataRoomApiItem) => void)),
    );
    const onDone = vi.fn();
    const onClose = vi.fn();
    await act(async () =>
      root.render(
        <MoveFilesDialog
          items={[file("a", "fa"), file("b", "fa"), file("c", "fb")]}
          folders={nodes}
          onClose={onClose}
          onDone={onDone}
        />,
      ),
    );
    await act(async () => setValue(select(), "fb"));
    await act(async () => select().form?.requestSubmit());

    const dialog = document.querySelector('[role="dialog"]');
    const cancel = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Cancel",
    ) as HTMLButtonElement | undefined;
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("0 of 2");
    expect(cancel?.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(rpc.itemMove).toHaveBeenCalledTimes(2);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialog?.isConnected).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => pending[0]?.(file("a", "fa")));
    expect(dialog?.textContent).toContain("1 of 2");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      pending[1]?.(file("b", "fb"));
    });
    expect(onDone).toHaveBeenCalledWith({ moved: ["a", "b"], failed: [], folderId: "fb" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preselects the shared folder and creates a new folder once", async () => {
    rpc.folderCreate.mockResolvedValue({ id: "f-new", name: "N", parentId: null });
    rpc.itemMove.mockImplementation(async ({ id }: { id: string }) => file(id, "f-new"));
    const onDone = vi.fn();
    await act(async () =>
      root.render(
        <MoveFilesDialog
          items={[file("a", "fa"), file("b", "fa")]}
          folders={nodes}
          onClose={vi.fn()}
          onDone={onDone}
        />,
      ),
    );
    expect(select().value).toBe("fa");
    await act(async () => setValue(select(), "__new__"));
    const name = document.querySelector<HTMLInputElement>('input[name="folderName"]');
    if (!name) throw new Error("no folder name field");
    await act(async () => setValue(name, "N"));
    await act(async () => name.form?.requestSubmit());
    expect(rpc.folderCreate).toHaveBeenCalledTimes(1);
    expect(rpc.itemMove).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith({ moved: ["a", "b"], failed: [], folderId: "f-new" });
  });
});
