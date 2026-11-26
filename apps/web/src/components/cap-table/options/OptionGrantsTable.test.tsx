// @vitest-environment jsdom

import type { EquityOptionGrant } from "@rakazo/contracts";
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

const rpcMock = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { optionGrants: rpcMock } } }));

import { OptionGrantsTable } from "./OptionGrantsTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const grant = (overrides: Partial<EquityOptionGrant>): EquityOptionGrant => ({
  id: "grant-1",
  label: "ES-40",
  stakeholderId: "sh-1",
  stakeholderName: "Ada Lovelace",
  planId: "plan-1",
  planName: "2026 Stock Plan",
  status: "outstanding",
  optionType: "iso",
  quantity: "120000",
  exercisePrice: "1.20",
  grantDate: "2025-03-04",
  exercisedQuantity: "0",
  canceledQuantity: "0",
  outstandingQuantity: "120000",
  vestedQuantity: "25000",
  shareClassId: "sc-common",
  expirationDate: null,
  boardApprovedOn: null,
  postTerminationExerciseMonths: 3,
  earlyExercise: false,
  acceptanceStatus: "accepted",
  canceledOn: null,
  adminNotes: null,
  vestingSchedule: {
    id: "vesting-1",
    startDate: "2025-03-04",
    totalMonths: 48,
    cliffMonths: 12,
    frequencyMonths: 1,
    tranches: null,
    templateId: null,
    acceleratedShares: null,
    acceleratedOn: null,
    stoppedOn: null,
    description: "1/48 monthly, 1 year cliff",
    createdAt: "2025-03-04T00:00:00.000Z",
    updatedAt: "2025-03-04T00:00:00.000Z",
  },
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
  ...overrides,
});

const grants = [
  grant({}),
  grant({ id: "grant-2", label: "ES-41", stakeholderName: "Grace Hopper", optionType: "nso" }),
  grant({
    id: "grant-3",
    label: "ES-42",
    stakeholderName: "Katherine Johnson",
    status: "canceled",
    canceledQuantity: "25000",
    outstandingQuantity: "0",
    vestingSchedule: null,
  }),
];

const page = (items: EquityOptionGrant[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 25,
});

let root: ReturnType<typeof createRoot> | null = null;
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(
  onBulkCancel?: (items: EquityOptionGrant[]) => void,
  onBulkReprice?: (items: EquityOptionGrant[]) => void,
  onOpen: (grant: EquityOptionGrant) => void = () => undefined,
) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter>
        <OptionGrantsTable
          onOpen={onOpen}
          onAction={() => undefined}
          onDraft={() => undefined}
          onBulkCancel={onBulkCancel}
          onBulkReprice={onBulkReprice}
        />
      </MemoryRouter>,
    );
    await flush();
  });
  return container;
}

const checkboxes = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('[role="checkbox"]'),
];

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
};

it("renders the grant rows with their figures", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const content = container.textContent ?? "";
  expect(content).toContain("ES-40");
  expect(content).toContain("Ada Lovelace");
  expect(content).toContain("120,000");
  expect(content).toContain("$1.20");
  expect(content).toContain("Mar 4, 2025");
  expect(content).toContain("1/48 monthly, 1 year cliff");
  expect(content).toContain("—");
});

it("sends the search to the list", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const input = container.querySelector<HTMLInputElement>('input[name="option-grant-search"]');
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Ada");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  expect(rpcMock.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: "Ada", page: 1 }),
  );
});

it("disables a transaction item that the grant cannot take", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Actions for ES-42"]');
  expect(trigger).not.toBeNull();
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const byName = (name: string) => items.find((item) => item.textContent === name);
  expect(byName("Modify option grant")?.getAttribute("aria-disabled")).not.toBe("true");
  expect(byName("Partially cancel option grant")?.getAttribute("aria-disabled")).toBe("true");
  expect(byName("Reverse cancellation")?.getAttribute("aria-disabled")).not.toBe("true");
});

it("selects every row on the page from the header checkbox", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const all = checkboxes(container).find(
    (box) => box.getAttribute("aria-label") === "Select all",
  ) as HTMLElement;
  await act(async () => all.click());
  const rows = checkboxes(container).filter(
    (box) => box.getAttribute("aria-label") !== "Select all",
  );
  expect(rows).toHaveLength(grants.length);
  expect(rows.every((box) => box.getAttribute("aria-checked") === "true")).toBe(true);
  expect(all.getAttribute("aria-checked")).toBe("true");
  await act(async () => rows[0]?.click());
  expect(all.getAttribute("aria-checked")).toBe("mixed");
});

it("shows the Actions menu only while rows are selected", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const actionsButton = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Actions",
    );
  expect(actionsButton()).toBeUndefined();
  const select = container.querySelector<HTMLElement>('[aria-label="Select ES-40"]') as HTMLElement;
  await act(async () => select.click());
  expect(actionsButton()).not.toBeUndefined();
  await openMenu(actionsButton() as HTMLElement);
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const names = items.map((item) => item.textContent);
  expect(names).toEqual([
    "Export selected",
    "Cancel selected",
    "Reprice selected",
    "Clear selection",
  ]);
});

it("cancels only the outstanding selected grants and clears the selection", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const onBulkCancel = vi.fn();
  const container = await render(onBulkCancel);
  const select = (label: string) =>
    container.querySelector<HTMLElement>(`[aria-label="Select ${label}"]`) as HTMLElement;
  await act(async () => select("ES-40").click());
  await act(async () => select("ES-42").click());
  const actions = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Actions",
  ) as HTMLElement;
  await openMenu(actions);
  const cancel = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === "Cancel selected",
  ) as HTMLElement;
  await act(async () => {
    cancel.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    cancel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  expect(onBulkCancel).toHaveBeenCalledTimes(1);
  expect(onBulkCancel.mock.calls[0]?.[0]).toEqual([grants[0]]);
  const header = checkboxes(container).find(
    (box) => box.getAttribute("aria-label") === "Select all",
  ) as HTMLElement;
  expect(header.getAttribute("aria-checked")).toBe("false");
});

it("reprices only the outstanding selected grants and clears the selection", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const onBulkReprice = vi.fn();
  const container = await render(undefined, onBulkReprice);
  const select = (label: string) =>
    container.querySelector<HTMLElement>(`[aria-label="Select ${label}"]`) as HTMLElement;
  await act(async () => select("ES-40").click());
  await act(async () => select("ES-42").click());
  const actions = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Actions",
  ) as HTMLElement;
  await openMenu(actions);
  const reprice = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === "Reprice selected",
  ) as HTMLElement;
  await act(async () => {
    reprice.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    reprice.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  expect(onBulkReprice).toHaveBeenCalledTimes(1);
  expect(onBulkReprice.mock.calls[0]?.[0]).toEqual([grants[0]]);
  const header = checkboxes(container).find(
    (box) => box.getAttribute("aria-label") === "Select all",
  ) as HTMLElement;
  expect(header.getAttribute("aria-checked")).toBe("false");
});

it("disables Reprice selected when no selected grant is outstanding", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const select = container.querySelector<HTMLElement>('[aria-label="Select ES-42"]') as HTMLElement;
  await act(async () => select.click());
  const actions = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Actions",
  ) as HTMLElement;
  await openMenu(actions);
  const reprice = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === "Reprice selected",
  );
  expect(reprice?.getAttribute("aria-disabled")).toBe("true");
});

it("clears the selection when the search changes", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const container = await render();
  const all = checkboxes(container).find(
    (box) => box.getAttribute("aria-label") === "Select all",
  ) as HTMLElement;
  await act(async () => all.click());
  expect(all.getAttribute("aria-checked")).toBe("true");
  const input = container.querySelector<HTMLInputElement>('input[name="option-grant-search"]');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Ada");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    await flush();
  });
  expect(all.getAttribute("aria-checked")).toBe("false");
});

it("shows what is left of a grant after a forfeit next to the original quantity", async () => {
  rpcMock.list.mockResolvedValue(
    page([grant({ quantity: "48000", canceledQuantity: "4480", outstandingQuantity: "43520" })]),
  );
  const container = await render();
  const cells = [...container.querySelectorAll("tbody td")].map((cell) => cell.textContent);
  expect(cells).toContain("48,000");
  expect(cells).toContain("43,520");
  expect(container.querySelector("thead")?.textContent).toContain("Outstanding");
});

it("opens a grant from a click anywhere on its row, but not from its checkbox", async () => {
  rpcMock.list.mockResolvedValue(page(grants));
  const onOpen = vi.fn();
  const container = await render(undefined, undefined, onOpen);
  const row = container.querySelector("tbody tr")!;
  await act(async () => {
    (row.querySelectorAll("td")[4] as HTMLElement).click();
  });
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ label: "ES-40" }));
  await act(async () => {
    (row.querySelector("[role=checkbox], input[type=checkbox]") as HTMLElement).click();
  });
  expect(onOpen).toHaveBeenCalledTimes(1);
});
