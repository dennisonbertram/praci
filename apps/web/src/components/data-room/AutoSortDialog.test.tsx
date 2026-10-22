// @vitest-environment jsdom

import type { AutoSortPlan } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (original) => ({
  ...(await original<typeof import("@rakazo/ui-web")>()),
  enqueueNotificationToast: enqueue,
}));
const autoSort = vi.hoisted(() => ({ plan: vi.fn(), apply: vi.fn(), undo: vi.fn() }));
const recentItems = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { dataRoom: { autoSort, items: { list: recentItems } } },
  selectedSpaceId: () => "s1",
  withSpaceHeaders: () => new Headers(),
}));

import { AutoSortDialog } from "./AutoSortDialog";
import { getUploadToasts, setUploadScope, showSortedToast } from "./upload-toasts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const plan: AutoSortPlan = {
  mode: "ai",
  operations: [
    {
      type: "merge_folder",
      key: "merge:f2",
      folderId: "f2",
      intoFolderId: "f1",
      from: "Benefits (2)",
      into: "Benefits",
    },
    {
      type: "move_item",
      key: "move:i1",
      itemId: "i1",
      name: "plan.pdf",
      fromFolderId: null,
      toPath: ["Benefits", "Health"],
      from: "Unfiled",
      to: "Benefits / Health",
    },
    {
      type: "rename_item",
      key: "rename:i2",
      itemId: "i2",
      fromName: "Screenshot 2026-10-18 at 9.10.50 AM.png",
      toName: "Cap table - Example Co.png",
    },
  ],
};

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

const flush = () => act(async () => void (await Promise.resolve()));
const render = async (onApplied = vi.fn(), onClose = vi.fn(), onOpenModels?: () => void) => {
  act(() =>
    root.render(
      <AutoSortDialog onClose={onClose} onApplied={onApplied} onOpenModels={onOpenModels} />,
    ),
  );
  await flush();
  return { onApplied, onClose };
};
const boxes = () => Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
const button = (name: string) =>
  Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith(name),
  ) as HTMLElement;

it("groups the changes as Merge, Move and Rename, each before and after, all ticked", async () => {
  autoSort.plan.mockResolvedValue(plan);
  await render();
  const headings = Array.from(document.querySelectorAll("h3")).map((h) => h.textContent);
  expect(headings).toEqual(["Merge", "Move", "Rename"]);
  const text = document.body.textContent ?? "";
  expect(text).toContain("Benefits (2) → Benefits");
  expect(text).toContain("Unfiled → Benefits / Health");
  expect(text).toContain("Screenshot 2026-10-18 at 9.10.50 AM.png");
  expect(text).toContain("→ Cap table - Example Co.png");
  expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual([
    "true",
    "true",
    "true",
    "true",
  ]);
});

it("applies only the ticked changes", async () => {
  autoSort.plan.mockResolvedValue(plan);
  autoSort.apply.mockResolvedValue({ batchId: "b1", items: 2, skipped: 0 });
  const { onApplied, onClose } = await render();
  act(() => boxes()[3]?.click());
  act(() => button("Apply").click());
  await flush();
  expect(autoSort.apply).toHaveBeenCalledWith({ operations: plan.operations.slice(0, 2) });
  expect(onApplied).toHaveBeenCalledWith({ batchId: "b1", items: 2, skipped: 0 });
  expect(onClose).toHaveBeenCalled();
});

it("says Already tidy. when there is nothing to change, and shows an error with Retry", async () => {
  autoSort.plan.mockResolvedValueOnce({ mode: "basic", operations: [] });
  await render();
  expect(document.body.textContent).toContain("Already tidy.");
  expect(button("Apply")).toBeUndefined();

  autoSort.plan.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(plan);
  act(() => root.unmount());
  root = createRoot(container);
  await render();
  expect(button("Retry")).toBeTruthy();
  act(() => button("Retry").click());
  await flush();
  expect(boxes()).toHaveLength(4);
});

it("shows Sorted N items after applying, and Undo reverses that batch", async () => {
  setUploadScope("u1");
  autoSort.undo.mockResolvedValue({ restored: 2, skipped: 1 });
  showSortedToast(3, "b1");
  const toast = getUploadToasts().at(-1);
  expect(toast?.state).toMatchObject({ kind: "sorted", count: 3 });
  if (toast?.state.kind === "sorted") toast.state.undo();
  await flush();
  expect(autoSort.undo).toHaveBeenCalledWith({ batchId: "b1" });
  expect(getUploadToasts().some((t) => t.id === toast?.id)).toBe(false);
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ title: "Undid 2, skipped 1" }));
});

it("does not call a plan with no model 'Already tidy.', and offers Retry", async () => {
  autoSort.plan.mockResolvedValue({ mode: "basic", reason: "ai_failed", operations: [] });
  await render();
  expect(document.body.textContent).not.toContain("Already tidy.");
  expect(document.body.textContent).toContain("The model could not sort your files.");
  expect(button("Retry")).toBeTruthy();
  expect(button("Apply")).toBeUndefined();
});

it("names a rejected key and opens the Models settings from the dialog", async () => {
  autoSort.plan.mockResolvedValue({ mode: "basic", reason: "ai_rejected", operations: [] });
  const openModels = vi.fn();
  const { onClose } = await render(vi.fn(), vi.fn(), openModels);
  expect(document.body.textContent).toContain("The model provider did not accept your API key.");
  expect(button("Apply")).toBeUndefined();
  act(() => button("Open Models settings").click());
  expect(openModels).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalled();
});

const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }) as MediaQueryList);

it("names its scope while the plan is made, and Apply waits", async () => {
  motion(false);
  autoSort.plan.mockReturnValue(new Promise(() => undefined));
  await render();
  expect(document.body.textContent).toContain("Looking for changes");
  expect(button("Apply").hasAttribute("disabled")).toBe(true);
});

it("Select all ticks the whole plan, so applying it takes two clicks", async () => {
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [
      { ...plan.operations[1], key: "m1", fromFolderId: "f9" },
      { ...plan.operations[1], key: "m2", itemId: "i3", fromFolderId: "f9" },
    ],
  });
  await render();
  expect(button("Apply").textContent).toBe("Apply");
  act(() => document.querySelector<HTMLElement>('[role="checkbox"]')?.click());
  expect(button("Apply").textContent).toBe("Apply 2 changes");
});

it("shows one Select all when there are several changes", async () => {
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [
      { ...plan.operations[1], key: "m1", fromFolderId: "f9" },
      { ...plan.operations[1], key: "m2", itemId: "i3", fromFolderId: "f9" },
    ],
  });
  await render();
  expect(document.body.textContent?.match(/Select all/g)).toHaveLength(1);
});

it("says what to do when no change is ticked, instead of Apply 0 changes", async () => {
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [{ ...plan.operations[1], fromFolderId: "f9" }],
  });
  await render();
  expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["false"]);
  expect(button("Apply").textContent).toBe("Apply");
  expect(button("Apply").hasAttribute("disabled")).toBe(true);
  // A visible Select all next to Apply, instead of a hint to find the checkbox.
  act(() => button("Select all").click());
  expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["true"]);
  expect(button("Apply").textContent).toBe("Apply 1 change");
});

it("leaves files already in a folder unticked and groups moves by destination", async () => {
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [
      { ...plan.operations[1] },
      { ...plan.operations[1], key: "move:i3", itemId: "i3", name: "in.pdf", fromFolderId: "f9" },
    ],
  });
  act(() => root.render(<AutoSortDialog onClose={() => undefined} onApplied={() => undefined} />));
  await flush();
  await flush();
  act(() => button("Show all").click());
  const boxes = Array.from(document.querySelectorAll('[role="checkbox"]'));
  expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
  expect(document.querySelectorAll("h4")).toHaveLength(1);
  expect(button("Apply").textContent).toBe("Apply 1 change");
});

it("opens on the recently added files, all ticked, and Show all adds the rest unticked", async () => {
  recentItems.mockResolvedValue({
    items: [{ id: "i3", createdAt: new Date().toISOString() }],
    nextCursor: null,
  });
  const filed = { ...plan.operations[1], fromFolderId: "f9" };
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [
      { ...filed, key: "move:i3", itemId: "i3", name: "new.pdf" },
      { ...filed, key: "move:i4", itemId: "i4", name: "old.pdf" },
    ],
  });
  act(() => root.render(<AutoSortDialog onClose={() => undefined} onApplied={() => undefined} />));
  await flush();
  await flush();
  expect(document.body.textContent).toContain("new.pdf");
  expect(document.body.textContent).not.toContain("old.pdf");
  expect(button("Apply").textContent).toBe("Apply 1 change");
  act(() => button("Show all").click());
  expect(document.body.textContent).toContain("old.pdf");
  expect(button("Apply").textContent).toBe("Apply 1 change");
});

it("says it is still looking after 10 seconds without a plan", async () => {
  vi.useFakeTimers();
  try {
    autoSort.plan.mockReturnValue(new Promise(() => undefined));
    await render();
    expect(document.body.textContent).toContain("Looking for changes");
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(document.body.textContent).toContain("Still looking. This can take a minute.");
  } finally {
    vi.useRealTimers();
  }
});
