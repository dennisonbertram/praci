// @vitest-environment jsdom

import type { DataRoomApiProcessing } from "@rakazo/contracts";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: parts }, ...values),
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
  for (const part of ["Reading text412", "Indexing for search300", "Tagging125"])
    expect(text).toContain(part);
  act(() => toggle.click());
  expect(container.textContent).not.toContain("Reading text");
});

it("names the file being worked on and never mentions failed files", () => {
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{
          reading: 3,
          indexing: 0,
          tagging: 0,
          failed: 1,
          current: "Board minutes.pdf",
        }}
        total={3}
      />,
    ),
  );
  const text = container.textContent ?? "";
  expect(text).toContain("Processing 3 files");
  expect(text).toContain("Reading Board minutes.pdf");
  expect(text).not.toContain("couldn't be read");
  act(() => (container.querySelector("button") as HTMLButtonElement).click());
  expect(container.querySelector("ul")?.textContent).toBe("Reading text3");
});

it("shows nothing when only failed files remain: the row and the sidebar badge carry it", () => {
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{ reading: 0, indexing: 0, tagging: 0, failed: 1, current: null }}
        total={2}
      />,
    ),
  );
  expect(container.textContent).toBe("");
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

it("puts running imports on the same line as the processing count", () => {
  act(() =>
    root.render(
      <ProcessingStrip processing={counts} total={1_104} importing={{ done: 399, total: 1_104 }} />,
    ),
  );
  expect(container.children).toHaveLength(1);
  expect(container.textContent).toContain("Importing 399 of 1104");
  expect(container.textContent).toContain("Processing 837 files");
});

it("keeps the strip on one line, and draws no bar before any progress", () => {
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{
          reading: 3,
          indexing: 0,
          tagging: 0,
          failed: 1,
          current: "Board minutes.pdf",
        }}
        total={3}
      />,
    ),
  );
  const line = container.querySelector('[role="status"] > div');
  expect(container.querySelectorAll('[role="status"] > *')).toHaveLength(1);
  expect(line?.textContent).toContain("Processing 3 files");
  expect(line?.className).toContain("whitespace-nowrap");
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
});

it("shows nothing for one or two files: their rows already say Reading", () => {
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{ reading: 2, indexing: 0, tagging: 0, failed: 0, current: "a.pdf" }}
        total={2}
      />,
    ),
  );
  expect(container.textContent).toBe("");
  act(() =>
    root.render(
      <ProcessingStrip
        processing={{ reading: 0, indexing: 0, tagging: 0, failed: 0, current: null }}
        total={2}
        finished
      />,
    ),
  );
  expect(container.textContent).toBe("");
});

it("says it is waiting for permission, not processing, when the user has not allowed reading", () => {
  act(() =>
    root.render(<ProcessingStrip processing={counts} total={1_104} waitingForPermission />),
  );
  expect(container.textContent).toContain("Waiting for permission to read");
  expect(container.textContent).not.toContain("Processing");
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
});

it("says a stalled batch is taking longer than usual and offers Try again", () => {
  const onRetry = vi.fn();
  act(() =>
    root.render(<ProcessingStrip processing={counts} total={1_104} stalled onRetry={onRetry} />),
  );
  expect(container.textContent).toContain("Taking longer than usual");
  const retry = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Try again",
  );
  act(() => retry?.click());
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("says a read is taking longer than usual after a minute on the same file", () => {
  vi.useFakeTimers();
  try {
    act(() => root.render(<ProcessingStrip processing={counts} total={1_104} />));
    expect(container.textContent).not.toContain("Taking longer than usual");
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(container.textContent).toContain("Taking longer than usual");
  } finally {
    vi.useRealTimers();
  }
});
