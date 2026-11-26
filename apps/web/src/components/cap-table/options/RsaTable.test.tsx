// @vitest-environment jsdom

import type { EquityCertificate } from "@rakazo/contracts";
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
  planPools: { list: vi.fn() },
  certificates: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  exercises: { list: vi.fn() },
  stakeholders: { list: vi.fn() },
  plans: { get: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { RsaDialog } from "./RsaDialog";
import { RsaTable } from "./RsaTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const certificate = (overrides: Partial<EquityCertificate> = {}): EquityCertificate => ({
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
  ...overrides,
});

const page = <Item,>(items: Item[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  setHideAmounts(false);
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

it("lists plan certificates and excludes option exercise certificates", async () => {
  rpcMock.planPools.list.mockResolvedValue([
    {
      planId: "plan-1",
      name: "2026 Stock Plan",
      status: "active",
      reservedShares: "1000000",
      grantedShares: "400000",
      outstandingShares: "300000",
      exercisedShares: "50000",
      returnedShares: "50000",
      issuedShares: "50000",
      availableShares: "650000",
      increases: [],
    },
  ]);
  rpcMock.certificates.list.mockResolvedValue(
    page([
      certificate(),
      certificate({ id: "cert-2", label: "CS-2", stakeholderName: "Riley Okafor" }),
    ]),
  );
  rpcMock.exercises.list.mockResolvedValue(
    page([
      {
        id: "ex-1",
        optionGrantId: "grant-1",
        optionGrantLabel: "ISO-1",
        quantity: "1000",
        exerciseDate: "2026-02-10",
        status: "completed",
        paymentCents: 100,
        requestKey: null,
        certificateId: "cert-2",
        createdAt: "2026-02-10T00:00:00.000Z",
        updatedAt: "2026-02-10T00:00:00.000Z",
      },
    ]),
  );
  rpcMock.stakeholders.list.mockResolvedValue(page([{ id: "sh-1", name: "Avery Chen" }]));

  const container = await mount(<RsaTable />);
  expect(rpcMock.certificates.list).toHaveBeenCalledWith({ planId: ["plan-1"], pageSize: 500 });
  expect(container.textContent).toContain("CS-1");
  expect(container.textContent).toContain("2026 Stock Plan");
  expect(container.textContent).not.toContain("CS-2");
  expect(container.textContent).not.toContain("Riley Okafor");
  expect(container.textContent).toContain("Feb 1, 2026");
  expect(container.querySelector('[aria-label="Actions for CS-1"]')).not.toBeNull();
  expect(container.textContent).toContain("$0.001");
  await act(async () => setHideAmounts(true));
  expect(container.textContent).toContain("$•••");
  expect(container.textContent).not.toContain("$0.001");
  await act(async () => setHideAmounts(false));
  expect(container.textContent).toContain("$0.001");
});

it("issues an RSA under the plan's share class after the review step", async () => {
  rpcMock.planPools.list.mockResolvedValue([
    {
      planId: "plan-1",
      name: "2026 Stock Plan",
      status: "active",
      reservedShares: "1000000",
      grantedShares: "400000",
      outstandingShares: "300000",
      exercisedShares: "50000",
      returnedShares: "50000",
      issuedShares: "0",
      availableShares: "650000",
      increases: [],
    },
  ]);
  rpcMock.certificates.list.mockResolvedValue(page([]));
  rpcMock.exercises.list.mockResolvedValue(page([]));
  rpcMock.stakeholders.list.mockResolvedValue(page([{ id: "sh-1", name: "Avery Chen" }]));
  rpcMock.plans.get.mockResolvedValue({ id: "plan-1", shareClassId: "sc-common" });
  rpcMock.certificates.create.mockResolvedValue(certificate());

  await mount(<RsaTable />);
  await act(async () => button("Issue RSA")?.click());
  await act(async () => type("rsa-quantity", "50000"));
  await act(async () => type("rsa-price", "0.001"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("50,000");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.plans.get).toHaveBeenCalledWith({ id: "plan-1" });
  expect(rpcMock.certificates.create).toHaveBeenCalledWith({
    requestKey: expect.any(String),
    stakeholderId: "sh-1",
    planId: "plan-1",
    shareClassId: "sc-common",
    quantity: "50000",
    pricePerShare: "0.001",
    issueDate: expect.any(String),
  });
  expect(rpcMock.certificates.list).toHaveBeenCalledTimes(2);
});

it("cancels an RSA through the update call", async () => {
  rpcMock.certificates.update.mockResolvedValue(certificate({ status: "canceled" }));
  const onDone = vi.fn();
  await mount(
    <RsaDialog
      mode="cancel"
      certificate={certificate()}
      plans={[{ id: "plan-1", name: "2026 Stock Plan" }]}
      onClose={vi.fn()}
      onDone={onDone}
    />,
  );
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("CS-1");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.certificates.update).toHaveBeenCalledWith({
    id: "cert-1",
    status: "canceled",
    canceledOn: expect.any(String),
    reason: "amendment",
  });
  expect(onDone).toHaveBeenCalled();
});
