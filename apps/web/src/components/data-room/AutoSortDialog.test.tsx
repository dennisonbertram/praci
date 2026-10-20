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
const render = async (onApplied = vi.fn(), onClose = vi.fn(), files: AutoSortFile[] = []) => {
  act(() => root.render(<AutoSortDialog files={files} onClose={onClose} onApplied={onApplied} />));
  await flush();
  return { onApplied, onClose };
};
const boxes = () => Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
const button = (name: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === name,
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
  expect(button("Apply").hasAttribute("disabled")).toBe(true);

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

it("reveals each file's outcome in turn, then shows the review", async () => {
  motion(false);
  vi.useFakeTimers();
  autoSort.plan.mockResolvedValue(plan);
  await render(vi.fn(), vi.fn(), files);
  expect(items()).toEqual(names);
  await act(() => vi.advanceTimersByTimeAsync(50));
  expect(items()[0]).toBe("plan.pdfMove → Benefits / Health");
  expect(items()[1]).toBe(names[1]);
  await act(() => vi.advanceTimersByTimeAsync(50));
  expect(items()[1]).toContain("Rename → Cap table - Example Co.png");
  expect(button("Apply").hasAttribute("disabled")).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(items()).toEqual([]);
  expect(boxes()).toHaveLength(3);
  expect(button("Apply").hasAttribute("disabled")).toBe(false);
  vi.useRealTimers();
});

it("shows No change for a file the plan leaves alone", async () => {
  motion(false);
  vi.useFakeTimers();
  autoSort.plan.mockResolvedValue(plan);
  await render(vi.fn(), vi.fn(), files);
  await act(() => vi.advanceTimersByTimeAsync(150));
  expect(items()[2]).toBe("notes.txtNo change");
  vi.useRealTimers();
});

it("skips the reveal when the user prefers reduced motion", async () => {
  motion(true);
  autoSort.plan.mockResolvedValue(plan);
  await render(vi.fn(), vi.fn(), files);
  expect(items()).toEqual([]);
  expect(boxes()).toHaveLength(3);
  expect(button("Apply").hasAttribute("disabled")).toBe(false);
});

it("lists at most 300 files and counts the rest", async () => {
  motion(false);
  autoSort.plan.mockReturnValue(new Promise(() => undefined));
  const many = Array.from({ length: 305 }, (_, n) => ({ id: `m${n}`, name: `file ${n}.pdf` }));
  await render(vi.fn(), vi.fn(), many);
  expect(items()).toHaveLength(301);
  expect(items().at(-1)).toBe("+5 more");
});
