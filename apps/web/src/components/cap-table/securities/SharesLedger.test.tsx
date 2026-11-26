// @vitest-environment jsdom

import type { EquityCertificate } from "@rakazo/contracts";
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

const rpcMock = vi.hoisted(() => ({
  certificates: { list: vi.fn() },
  shareClasses: { list: vi.fn() },
  certificateTotals: vi.fn(),
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { toCsv } from "./format";
import { SharesLedger } from "./SharesLedger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string, status: EquityCertificate["status"]): EquityCertificate =>
  ({
    id,
    label: `CS-${id}`,
    stakeholderId: "sh-1",
    stakeholderName: "Avery Lindqvist",
    shareClassId: "sc-common",
    shareClassName: "Common",
    status,
    acceptanceStatus: "accepted",
    quantity: "1000000",
    pricePerShare: "0.0001",
    pricePaidPerShare: "0.0001",
    transactionValueCents: "10000",
    issueDate: "2025-03-15",
  }) as EquityCertificate;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  setHideAmounts(false);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.certificateTotals.mockResolvedValue({ count: 2, shares: "2000000" });
  rpcMock.shareClasses.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 500 });
  rpcMock.certificates.list.mockResolvedValue({
    items: [row("1", "outstanding"), row("2", "canceled")],
    total: 2,
    page: 1,
    pageSize: 25,
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setHideAmounts(false);
  vi.clearAllMocks();
});

async function render(onOpen = vi.fn(), onAction = vi.fn()) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <SharesLedger onOpen={onOpen} onAction={onAction} />
      </MemoryRouter>,
    );
  });
  return { onOpen, onAction };
}

it("lists certificates newest first with formatted values", async () => {
  await render();
  expect(rpcMock.certificates.list).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, sort: { field: "issueDate", dir: "desc" } }),
  );
  expect(host.textContent).toContain("CS-1");
  expect(host.textContent).toContain("1,000,000");
  expect(host.textContent).toContain("$100.00");
  expect(host.textContent).toContain("2 certificates, 2,000,000 shares");
  // Columns size to their content and the table scrolls, so long names never run into Status.
  const table = host.querySelector("table")!;
  expect(table.className).toContain("table-auto");
  expect(table.className).toContain("whitespace-nowrap");
});

it("masks read-only certificate prices and values while leaving shares visible", async () => {
  setHideAmounts(true);
  await render();
  expect(host.textContent).toContain("$•••");
  expect(host.textContent).not.toContain("$100.00");
  expect(host.textContent).toContain("1,000,000");
});

it("opens a certificate from its label and enables Actions once a row is selected", async () => {
  const { onOpen } = await render();
  const label = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "CS-1",
  );
  await act(async () => label?.click());
  expect(onOpen).toHaveBeenCalledWith("1");
  const actions = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Actions",
  );
  expect(actions?.hasAttribute("disabled")).toBe(true);
  const select = host.querySelector('[aria-label="Select CS-1"]') as HTMLElement;
  await act(async () => select.click());
  expect(actions?.hasAttribute("disabled")).toBe(false);
  expect(host.textContent).toContain("1 selected");
});

it("quotes CSV cells that need it", () => {
  const csv = toCsv(
    [{ name: 'Brook "B" Ventures, L.P.', shares: "10" }],
    [
      { label: "Stakeholder", value: (item: { name: string }) => item.name },
      { label: "Shares", value: (item: { shares: string }) => item.shares },
    ],
  );
  expect(csv).toBe('Stakeholder,Shares\r\n"Brook ""B"" Ventures, L.P.",10\r\n');
});

it("formats percents without eating whole-number zeros", async () => {
  const { formatPercent } = await import("./format");
  expect(formatPercent("20")).toBe("20%");
  expect(formatPercent("20.0000000000")).toBe("20%");
  expect(formatPercent("12.5000")).toBe("12.5%");
  expect(formatPercent(null)).toBe("—");
});

it("gives every price in a column the same decimals, 2 to 4", async () => {
  const { formatCents, formatPrice, pricePlaces } = await import("./format");
  expect(pricePlaces(["0.1", "8.5"])).toBe(2);
  expect(pricePlaces(["0.0001", "8.5"])).toBe(4);
  expect(pricePlaces(["1.123456", null])).toBe(4);
  expect(formatPrice("8.5", 4)).toBe("$8.5000");
  expect(formatPrice("0.10", 2)).toBe("$0.10");
  expect(formatPrice("1.123456", 4)).toBe("$1.1235");
  expect(formatPrice("1234.5", 2)).toBe("$1,234.50");
  expect(formatCents("12345", true)).toBe("$•••");
  expect(formatPrice("1.25", 2, true)).toBe("$•••");
});
