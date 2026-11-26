// @vitest-environment jsdom

import type { EquityWarrant } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
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
  warrants: { list: vi.fn(), create: vi.fn(), cancel: vi.fn() },
  stakeholders: { list: vi.fn() },
  shareClasses: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { WarrantsTable } from "./WarrantsTable";

const demoWarrant = (overrides: Partial<EquityWarrant> = {}): EquityWarrant => ({
  id: "warrant-1",
  label: "W-1",
  stakeholderId: "sh-1",
  stakeholderName: "Ada Example",
  shareClassId: "sc-common",
  shareClassName: "Common",
  quantity: "50000",
  exercisePrice: "0.25",
  issueDate: "2025-03-04",
  expirationDate: "2035-03-04",
  status: "outstanding",
  canceledOn: null,
  adminNotes: null,
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
  ...overrides,
});

const page = (items: EquityWarrant[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  setHideAmounts(false);
  vi.clearAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

it("lists warrants with their holder, class, status and terms", async () => {
  rpcMock.warrants.list.mockResolvedValue(
    page([
      demoWarrant(),
      demoWarrant({
        id: "warrant-2",
        label: "W-2",
        stakeholderName: "Grace Example",
        shareClassName: "Preferred",
        status: "canceled",
        canceledOn: "2025-06-01",
        quantity: "12000",
        exercisePrice: "0.40",
      }),
    ]),
  );
  const container = await mount(<WarrantsTable />);
  const rows = container.querySelectorAll("[data-warrant-id]");
  expect(rows).toHaveLength(2);
  expect(container.textContent).toContain("Ada Example");
  expect(container.textContent).toContain("50,000");
  expect(container.textContent).toContain("$0.25");
  expect(container.textContent).toContain("Outstanding");
  expect(container.textContent).toContain("Grace Example");
  expect(container.textContent).toContain("Canceled");
  expect(container.textContent).toContain("Mar 4, 2025");
  expect(container.querySelector('[aria-label="Actions for W-1"]')).not.toBeNull();
  await act(async () => setHideAmounts(true));
  expect(container.textContent).toContain("$•••");
  expect(container.textContent).not.toContain("$0.25");
  await act(async () => setHideAmounts(false));
  expect(container.textContent).toContain("$0.25");
});

it("shows the empty state with a way to issue the first warrant", async () => {
  rpcMock.warrants.list.mockResolvedValue(page([]));
  const container = await mount(<WarrantsTable />);
  expect(container.textContent).toContain("No warrants yet");
  expect(container.textContent).toContain("Issue warrant");
});

it("opens the issue dialog from the toolbar", async () => {
  rpcMock.warrants.list.mockResolvedValue(page([]));
  rpcMock.stakeholders.list.mockResolvedValue({
    items: [{ id: "sh-1", name: "Ada Example" }],
    total: 1,
    page: 1,
    pageSize: 500,
  });
  rpcMock.shareClasses.list.mockResolvedValue({
    items: [{ id: "sc-common", name: "Common" }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  await mount(<WarrantsTable />);
  const issue = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === "Issue warrant",
  ) as HTMLButtonElement;
  await act(async () => {
    issue.click();
    await flush();
  });
  expect(document.getElementById("warrant-holder")).not.toBeNull();
});
