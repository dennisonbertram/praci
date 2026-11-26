// @vitest-environment jsdom

import type { EquityVestingTemplate } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { vestingTemplates: rpcMock } } }));

import { VestingTemplatesTable } from "./VestingTemplatesTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const template = (
  overrides: Partial<EquityVestingTemplate> & Pick<EquityVestingTemplate, "id" | "name">,
): EquityVestingTemplate => ({
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-01-06T00:00:00.000Z",
  ...overrides,
});

const templates = [
  template({ id: "vt-1", name: "Standard 4 year" }),
  template({
    id: "vt-2",
    name: "Final third",
    totalMonths: 36,
    cliffMonths: 0,
    tranches: [
      { monthOffset: 12, percent: "25" },
      { monthOffset: 24, percent: "25" },
      { monthOffset: 36, percent: "50" },
    ],
  }),
];

let root: ReturnType<typeof createRoot> | null = null;
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render() {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(<VestingTemplatesTable />);
    await flush();
  });
  return container;
}

it("renders each template's schedule and figures", async () => {
  rpcMock.list.mockResolvedValue({
    items: templates,
    total: templates.length,
    page: 1,
    pageSize: 100,
  });
  const container = await render();
  const content = container.textContent ?? "";
  expect(content).toContain("Standard 4 year");
  expect(content).toContain("1/48 monthly, 1 year cliff");
  expect(content).toContain("Custom (3 tranches)");
  expect(content).toContain("48");
  expect(content).toContain("—");
});

it("offers the add flow when there are no templates", async () => {
  rpcMock.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
  const container = await render();
  expect(container.textContent).toContain("No vesting templates yet");
  expect(container.textContent).toContain("Add template");
});

it("reports a failed load with a retry", async () => {
  rpcMock.list.mockRejectedValue(new Error("The vesting templates are unavailable."));
  const container = await render();
  expect(container.textContent).toContain("The vesting templates are unavailable.");
  expect(container.textContent).toContain("Try again");
});
