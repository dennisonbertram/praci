// @vitest-environment jsdom

import type { DataRoomApiProcessing } from "@rakazo/contracts";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (n: number, o: { one: string; other: string }) =>
    (n === 1 ? o.one : o.other).replace("#", String(n)),
}));

import { ProcessingStrip } from "./ProcessingStrip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const counts: DataRoomApiProcessing = {
  reading: 412,
  indexing: 300,
  tagging: 125,
  failed: 0,
  current: "Sample agreement.pdf",
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("shows the count and progress, and expands to the per-step counts", () => {
  act(() => root.render(<ProcessingStrip processing={counts} total={1_104} />));
  expect(container.textContent).toContain("Processing 837 files");
  expect(container.textContent).not.toContain("Reading text");
  const bar = container.querySelector('[role="progressbar"]');
  expect(bar?.getAttribute("aria-valuenow")).toBe("24");
  const toggle = container.querySelector("button") as HTMLButtonElement;
  act(() => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const text = container.textContent ?? "";
  for (const part of [
    "Reading text412",
    "Indexing for search300",
    "Tagging125",
    "Sample agreement.pdf",
  ])
    expect(text).toContain(part);
  act(() => toggle.click());
  expect(container.textContent).not.toContain("Reading text");
});

it("leaves out steps with nothing left, and says when all files are processed", () => {
  act(() =>
    root.render(<ProcessingStrip processing={{ ...counts, reading: 0, tagging: 0 }} total={500} />),
  );
  act(() => container.querySelector("button")?.click());
  expect(container.textContent).toContain("Indexing for search300");
  expect(container.textContent).not.toContain("Tagging");
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{ ...counts, reading: 0, tagging: 0, indexing: 0 }}
        total={500}
        finished
      />,
    ),
  );
  expect(container.textContent).toBe("All files processed");
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
});
