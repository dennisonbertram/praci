// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { PlanHistoryDialog } from "./PlanHistoryDialog";
import { demoPlanPool } from "./plan-pool-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
    await flush();
  });
  return container;
}

it("lists the increases newest first and ends with the reserve", async () => {
  await mount(
    <PlanHistoryDialog
      pool={demoPlanPool({
        reservedShares: "1000000",
        increases: [
          { date: "2024-03-04", shares: "600000", note: "Initial reserve" },
          { date: "2026-01-09", shares: "150000", note: null },
          { date: "2025-06-18", shares: "250000", note: "Board approved top-up" },
        ],
      })}
      onClose={() => undefined}
    />,
  );
  expect(document.body.textContent).toContain("2026 Stock Plan");
  const rows = [...document.querySelectorAll("tbody tr")];
  const rowText = rows.map((row) => row.textContent);
  expect(rowText).toHaveLength(4);
  expect(rowText[0]).toContain("Jan 9, 2026");
  expect(rowText[0]).toContain("150,000");
  expect(rowText[1]).toContain("Jun 18, 2025");
  expect(rowText[1]).toContain("Board approved top-up");
  expect(rowText[2]).toContain("Mar 4, 2024");
  expect(rowText[2]).toContain("600,000");
  expect(rowText[3]).toContain("Reserved");
  expect(rowText[3]).toContain("1,000,000");
});

it("shows no increases and still the reserve", async () => {
  await mount(<PlanHistoryDialog pool={demoPlanPool({ increases: [] })} onClose={vi.fn()} />);
  expect(document.body.textContent).toContain("No increases");
  expect(document.body.textContent).toContain("Reserved");
  expect(document.body.textContent).toContain("1,000,000");
});
