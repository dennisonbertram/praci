// @vitest-environment jsdom

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
const rpcMock = vi.hoisted(() => ({
  certificate: vi.fn(),
  stakeholder: vi.fn(),
}));
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      certificates: { get: rpcMock.certificate },
      transactions: { list: () => Promise.resolve({ items: [], total: 0 }) },
      stakeholders: { get: rpcMock.stakeholder },
    },
  },
}));

import { SecurityRecord } from "./SecurityRecord";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
  document.body.innerHTML = "";
  setHideAmounts(false);
});

const certificate = {
  id: "cert-26",
  label: "CS-26",
  stakeholderId: "sh-1",
  stakeholderName: "Dev Example",
  shareClassName: "Common",
  status: "outstanding",
  quantity: "17500",
  pricePerShare: "0.1",
  pricePaidPerShare: "0.1",
  cashPaidCents: "175000",
  debtCanceledCents: "0",
  ipTransferredCents: "0",
  otherConsiderationCents: "0",
  transactionValueCents: "175000",
  issueDate: "2021-05-10",
  boardApprovedOn: null,
  issuedBy: null,
  rule144Date: null,
  legend: null,
  personnel: null,
};

it("fills Personnel from the stakeholder when nothing was recorded at issue", async () => {
  rpcMock.certificate.mockResolvedValue(certificate);
  rpcMock.stakeholder.mockResolvedValue({
    id: "sh-1",
    name: "Dev Example",
    contactEmail: "dev.example@example.test",
    relationship: "employee",
  });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <SecurityRecord
        kind="certificate"
        id="cert-26"
        onOpenChange={() => undefined}
        onCertificateAction={() => undefined}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(rpcMock.stakeholder).toHaveBeenCalledWith({ id: "sh-1" });
  expect(document.body.textContent).toContain("dev.example@example.test");
  expect(document.body.textContent).toContain("Employee");
});

it("masks certificate amounts and updates while the detail sheet is open", async () => {
  setHideAmounts(false);
  rpcMock.certificate.mockResolvedValue(certificate);
  rpcMock.stakeholder.mockResolvedValue(null);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<SecurityRecord kind="certificate" id="cert-26" onOpenChange={() => undefined} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(document.body.textContent).toContain("$1,750.00");
  await act(async () => setHideAmounts(true));
  expect(document.body.textContent).toContain("$•••");
  expect(document.body.textContent).not.toContain("$1,750.00");
  expect(document.body.textContent).toContain("17,500");
  await act(async () => setHideAmounts(false));
  expect(document.body.textContent).toContain("$1,750.00");
});
