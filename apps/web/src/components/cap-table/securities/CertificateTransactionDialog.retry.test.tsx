// @vitest-environment jsdom

import type { EquityCertificate } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
const rpcMock = vi.hoisted(() => ({
  equity: {
    stakeholders: { list: vi.fn(), create: vi.fn() },
    shareTransactions: { transfer: vi.fn() },
  },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: rpcMock }));

import { CertificateTransactionDialog } from "./CertificateTransactionDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const certificate = {
  id: "cert-1",
  label: "CS-1",
  quantity: "1000",
  stakeholderId: "sh-1",
  shareClassId: "sc-1",
  issueDate: "2025-01-01",
} as EquityCertificate;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  rpcMock.equity.stakeholders.list.mockReset().mockResolvedValue({ items: [] });
  rpcMock.equity.stakeholders.create.mockReset().mockResolvedValue({ id: "sh-new" });
  rpcMock.equity.shareTransactions.transfer.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const fill = async (id: string, value: string) => {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
};
const press = async (label: string) => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
  await act(async () => button.click());
};

it("retries a transfer to a new stakeholder with the keys of the first attempt", async () => {
  rpcMock.equity.shareTransactions.transfer
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce({ transactionId: "t1", kind: "transfer", resulting: [] });
  const onDone = vi.fn();
  await act(async () =>
    root.render(
      <CertificateTransactionDialog
        action="transfer"
        certificate={certificate}
        onOpenChange={vi.fn()}
        onDone={onDone}
      />,
    ),
  );
  await fill("tx-to", "__new");
  await fill("tx-new-name", "Cy Example");
  await fill("tx-reason", "gift");
  await press("Review");
  await press("Confirm");
  expect(onDone).not.toHaveBeenCalled();
  await press("Confirm");
  expect(onDone).toHaveBeenCalledTimes(1);

  const [firstHolder, secondHolder] = rpcMock.equity.stakeholders.create.mock.calls.map(
    ([arg]) => arg,
  );
  expect(firstHolder.requestKey).toEqual(expect.any(String));
  expect(secondHolder.requestKey).toBe(firstHolder.requestKey);
  const [firstMove, secondMove] = rpcMock.equity.shareTransactions.transfer.mock.calls.map(
    ([arg]) => arg,
  );
  expect(firstMove.requestKey).toEqual(expect.any(String));
  expect(secondMove.requestKey).toBe(firstMove.requestKey);
  expect(firstMove.requestKey).not.toBe(firstHolder.requestKey);
});
