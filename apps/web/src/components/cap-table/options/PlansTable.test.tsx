// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

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
  planPools: { list: vi.fn() },
  plans: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
  shareClasses: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { PlanFormDialog } from "./PlanFormDialog";
import { PlansTable } from "./PlansTable";
import { demoPlanPool } from "./plan-pool-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((node) => node.textContent === label) as
    | HTMLButtonElement
    | undefined;

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
    await flush();
  });
  return container;
}

function type(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("shows each plan's pool and disables pour over with one plan", async () => {
  rpcMock.planPools.list.mockResolvedValue([demoPlanPool()]);
  const container = await mount(<PlansTable onIncrease={vi.fn()} onPourOver={vi.fn()} />);
  expect(container.textContent).toContain("2026 Stock Plan");
  expect(container.textContent).toContain("1,000,000");
  expect(container.textContent).toContain("650,000");
  expect(button("Pour over")?.disabled).toBe(true);
});

it("opens the pool history from the row menu", async () => {
  rpcMock.planPools.list.mockResolvedValue([
    demoPlanPool({
      increases: [{ date: "2024-03-04", shares: "600000", note: "Initial reserve" }],
    }),
  ]);
  await mount(<PlansTable onIncrease={vi.fn()} onPourOver={vi.fn()} />);
  const trigger = document.querySelector<HTMLElement>('[aria-label="Actions for 2026 Stock Plan"]');
  expect(trigger).not.toBeNull();
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (node) => node.textContent?.trim() === "Pool history",
  );
  expect(item).toBeTruthy();
  await act(async () => {
    item?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Mar 4, 2024");
  expect(document.body.textContent).toContain("600,000");
  expect(button("Close")).toBeTruthy();
});

it("disables the export report button when there are no plans", async () => {
  rpcMock.planPools.list.mockResolvedValue([]);
  await mount(<PlansTable onIncrease={vi.fn()} onPourOver={vi.fn()} />);
  expect(button("Export report")).toBeTruthy();
  expect(button("Export report")?.disabled).toBe(true);
});

it("exports the report with the same download as the options table", async () => {
  rpcMock.planPools.list.mockResolvedValue([demoPlanPool()]);
  const createObjectURL = vi.fn(() => "blob:plans");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
  const clicked: { el: HTMLAnchorElement | null } = { el: null };
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.el = this;
  });
  try {
    await mount(<PlansTable onIncrease={vi.fn()} onPourOver={vi.fn()} />);
    expect(button("Export report")).toBeTruthy();
    expect(button("Export report")?.disabled).toBe(false);
    await act(async () => button("Export report")?.click());
    expect(createObjectURL).toHaveBeenCalled();
    expect(clicked.el?.download).toBe("equity-plans.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:plans");
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("adds a plan after the review step", async () => {
  rpcMock.shareClasses.list.mockResolvedValue({
    items: [{ id: "sc-common", name: "Common" }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  rpcMock.plans.create.mockResolvedValue({ id: "plan-9" });
  const onSaved = vi.fn();
  await mount(<PlanFormDialog onClose={vi.fn()} onSaved={onSaved} />);
  await act(async () => type("plan-name", "2027 Plan"));
  await act(async () => type("plan-reserved", "12a"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => type("plan-reserved", "500000"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("500,000");
  await act(async () => {
    button("Save")?.click();
    await flush();
  });
  expect(rpcMock.plans.create).toHaveBeenCalledWith({
    name: "2027 Plan",
    shareClassId: "sc-common",
    reservedShares: "500000",
    boardApprovedOn: null,
  });
  expect(onSaved).toHaveBeenCalled();
});
