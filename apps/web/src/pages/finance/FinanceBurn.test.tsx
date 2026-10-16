// @vitest-environment jsdom

import type { FinanceBurnOutput } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
const rpcMock = vi.hoisted(() => ({ burn: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceBurnPage, fromFirstData } from "./FinanceBurn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const month = (m: string, outCents: number) => ({
  month: m,
  outCents,
  revenueCents: 0,
  financingCents: 0,
  partial: false,
});

it("starts the months at the first one with data", () => {
  const series = [
    month("2026-05", 0),
    month("2026-06", 0),
    month("2026-07", 100),
    month("2026-08", 0),
  ];
  expect(fromFirstData(series).map((m) => m.month)).toEqual(["2026-07", "2026-08"]);
  expect(fromFirstData([month("2026-05", 0)]).map((m) => m.month)).toEqual(["2026-05"]);
});

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
  vi.resetAllMocks();
});

it("adds Brex to By account so the shares cover all spend, and hides months before any data", async () => {
  const burn: FinanceBurnOutput = {
    monthlyCents: 100_000,
    series: [month("2026-05", 0), month("2026-06", 0), month("2026-07", 300_000)],
    windowMonths: ["2026-07"],
    whereItWent: [],
    byAccount: [
      {
        account: {
          id: "a1",
          provider: "mercury",
          externalId: "chk",
          name: "Checking",
          lastFour: "1111",
          kind: "checking",
          balanceCents: 0,
          currency: "USD",
        },
        cents: 200_000,
      },
    ],
    brexCents: 100_000,
  };
  rpcMock.burn.mockResolvedValue(burn);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceBurnPage />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  const page = container.textContent ?? "";
  expect(page).toContain("Checking$2,00067%");
  expect(page).toContain("Brex$1,00033%");
  expect(page).toContain("Jul 2026");
  expect(page).not.toContain("May 2026");
});

it("leaves an account that took in more than it spent out of By account and its shares", async () => {
  const account = (id: string, name: string) => ({
    id,
    provider: "statement" as const,
    externalId: id,
    name,
    lastFour: null,
    kind: "checking" as const,
    balanceCents: 0,
    currency: "USD",
  });
  rpcMock.burn.mockResolvedValue({
    monthlyCents: 100_000,
    series: [month("2026-07", 300_000)],
    windowMonths: ["2026-07"],
    whereItWent: [],
    byAccount: [
      { account: account("a1", "Checking"), cents: 300_000 },
      { account: account("a2", "mock firstbank"), cents: -50_000 },
    ],
    brexCents: 0,
  } satisfies FinanceBurnOutput);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceBurnPage />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  const page = container.textContent ?? "";
  expect(page).toContain("Checking$3,000100%");
  expect(page).not.toContain("mock firstbank");
});
