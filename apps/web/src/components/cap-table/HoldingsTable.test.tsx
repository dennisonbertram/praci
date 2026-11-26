// @vitest-environment jsdom

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

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import type { HoldingRow } from "./HoldingsTable";
import { HoldingsTable } from "./HoldingsTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (
  key: string,
  name: string,
  security: string,
  shares: number | null,
  usd: number | null,
  percent: number | null,
  pool = false,
): HoldingRow => ({
  key,
  name,
  security,
  shares,
  amountUsd: usd,
  percent,
  pool,
  contact: null,
});
const rows = [
  row("a", "Cy Fund", "Seed Preferred", 300, 500_000, 30),
  row("b", "Ada Founder", "Common", 600, null, 60),
  row("c", "Bo Angel", "Seed Preferred", 100, 20_000, 10),
  row("pool", "Unallocated pool", "Pool", 50, null, 5, true),
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const show = (url = "/") =>
  act(async () =>
    root.render(
      <MemoryRouter key={url} initialEntries={[url]}>
        <div className="@container">
          <HoldingsTable rows={rows} onAddContact={() => {}} onOpenContact={() => {}} />
        </div>
      </MemoryRouter>,
    ),
  );
const holders = () =>
  [...container.querySelectorAll("tbody tr")]
    .map((tr) => tr.querySelector("td")?.firstElementChild?.textContent)
    .filter((n) => n && n !== "Total");
const head = (label: string) =>
  [...container.querySelectorAll<HTMLElement>("thead th button")].find(
    (b) => b.textContent === label,
  );
const click = (el: Element | undefined) => act(async () => (el as HTMLElement)?.click());

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  setHideAmounts(false);
  act(() => root.unmount());
  container.remove();
});

it("keeps the given order until a header is clicked, with the pool last", async () => {
  await show();
  expect(holders()).toEqual(["Cy Fund", "Ada Founder", "Bo Angel", "Unallocated pool"]);
  await click(head("Holder"));
  expect(holders()).toEqual(["Ada Founder", "Bo Angel", "Cy Fund", "Unallocated pool"]);
  await click(head("Shares"));
  expect(holders()).toEqual(["Bo Angel", "Cy Fund", "Ada Founder", "Unallocated pool"]);
  await click(head("Shares"));
  expect(holders()).toEqual(["Ada Founder", "Cy Fund", "Bo Angel", "Unallocated pool"]);
});

it("sorts by invested amount with missing amounts last, also while amounts are hidden", async () => {
  setHideAmounts(true);
  await show("/?sort=invested&dir=desc");
  expect(holders()).toEqual(["Cy Fund", "Bo Angel", "Ada Founder", "Unallocated pool"]);
});

it("masks invested amounts when hide amounts turns on while the table is mounted", async () => {
  await show();
  expect(container.textContent).toContain("$500,000");
  setHideAmounts(true);
  await act(async () => {});
  expect(container.textContent).not.toContain("$500,000");
});

it("searches by holder and filters by security, and hides the total while filtered", async () => {
  await show("/?holder=an");
  expect(holders()).toEqual(["Bo Angel"]);
  await show("/?security=Seed%20Preferred");
  expect(holders()).toEqual(["Cy Fund", "Bo Angel"]);
  expect(container.textContent).not.toContain("Total");
  await show("/?holder=zzz");
  expect(container.textContent).toContain("No matches");
  await click(
    [...container.querySelectorAll("button")].find((b) => b.textContent === "Clear filters"),
  );
  expect(holders()).toHaveLength(4);
  expect(container.textContent).toContain("Total");
});
