// @vitest-environment jsdom

import type { DataRoomApiImport } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: parts }, ...values),
  plural: (n: number, o: { one: string; other: string }) =>
    (n === 1 ? o.one : o.other).replace("#", String(n)),
}));

import { ImportActivity } from "./ImportActivity";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (done: number, names: string[]) =>
  ({
    id: "i1",
    total: done,
    done,
    failed: 0,
    inProgress: 0,
    finished: true,
    added: done,
    stage: null,
    currentName: null,
    latest: names.map((name) => ({ id: name, name })),
  }) as DataRoomApiImport;

const text = (imports: DataRoomApiImport[]) => {
  const el = document.createElement("div");
  const root = createRoot(el);
  act(() =>
    root.render(<ImportActivity imports={imports} onOpenItem={vi.fn()} onDismiss={vi.fn()} />),
  );
  const out = [...el.querySelectorAll("button")].map((b) => b.textContent);
  const status = el.querySelector("[role=status] span")?.textContent;
  act(() => root.unmount());
  return { status, out };
};

it("names the newest files and counts the rest as +N more", () => {
  expect(text([entry(2, ["a.txt", "b.txt"])]).out).toEqual(["a.txt", "b.txt", ""]);
  const more = text([entry(4, ["a.txt", "b.txt", "c.txt"])]);
  expect(more.status).toBe("Imported 4 files");
  expect(more.out).toEqual(["a.txt", "b.txt", "c.txt", ""]);
  const el = document.createElement("div");
  const root = createRoot(el);
  act(() =>
    root.render(
      <ImportActivity
        imports={[entry(4, ["a.txt", "b.txt", "c.txt"])]}
        onOpenItem={vi.fn()}
        onDismiss={vi.fn()}
      />,
    ),
  );
  expect(el.textContent).toContain("+1 more");
  act(() => root.unmount());
});
