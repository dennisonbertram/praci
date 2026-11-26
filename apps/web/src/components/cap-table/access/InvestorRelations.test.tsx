// @vitest-environment jsdom

import type { EquityAccessHolder } from "@rakazo/contracts";
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

const accessHolders = vi.hoisted(() => ({
  list: vi.fn(),
  setLevels: vi.fn(),
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { accessHolders } } }));

import { InvestorRelations } from "./InvestorRelations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const holder = (
  id: string,
  name: string,
  over: Partial<EquityAccessHolder> = {},
): EquityAccessHolder =>
  ({
    stakeholderId: id,
    name,
    relationship: "investor",
    group: "investors",
    email: null,
    contactId: null,
    majorInvestor: false,
    ownershipPercent: "1.0000",
    classCodes: [],
    groupLevel: "advanced",
    overrideLevel: null,
    effectiveLevel: "advanced",
    requestedLevel: null,
    requestedAt: null,
    lastSeenAt: null,
    ...over,
  }) as EquityAccessHolder;

const rows: EquityAccessHolder[] = [
  holder("h1", "Avery Sample", {
    ownershipPercent: "42.1250",
    classCodes: ["CS"],
    email: "avery@sample.test",
  }),
  holder("h2", "Blue Example Fund", { ownershipPercent: "18.5000", majorInvestor: true }),
  holder("h3", "Cedar Growth Partners", {
    ownershipPercent: "9.7500",
    overrideLevel: "restricted",
    effectiveLevel: "restricted",
  }),
  holder("h4", "Dana Placeholder", {
    ownershipPercent: "0.2500",
    requestedLevel: "full_detail",
    requestedAt: "2026-10-20T09:00:00.000Z",
  }),
];

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  accessHolders.list.mockReset().mockResolvedValue({
    items: rows,
    total: rows.length,
    page: 1,
    pageSize: 25,
  });
  accessHolders.setLevels.mockReset().mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <InvestorRelations />
      </MemoryRouter>,
    );
  });
};

const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith(label))!;
const pick = async (value: string) => {
  const select = document.querySelector('[role="dialog"] select') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const change = async (label: string, value: string) => {
  const field = host.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

it("lists holders sorted by ownership desc by default", async () => {
  await render();
  expect(accessHolders.list).toHaveBeenCalledWith(
    expect.objectContaining({ sort: { field: "ownership", dir: "desc" }, page: 1, pageSize: 25 }),
  );
  const names = [...host.querySelectorAll("tbody td.font-medium")].map((cell) => cell.textContent);
  expect(names).toEqual([
    "Avery Sample",
    "Blue Example Fund",
    "Cedar Growth Partners",
    "Dana Placeholder",
  ]);
  expect(host.textContent).toContain("42.13%");
  expect(host.textContent).toContain("Override");
  expect(host.textContent).toContain("Requested");
});

it("keeps investor access columns in a labelled, keyboard-scrollable region", async () => {
  await render();
  const region = host.querySelector('[role="region"][aria-label="Investor relations"]');
  expect(region?.className).toContain("overflow-x-auto");
  expect(region?.querySelector("table")?.className).toContain("min-w-[960px]");
  expect(region?.querySelectorAll("th")).toHaveLength(8);
});

it("truncates long investor names while keeping the full value accessible", async () => {
  const name = "The International Long Name Foundation for Example Holdings";
  accessHolders.list.mockResolvedValue({
    items: [holder("long-name", name)],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  await render();
  const nameCell = host.querySelector("tbody td[aria-label]");
  expect(nameCell?.textContent).toBe(name);
  expect(nameCell?.getAttribute("aria-label")).toBe(name);
  expect(nameCell?.getAttribute("title")).toBe(name);
  expect(nameCell?.querySelector("span")?.className).toContain("truncate");
});

it("sends the level filter", async () => {
  await render();
  await change("Access level", "basic");
  expect(accessHolders.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: ["basic"], page: 1 }),
  );
});

it("changes every selected holder at once, null for Use group level", async () => {
  await render();
  const boxes = host.querySelectorAll('tbody [role="checkbox"]');
  await act(async () => (boxes[0] as HTMLElement).click());
  await act(async () => (boxes[1] as HTMLElement).click());
  await act(async () => button("Change access").click());
  await pick("group");
  await act(async () => button("Save").click());
  expect(accessHolders.setLevels).toHaveBeenCalledTimes(1);
  expect(accessHolders.setLevels).toHaveBeenCalledWith({
    stakeholderIds: ["h1", "h2"],
    level: null,
  });
});
