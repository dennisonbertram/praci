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

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { NonUsdNotice } from "./NonUsdNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  setHideAmounts(false);
});

const rows = [
  {
    id: "eu-1",
    counterparty: "Berlin Café",
    amountCents: -98_765,
    category: "Travel",
    currency: "EUR",
    status: "posted",
    postedAt: "2026-10-05T00:00:00Z",
  },
] as FinanceTransaction[];

async function open(noticeRows = rows) {
  const el = document.createElement("div");
  document.body.append(el);
  const mounted = createRoot(el);
  root = mounted;
  await act(async () =>
    mounted.render(
      <MemoryRouter>
        <NonUsdNotice rows={noticeRows} count={noticeRows.length} />
      </MemoryRouter>,
    ),
  );
  const button = el.querySelector("button");
  await act(async () => button?.click());
  return { el, root, button };
}

it("keeps the notice text and opens the rows it left out", async () => {
  const { button } = await open();
  expect(button?.textContent).toBe("1 non-USD transaction not counted");
  const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
  expect(popover?.textContent).toContain("Berlin Café");
  expect(popover?.querySelector('a[href="/app/finance/transaction/eu-1"]')).not.toBeNull();
});

it("names the popover after the notice it opens from", async () => {
  await open();
  const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
  expect(popover?.getAttribute("aria-label")).toBe("1 non-USD transaction not counted");
});

it("shows no amount digits while amounts are hidden", async () => {
  setHideAmounts(true);
  await open();
  const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
  expect(popover?.textContent).toContain("Berlin Café");
  expect(popover?.textContent).not.toMatch(/\d[\d,.]*\s*€|€\s*\d/);
  expect(popover?.textContent).not.toContain("987");
});
