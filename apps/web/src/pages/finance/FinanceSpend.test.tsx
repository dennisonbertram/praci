// @vitest-environment jsdom

import type { FinanceVendorOutput } from "@rakazo/contracts";
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
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "Last 3 full months" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ vendor: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceVendorPage } from "./FinanceSpend";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

it("shows a new vendor's steady spend as 0% against the month it compares with", async () => {
  rpcMock.vendor.mockResolvedValue({
    key: "cloudnine",
    name: "Cloudnine Hosting",
    isSubscription: true,
    monthlyAvgCents: 481_200,
    monthlyAvgMonths: 3,
    changePct: 0,
    changeFromMonth: "2026-07",
    firstSeenAt: "2026-07-08T00:00:00.000Z",
    paidWith: [],
    monthly: ["07", "08", "09", "10"].map((m) => ({ month: `2026-${m}`, cents: 481_200 })),
    charges: [],
  } satisfies FinanceVendorOutput);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceVendorPage keyName="cloudnine" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  const page = container.textContent ?? "";
  expect(page).toContain("Change0%vs Jul");
  expect(page).not.toContain("Not enough history");
});
