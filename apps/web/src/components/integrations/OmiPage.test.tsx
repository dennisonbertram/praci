// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { OmiSyncState } from "../../lib/omi/useOmiSync";
import { OmiView } from "./OmiPage";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function status(sync: OmiSyncState) {
  const container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <MemoryRouter>
        <OmiView
          status={null}
          sync={sync}
          onSync={() => undefined}
          onDisconnect={() => undefined}
          onDeleteAll={() => undefined}
        />
      </MemoryRouter>,
    ),
  );
  return container.querySelector("[role=status]")?.textContent;
}

it("drops the numbers for audio under a minute", () => {
  expect(status({ kind: "downloading", done: 0, total: 0 })).toBe("Downloading");
  expect(status({ kind: "paused", done: 0, total: 0 })).toBe("Paused");
});

it("drops the numbers when the unrounded total is under a minute", () => {
  // 30 s rounds to 1 min, but is still under a minute.
  expect(status({ kind: "downloading", done: 0.2, total: 0.5 })).toBe("Downloading");
  expect(status({ kind: "paused", done: 0.2, total: 0.5 })).toBe("Paused");
});

it("keeps the numbers from one minute up", () => {
  expect(status({ kind: "downloading", done: 14, total: 38 })).toBe("Downloading 14 of 38 min");
  expect(status({ kind: "paused", done: 14, total: 38 })).toBe("Paused · 14 of 38 min saved");
});

it("counts hours from two hours up", () => {
  expect(status({ kind: "downloading", done: 119, total: 119.4 })).toBe(
    "Downloading 119 of 119 min",
  );
  expect(status({ kind: "downloading", done: 190, total: 1620 })).toBe("Downloading 3.2 of 27 h");
  expect(status({ kind: "paused", done: 600, total: 1620 })).toBe("Paused · 10 of 27 h saved");
});

it("says an upload failed without blaming the pendant", () => {
  expect(status({ kind: "upload_failed" })).toBe("Could not upload · saved on this computer");
});
