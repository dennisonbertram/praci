// @vitest-environment jsdom

import type { FinanceRunwayOutput } from "@rakazo/contracts";
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
const rpcMock = vi.hoisted(() => ({ runway: vi.fn(), setPreferences: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceRunwayPage } from "./FinanceBurn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const runway = (over: Partial<FinanceRunwayOutput> = {}): FinanceRunwayOutput => ({
  runwayCrypto: "stablecoins",
  cashCents: 125_000_00,
  breakdown: { bankCents: 100_000_00, stablecoinCents: 25_000_00, otherCryptoCents: 30_000_00 },
  monthlyBurnCents: 10_000_00,
  runway: { months: 12.5, runOutDate: "2027-10-30" },
  history: [{ month: "2026-09", balanceCents: 120_000_00 }],
  projection: [{ month: "2026-10", balanceCents: 125_000_00 }],
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
async function show() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceRunwayPage />
      </MemoryRouter>,
    ),
  );
  await flush();
}
const toggle = () =>
  [...container.querySelectorAll("button")].find((b) =>
    /^(Count crypto|Counting)/.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
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

it("breaks cash into bank, stablecoins and other crypto, with the saved scope selected", async () => {
  rpcMock.runway.mockResolvedValue(runway());
  await show();
  const page = container.textContent ?? "";
  expect(page).toContain("Bank$100,000");
  expect(page).toContain("Stablecoins$25,000");
  // Under the stablecoins scope, other crypto is listed but left out of the runway figure.
  expect(page).not.toContain("$25,000 · not in runway");
  expect(page).toContain("Other crypto$30,000 · not in runway");
  expect(page).toContain("In runway$125,000");
  expect(toggle()?.textContent).toBe("Counting stablecoins");
});

it("saves the chosen scope and reloads the runway", async () => {
  rpcMock.runway.mockResolvedValueOnce(runway({ runwayCrypto: "bank", cashCents: 100_000_00 }));
  rpcMock.setPreferences.mockResolvedValue({ runwayCrypto: "all" });
  await show();
  // Beside the pill, a line says what counts now, so the off state reads as a state.
  expect(container.textContent).toContain("Crypto is left out of cash and this runway.");
  rpcMock.runway.mockResolvedValueOnce(
    runway({
      runwayCrypto: "all",
      cashCents: 155_000_00,
      runway: { months: 15.5, runOutDate: null },
    }),
  );
  await act(async () => toggle()?.click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "all" });
  expect(rpcMock.runway).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("$155,000");
  expect(container.textContent).toContain("All crypto counts as cash in this runway.");
});

it("hides the scope control when there is no crypto", async () => {
  rpcMock.runway.mockResolvedValue(
    runway({ breakdown: { bankCents: 100_000_00, stablecoinCents: 0, otherCryptoCents: 0 } }),
  );
  await show();
  expect(toggle()).toBeUndefined();
  expect(container.textContent).not.toContain("Other crypto");
});

it("says revenue is subtracted from burn, as the burn figure is calculated", async () => {
  rpcMock.runway.mockResolvedValue(runway());
  await show();
  expect(container.textContent).toContain("RevenueSubtracted from burn");
  expect(container.textContent).not.toContain("RevenueExcluded");
});

it("says a raise is already in cash but not counted as burn, instead of 'Excluded'", async () => {
  rpcMock.runway.mockResolvedValue(runway());
  await show();
  expect(container.textContent).toContain("FinancingIn cash, not counted as burn");
  expect(container.textContent).not.toContain("Excluded");
});
