// @vitest-environment jsdom

import type { FinanceStatement } from "@rakazo/contracts";
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
const rpcMock = vi.hoisted(() => ({
  statementUpload: vi.fn(),
  statementConfirm: vi.fn(),
  statementDiscard: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { AddAccountDialog } from "./AddAccountDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const statement = (over: Partial<FinanceStatement> = {}): FinanceStatement => ({
  id: "s1",
  accountId: null,
  fileName: "march.pdf",
  format: "pdf",
  status: "review",
  institution: "Example Bank",
  accountLast4: "1234",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
  openingBalanceCents: 100_000,
  closingBalanceCents: 115_025,
  transactionCount: 4,
  check: { balances: "match", differenceCents: 0 },
  createsAccount: true,
  duplicateCount: 0,
  warnings: [],
  error: null,
  uploadedAt: "2026-10-15T00:00:00.000Z",
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onPickCrypto = vi.fn();
const onImported = vi.fn();
const onClose = vi.fn();
const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement;
const labels = () => [...dialog().querySelectorAll("button")].map((b) => b.textContent);
const click = (label: string) =>
  act(async () =>
    ([...dialog().querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement).click(),
  );
const open = (initialStep?: "bank") =>
  act(async () =>
    root.render(
      <AddAccountDialog
        initialStep={initialStep}
        onPickCrypto={initialStep ? undefined : onPickCrypto}
        onImported={onImported}
        onClose={onClose}
      />,
    ),
  );
const choose = async (...files: File[]) => {
  const input = dialog().querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  // FileReader finishes on a real timer.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.statementDiscard.mockResolvedValue({ ok: true });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
  onPickCrypto.mockReset();
});

it("offers Crypto and Bank account, then the three crypto choices", async () => {
  await open();
  expect(labels()).toEqual(["Crypto", "Bank account", "Cancel", "Close"]);
  await click("Crypto");
  expect(labels()).toEqual(["Crypto wallet", "Coinbase", "Kraken", "Back", "Cancel", "Close"]);
  await click("Kraken");
  expect(onPickCrypto).toHaveBeenCalledWith("kraken");
  expect(onClose).toHaveBeenCalled();
});

it("uploads several files, shows each review, and imports one", async () => {
  rpcMock.statementUpload
    .mockResolvedValueOnce(statement())
    .mockResolvedValueOnce(
      statement({
        id: "s2",
        fileName: "feb.pdf",
        createsAccount: false,
        duplicateCount: 2,
        warnings: ["Read by an AI model, not a bank format; review every line before importing."],
      }),
    );
  rpcMock.statementConfirm.mockResolvedValue(statement({ status: "imported" }));
  await open();
  await click("Bank account");
  await choose(new File(["x"], "march.pdf"), new File(["y"], "feb.pdf"));
  expect(rpcMock.statementUpload).toHaveBeenCalledTimes(2);
  const text = dialog().textContent ?? "";
  expect(text).toContain("Example Bank ••1234");
  expect(text).toContain("New account");
  expect(text).toContain("$1,000.00 → $1,150.25");
  expect(text).toContain("4 transactions, 2 already imported");
  expect(text).toContain("Balances match");
  expect(text).toContain("Read by an AI model");

  await click("Import");
  expect(rpcMock.statementConfirm).toHaveBeenCalledWith({ id: "s1" });
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(dialog().textContent).toContain("Imported");
});

it("makes a balance mismatch an explicit Import anyway", async () => {
  rpcMock.statementUpload.mockResolvedValue(
    statement({ check: { balances: "mismatch", differenceCents: -1_000 } }),
  );
  rpcMock.statementConfirm.mockResolvedValue(statement({ status: "imported" }));
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  expect(dialog().textContent).toContain("Balances differ by $10.00");
  expect(labels()).not.toContain("Import");
  await click("Import anyway");
  expect(rpcMock.statementConfirm).toHaveBeenCalledWith({ id: "s1", acceptMismatch: true });
});

it("shows an unreadable file's reason and a wrong file type without uploading it", async () => {
  rpcMock.statementUpload.mockResolvedValue(
    statement({ status: "failed", error: "No model is configured to read this PDF" }),
  );
  await open("bank");
  await choose(new File(["x"], "other.pdf"), new File(["x"], "notes.txt"));
  expect(rpcMock.statementUpload).toHaveBeenCalledTimes(1);
  expect(dialog().textContent).toContain("No model is configured to read this PDF");
  expect(dialog().textContent).toContain("Upload a PDF, CSV, OFX or QFX file");
});

it("discards a statement left in review when the dialog closes", async () => {
  rpcMock.statementUpload.mockResolvedValue(statement());
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  await act(async () => root.unmount());
  expect(rpcMock.statementDiscard).toHaveBeenCalledWith({ id: "s1" });
  root = createRoot(container);
});
