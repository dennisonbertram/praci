// @vitest-environment jsdom

import type { EquityWarrant } from "@rakazo/contracts";
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
  warrants: { create: vi.fn(), cancel: vi.fn() },
  stakeholders: { list: vi.fn() },
  shareClasses: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { WarrantDialog } from "./WarrantDialog";

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
  expirationDate: null,
  status: "outstanding",
  canceledOn: null,
  adminNotes: null,
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
  ...overrides,
});

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

it("issues a warrant with integer and decimal strings after review", async () => {
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
  rpcMock.warrants.create.mockResolvedValue(demoWarrant());
  const onSaved = vi.fn();
  await mount(<WarrantDialog mode="issue" onClose={vi.fn()} onSaved={onSaved} />);
  await act(async () => type("warrant-quantity", "12a"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => type("warrant-quantity", "50000"));
  await act(async () => type("warrant-price", "0.25"));
  await act(async () => type("warrant-issue-date", "2025-03-04"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("50,000");
  expect(document.body.textContent).toContain("$0.25");
  expect(document.body.textContent).toContain("Mar 4, 2025");
  expect(document.body.textContent).not.toContain("2025-03-04");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.warrants.create).toHaveBeenCalledWith({
    requestKey: expect.any(String),
    stakeholderId: "sh-1",
    shareClassId: "sc-common",
    quantity: "50000",
    exercisePrice: "0.25",
    issueDate: "2025-03-04",
    expirationDate: null,
  });
  expect(onSaved).toHaveBeenCalled();
});

it("cancels a warrant on a chosen date after review", async () => {
  rpcMock.warrants.cancel.mockResolvedValue(demoWarrant({ status: "canceled" }));
  const onSaved = vi.fn();
  await mount(
    <WarrantDialog mode="cancel" warrant={demoWarrant()} onClose={vi.fn()} onSaved={onSaved} />,
  );
  await act(async () => type("warrant-canceled-on", "2025-06-01"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("Cancellation date");
  expect(document.body.textContent).toContain("Jun 1, 2025");
  expect(document.body.textContent).not.toContain("2025-06-01");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.warrants.cancel).toHaveBeenCalledWith({
    id: "warrant-1",
    canceledOn: "2025-06-01",
  });
  expect(onSaved).toHaveBeenCalled();
});

it("shows the server's refusal", async () => {
  rpcMock.warrants.cancel.mockRejectedValue(new Error("Warrant already canceled"));
  await mount(
    <WarrantDialog mode="cancel" warrant={demoWarrant()} onClose={vi.fn()} onSaved={vi.fn()} />,
  );
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Warrant already canceled");
});
