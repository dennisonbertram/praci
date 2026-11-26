// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import type { EquityTransaction } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setHideAmounts } from "../../../lib/hide-amounts-preference";

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

const list = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { transactions: { list } } } }));

import { ActivityLog, changedFields } from "./ActivityLog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row: EquityTransaction = {
  id: "t1",
  kind: "transfer",
  effectiveDate: "2026-04-10",
  reason: null,
  certificateId: "c1",
  convertibleId: null,
  optionGrantId: null,
  planId: null,
  securityLabel: "CS-2",
  quantity: "20000",
  valueCents: "2000000",
  before: { holder: "Avery Sample", quantity: "20000" },
  after: { holder: "Blue Example Fund", quantity: "20000" },
  resulting: [],
  note: null,
  actorName: "Sam Example",
  createdAt: "2026-04-10T10:00:00.000Z",
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
  setHideAmounts(false);
  list.mockReset();
  list.mockResolvedValue({ items: [row], total: 1, page: 1, pageSize: 25 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  setHideAmounts(false);
  host.remove();
});

const render = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ActivityLog />
      </MemoryRouter>,
    );
  });
};

const change = async (label: string, value: string) => {
  const field = host.querySelector(`[aria-label="${label}"]`) as
    | HTMLInputElement
    | HTMLSelectElement;
  const proto = field instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(
      new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
};

it("lists changes newest first", async () => {
  await render();
  expect(list).toHaveBeenCalledWith(
    expect.objectContaining({ sort: { field: "createdAt", dir: "desc" }, page: 1 }),
  );
  expect(host.textContent).toContain("Transfer");
  expect(host.textContent).toContain("CS-2");
  expect(host.textContent).toContain("20,000");
  expect(host.textContent).toContain("$20,000.00");
  // The effective date reads like every other tab.
  expect(host.textContent).toContain("Apr 10, 2026");
  expect(host.textContent).not.toContain("2026-04-10");
});

it("keeps activity columns in a labelled horizontal scroll region", async () => {
  await render();
  const region = host.querySelector('[role="region"][aria-label="Cap table activity"]');
  expect(region?.className).toContain("overflow-x-auto");
  expect(region?.querySelector("table")?.className).toContain("min-w-[960px]");
  expect(region?.querySelectorAll("th")).toHaveLength(8);
});

it("sends the kind and date filters", async () => {
  await render();
  await change("Change", "cancel");
  await change("From", "2026-01-01");
  await change("To", "2026-12-31");
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: ["cancel"], from: "2026-01-01", to: "2026-12-31", page: 1 }),
  );
});

it("opens a row to show before and after", async () => {
  await render();
  const detailAction = host.querySelector('button[data-row-open][aria-expanded="false"]');
  expect(detailAction?.getAttribute("aria-label")).toBe("Show details for Transfer");
  await act(async () => (detailAction as HTMLButtonElement).click());
  expect(detailAction?.getAttribute("aria-expanded")).toBe("true");
  expect(detailAction?.getAttribute("aria-label")).toBe("Hide details for Transfer");
  expect(host.textContent).toContain("Holder: Avery Sample → Blue Example Fund");
  expect(host.textContent).not.toContain("Quantity: 20000");
});

it("wraps long expanded changes inside the horizontally scrolling table", async () => {
  const legend = `CERTIFICATE-${"A".repeat(180)}`;
  list.mockResolvedValue({
    items: [
      {
        ...row,
        before: { certificateLegend: "Original" },
        after: { certificateLegend: legend },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  await render();

  const region = host.querySelector('[role="region"][aria-label="Cap table activity"]');
  const table = region?.querySelector("table");
  const detailAction = host.querySelector('button[data-row-open][aria-expanded="false"]');
  await act(async () => (detailAction as HTMLButtonElement).click());

  const detailList = host.querySelector("ul");
  const detailItem = detailList?.querySelector("li");
  expect(region?.className).toContain("overflow-x-auto");
  expect(table?.className).toContain("min-w-[960px]");
  expect(table?.className).not.toContain("whitespace-nowrap");
  expect(detailList?.className).toContain("min-w-0");
  expect(detailItem?.className).toContain("[overflow-wrap:anywhere]");
  expect(detailItem?.textContent).toContain(legend);
});

it("masks row values and expanded monetary changes while preserving quantities and dates", async () => {
  const moneyRow = {
    ...row,
    before: {
      holder: "Avery Sample",
      quantity: "20000",
      cashPaidCents: "2000000",
      pricePerShare: "1.25",
    },
    after: {
      holder: "Blue Example Fund",
      quantity: "20000",
      cashPaidCents: "2500000",
      pricePerShare: "2.5",
    },
  } satisfies EquityTransaction;
  list.mockResolvedValue({ items: [moneyRow], total: 1, page: 1, pageSize: 25 });
  setHideAmounts(true);
  await render();

  expect(host.textContent).toContain("$•••");
  expect(host.textContent).not.toContain("$20,000.00");
  expect(host.textContent).toContain("20,000");
  expect(host.textContent).toContain("Apr 10, 2026");
  const detailAction = host.querySelector('button[data-row-open][aria-expanded="false"]');
  await act(async () => (detailAction as HTMLButtonElement).click());
  expect(host.textContent).toContain("Cash paid: $••• → $•••");
  expect(host.textContent).toContain("Price per share: $••• → $•••");
  expect(host.textContent).not.toContain("1.25");
  expect(host.textContent).not.toContain("2.5");

  await act(async () => setHideAmounts(false));
  expect(host.textContent).toContain("$20,000.00");
  expect(host.textContent).toContain("Cash paid: $20,000.00 → $25,000.00");
  expect(host.textContent).toContain("Price per share: 1.25 → 2.5");
});

it("lists only the fields that changed", () => {
  expect(changedFields(null, { a: 1, id: "x", stakeholderId: "s", note: null })).toEqual(["A: 1"]);
  expect(changedFields({ a: 1, b: 2, c: null }, { a: 1, b: 3 })).toEqual(["B: 2 → 3"]);
  expect(
    changedFields(null, { cashPaidCents: "212500000", status: "waiting_for_acceptance" }),
  ).toEqual(["Cash paid: $2,125,000.00", "Status: waiting for acceptance"]);
});

it("does not expand a change with nothing before or after", async () => {
  list.mockResolvedValue({
    items: [{ ...row, id: "t2", before: null, after: null }],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  await render();
  expect(host.querySelector("[aria-expanded]")).toBeNull();
});
