// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rounds = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      views: { cashRaised: () => new Promise(() => {}) },
      fundingRounds: { list: rounds },
    },
  },
}));

import { roundsFixture } from "./fixtures";
import { RoundsTab } from "./RoundsTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

it("shows round dates and prices like every other tab", async () => {
  rounds.mockResolvedValue({
    items: [{ ...roundsFixture[1]!, closingDate: "2025-06-15", originalIssuePrice: "8.5" }],
  });
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/app/cap-table/rounds"]}>
        <RoundsTab />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.textContent).toContain("May 1, 2025");
  expect(container.textContent).toContain("Jun 15, 2025");
  expect(container.textContent).toContain("$8.50");
  expect(container.textContent).not.toContain("2025-05-01");
});
