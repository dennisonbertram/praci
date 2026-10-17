// @vitest-environment jsdom

import type { FinanceTransaction } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (_n: number, o: { other: string }) => o.other,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { TransactionTable } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

const txn = (id: string, cents: number) =>
  ({
    id,
    counterparty: "Acme Hosting",
    amountCents: cents,
    category: "Servers",
    currency: "USD",
    status: "posted",
    postedAt: "2026-10-01T00:00:00Z",
  }) as FinanceTransaction;

it("masks a grouped vendor total and its expanded rows while amounts are hidden, and flips live", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const rows = [txn("1", -123_456), txn("2", -777_700)];
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TransactionTable rows={rows} grouped />
      </MemoryRouter>,
    ),
  );
  expect(el.textContent).toContain("9,011.56");
  await act(async () => setHideAmounts(true));
  await act(async () => el.querySelector("button")?.click());
  for (const real of ["9,011", "1,234", "7,777"]) expect(el.textContent).not.toContain(real);
  expect(el.textContent).toContain("Acme Hosting");
});
