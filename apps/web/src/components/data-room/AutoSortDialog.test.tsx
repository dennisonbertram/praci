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
const autoSort = vi.hoisted(() => ({ plan: vi.fn(), apply: vi.fn(), undo: vi.fn() }));
vi.mock("../../lib/rpc", () => ({
  rpc: { dataRoom: { autoSort } },
  selectedSpaceId: () => "s1",
  withSpaceHeaders: () => new Headers(),
}));

import type { AutoSortFile } from "./AutoSortDialog";
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
const render = async (
  onApplied = vi.fn(),
  onClose = vi.fn(),
  files: AutoSortFile[] = [],
  onOpenModels?: () => void,
) => {
  act(() =>
    root.render(
      <AutoSortDialog
        files={files}
        onClose={onClose}
        onApplied={onApplied}
        onOpenModels={onOpenModels}
      />,
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
  expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "true", "true"]);
});

it("applies only the ticked changes", async () => {
  autoSort.plan.mockResolvedValue(plan);
  autoSort.apply.mockResolvedValue({ batchId: "b1", items: 2, skipped: 0 });
  const { onApplied, onClose } = await render();
  act(() => boxes()[2]?.click());
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
  expect(boxes()).toHaveLength(3);
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
  expect(getUploadToasts().map((t) => t.name)).toContain("Undid 2, skipped 1");
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
  const { onClose } = await render(vi.fn(), vi.fn(), [], openModels);
  expect(document.body.textContent).toContain("The model provider did not accept your API key.");
  expect(button("Apply")).toBeUndefined();
  act(() => button("Open Models settings").click());
  expect(openModels).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalled();
});

const names = ["plan.pdf", "Screenshot 2026-10-18 at 9.10.50 AM.png", "notes.txt"];
const files = names.map((name, n) => ({ id: `i${n + 1}`, name }));
const items = () => Array.from(document.querySelectorAll("li")).map((li) => li.textContent);
const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }) as MediaQueryList);

it("lists the files being reviewed while the plan is made, and Apply waits", async () => {
  motion(false);
  autoSort.plan.mockReturnValue(new Promise(() => undefined));
  await render(vi.fn(), vi.fn(), files);
  expect(document.body.textContent).toContain("Reviewing 3 files");
  expect(items()).toEqual(names);
  expect(button("Apply").hasAttribute("disabled")).toBe(true);
});

it("goes straight from the file list to the review, with no per-file No change rows", async () => {
  motion(false);
  autoSort.plan.mockResolvedValue(plan);
  await render(vi.fn(), vi.fn(), files);
  expect(items()).toEqual([]);
  expect(document.body.textContent).not.toContain("No change");
  expect(boxes()).toHaveLength(3);
  expect(button("Apply").hasAttribute("disabled")).toBe(false);
});

it("says what to do when no change is ticked, instead of Apply 0 changes", async () => {
  autoSort.plan.mockResolvedValue({
    mode: "ai",
    operations: [{ ...plan.operations[1], fromFolderId: "f9" }],
  });
  await render();
  expect(boxes().map((b) => b.getAttribute("aria-checked"))).toEqual(["false"]);
  expect(document.body.textContent).toContain("Tick a change to apply it.");
  expect(button("Apply").textContent).toBe("Apply");
  expect(button("Apply").hasAttribute("disabled")).toBe(true);
});

it("lists at most 300 files and counts the rest", async () => {
  motion(false);
  autoSort.plan.mockReturnValue(new Promise(() => undefined));
  const many = Array.from({ length: 305 }, (_, n) => ({ id: `m${n}`, name: `file ${n}.pdf` }));
  await render(vi.fn(), vi.fn(), many);
  expect(items()).toHaveLength(301);
  expect(items().at(-1)).toBe("+5 more");
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
  const boxes = Array.from(document.querySelectorAll('[role="checkbox"]'));
  expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  expect(document.querySelectorAll("h4")).toHaveLength(1);
  expect(button("Apply").textContent).toBe("Apply 1 change");
});
