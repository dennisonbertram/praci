// @vitest-environment jsdom

import type { EquityCertificate } from "@rakazo/contracts";
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
  certificates: { create: vi.fn(), update: vi.fn() },
  stakeholders: { list: vi.fn() },
  plans: { get: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { RsaDialog } from "./RsaDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const certificate: EquityCertificate = {
  id: "cert-1",
  label: "CS-1",
  stakeholderId: "sh-1",
  stakeholderName: "Avery Chen",
  shareClassId: "sc-common",
  shareClassName: "Common",
  planId: "plan-1",
  status: "outstanding",
  acceptanceStatus: "accepted",
  paperStatus: "electronic",
  quantity: "50000",
  pricePerShare: "0.001",
  pricePaidPerShare: "0.001",
  cashPaidCents: "5000",
  debtCanceledCents: "0",
  ipTransferredCents: "0",
  otherConsiderationCents: "0",
  transactionValueCents: "5000",
  costBasisCents: "5000",
  issueDate: "2026-02-01",
  canceledOn: null,
  originalAcquisitionDate: null,
  issuedBy: null,
  boardApprovedOn: null,
  rule144Date: null,
  federalExemption: null,
  stateExemption: null,
  stateOfResidency: null,
  legend: null,
  personnel: null,
  collateralized: false,
  vestingScheduleId: null,
  parentId: null,
  roundId: null,
  adminNotes: null,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

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

it("keeps review disabled until the quantity and price are valid", async () => {
  rpcMock.stakeholders.list.mockResolvedValue({
    items: [{ id: "sh-1", name: "Avery Chen" }],
    total: 1,
    page: 1,
    pageSize: 500,
  });
  await mount(
    <RsaDialog
      mode="issue"
      plans={[{ id: "plan-1", name: "2026 Stock Plan" }]}
      onClose={vi.fn()}
      onDone={vi.fn()}
    />,
  );
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => type("rsa-quantity", "12a"));
  await act(async () => type("rsa-price", "0.001"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => type("rsa-quantity", "50000"));
  expect(button("Review")?.disabled).toBe(false);
});

it("shows the server's refusal on the review step", async () => {
  rpcMock.stakeholders.list.mockResolvedValue({
    items: [{ id: "sh-1", name: "Avery Chen" }],
    total: 1,
    page: 1,
    pageSize: 500,
  });
  rpcMock.plans.get.mockResolvedValue({ id: "plan-1", shareClassId: "sc-common" });
  rpcMock.certificates.create.mockRejectedValue(new Error("Pool has 100 shares left"));
  await mount(
    <RsaDialog
      mode="issue"
      plans={[{ id: "plan-1", name: "2026 Stock Plan" }]}
      onClose={vi.fn()}
      onDone={vi.fn()}
    />,
  );
  await act(async () => type("rsa-quantity", "50000"));
  await act(async () => type("rsa-price", "0.001"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Pool has 100 shares left");
});

it("reviews the cancel date before confirming", async () => {
  const onDone = vi.fn();
  rpcMock.certificates.update.mockResolvedValue({ ...certificate, status: "canceled" });
  await mount(
    <RsaDialog
      mode="cancel"
      certificate={certificate}
      plans={[{ id: "plan-1", name: "2026 Stock Plan" }]}
      onClose={vi.fn()}
      onDone={onDone}
    />,
  );
  await act(async () => type("rsa-canceled-on", "2026-02-01"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("Canceled on");
  expect(document.body.textContent).toContain("Feb 1, 2026");
  expect(document.body.textContent).not.toContain("2026-02-01");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.certificates.update).toHaveBeenCalledWith(
    expect.objectContaining({ id: "cert-1", status: "canceled", reason: "amendment" }),
  );
  expect(onDone).toHaveBeenCalled();
});
