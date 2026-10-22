// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const preview = vi.hoisted(() => vi.fn());
vi.mock("../lib/rpc", () => ({ rpc: { files: { spreadsheetPreview: preview } } }));

import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { SheetPreview } from "./SheetPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Cell = string | number | null;
const page = (over: Record<string, unknown> = {}) => ({
  status: "ready" as const,
  sheets: [{ name: "Revenue", dimension: null }],
  sheet: "Revenue",
  columns: ["A", "B"],
  headerRow: 1,
  header: ["Region", "Amount"] as Cell[],
  rows: [{ row: 2, cells: ["North", 1234567.5] as Cell[] }],
  truncated: false,
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const show = async () => {
  await act(async () => {
    root.render(<SheetPreview source={{ artifactId: "a1" }} />);
  });
};
const click = async (el: Element | undefined) => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === label);
const cell = (text: string) =>
  [...container.querySelectorAll("td")].find((c) => c.textContent === text);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  preview.mockReset();
  setHideAmounts(false);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetHideAmountsMemory();
});

it("shows tabs for several sheets and loads the chosen one", async () => {
  preview.mockImplementation(async ({ sheet }: { sheet?: string }) =>
    page({
      sheets: [
        { name: "Revenue", dimension: null },
        { name: "Headcount", dimension: null },
      ],
      sheet: sheet ?? "Revenue",
    }),
  );
  await show();
  expect([...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual([
    "Revenue",
    "Headcount",
  ]);
  await click([...container.querySelectorAll('[role="tab"]')][1]);
  expect(preview).toHaveBeenLastCalledWith({ source: { artifactId: "a1" }, sheet: "Headcount" });
});

it("shows no tabs for one sheet, right-aligns numbers and keeps column letters", async () => {
  preview.mockResolvedValue(page());
  await show();
  expect(container.querySelector('[role="tab"]')).toBeNull();
  expect(cell("1,234,567.5")?.className).toContain("text-end");
  expect(cell("North")?.className).not.toContain("text-end");
  expect([...container.querySelectorAll("th")].map((h) => h.textContent)).toEqual(["", "A", "B"]);
});

it("loads the next rows after the ones shown", async () => {
  preview
    .mockResolvedValueOnce(page({ truncated: true }))
    .mockResolvedValueOnce(page({ rows: [{ row: 3, cells: ["South", 5] }], truncated: false }));
  await show();
  await click(button("Load more"));
  expect(preview).toHaveBeenLastCalledWith({
    source: { artifactId: "a1" },
    sheet: "Revenue",
    offset: 1,
  });
  expect(cell("South")).toBeDefined();
  expect(cell("North")).toBeDefined();
  expect(button("Load more")).toBeUndefined();
});

it("masks numeric cells while amounts are hidden but keeps text", async () => {
  setHideAmounts(true);
  preview.mockResolvedValue(page({ rows: [{ row: 2, cells: ["Paid $1,200 total", 1234567.5] }] }));
  await show();
  expect(container.textContent).not.toContain("1,234,567");
  expect(container.textContent).not.toContain("1,200");
  expect(container.textContent).toContain("Paid $•••");
  expect(cell("•••")).toBeDefined();
});

it("says an empty sheet is empty", async () => {
  preview.mockResolvedValue(page({ columns: [], headerRow: null, header: [], rows: [] }));
  await show();
  expect(container.textContent).toContain("This sheet is empty.");
});

it("keeps the download message for an unsupported file", async () => {
  preview.mockResolvedValue({ status: "unsupported", message: "Legacy .xls" });
  await show();
  expect(container.textContent).toContain("download it to view it");
});

it("shows an error when the file cannot be loaded", async () => {
  preview.mockRejectedValue(new Error("Boom"));
  await show();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("opens a CSV as a plain table: header row on top, readable names, grouped numbers", async () => {
  preview.mockResolvedValue(
    page({
      header: ["monthly_burn", "Region", "value_usd"] as Cell[],
      rows: [{ row: 2, cells: ["1234567", "North", "5"] as Cell[] }],
    }),
  );
  await act(async () => {
    root.render(<SheetPreview source={{ artifactId: "a1" }} name="burn.csv" />);
  });
  expect([...container.querySelectorAll("th")].map((h) => h.textContent)).toEqual([
    "Monthly burn",
    "Region",
    "Value (USD)",
  ]);
  expect(cell("1,234,567")?.className).toContain("text-end");
});

it("right-aligns the header of a numeric column, in a CSV and in a spreadsheet", async () => {
  preview.mockResolvedValue(
    page({
      header: ["Region", "Amount"] as Cell[],
      rows: [{ row: 2, cells: ["North", 5] as Cell[] }],
    }),
  );
  await act(async () => {
    root.render(<SheetPreview source={{ artifactId: "a1" }} name="burn.csv" />);
  });
  const heads = [...container.querySelectorAll("th")];
  expect(heads[1]?.className).toContain("text-end");
  expect(heads[0]?.className).not.toContain("text-end");
  await show();
  expect(cell("Amount")?.className).toContain("text-end");
  expect(cell("Region")?.className).not.toContain("text-end");
});
