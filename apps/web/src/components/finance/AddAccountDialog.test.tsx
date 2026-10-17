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
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  statementUpload: vi.fn(),
  statementConfirm: vi.fn(),
  statementDiscard: vi.fn(),
  statements: vi.fn(),
  overview: vi.fn(),
  exchanges: vi.fn(),
  refresh: vi.fn(),
}));
const connectMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));
vi.mock("../../lib/finance-connect", () => ({ connectFinanceProvider: connectMock }));

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
const card = (title: string) =>
  [...dialog().querySelectorAll("button")].find(
    (b) => b.querySelector("[data-option-title]")?.textContent === title,
  ) as HTMLButtonElement;
const click = (label: string) =>
  act(async () =>
    (
      [...dialog().querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement
    ).click(),
  );
/** Answers the removal confirmation, which deleting an imported statement asks first. */
const confirmRemove = async () => {
  const alert = document.body.querySelector('[role="alertdialog"]') as HTMLElement;
  expect(alert.textContent).toContain("Its 4 transactions will be removed from Finance.");
  await act(async () =>
    (
      [...alert.querySelectorAll("button")].find((b) => b.textContent === "Remove") as HTMLElement
    ).click(),
  );
};
const open = async (initialStep?: "bank") => {
  await act(async () =>
    root.render(
      <AddAccountDialog
        initialStep={initialStep}
        onPickCrypto={initialStep ? undefined : onPickCrypto}
        onImported={onImported}
        onClose={onClose}
      />,
    ),
  );
  await act(async () => {});
};
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
  rpcMock.statements.mockResolvedValue({ statements: [], reminders: [] });
  rpcMock.overview.mockResolvedValue({ sources: [] });
  rpcMock.exchanges.mockResolvedValue([]);
  rpcMock.refresh.mockResolvedValue(null);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("shows every way to add an account at once, in Bank and Crypto groups", async () => {
  await open();
  const titles = [...dialog().querySelectorAll("[data-option-title]")].map((n) => n.textContent);
  expect(titles).toEqual(["Mercury", "Brex", "Upload statements", "Wallet", "Coinbase", "Kraken"]);
  expect([...dialog().querySelectorAll("h3")].map((h) => h.textContent)).toEqual([
    "Bank",
    "Crypto",
  ]);
  expect(dialog().textContent).toContain("Address or ENS");
  expect(dialog().textContent).toContain("Read-only API key");
});

it("routes wallet and exchange cards to the crypto flows", async () => {
  await open();
  await act(async () => card("Kraken").click());
  expect(onPickCrypto).toHaveBeenCalledWith("kraken");
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => card("Wallet").click());
  expect(onPickCrypto).toHaveBeenCalledWith("wallet");
});

it("connects Mercury through the finance flow, syncs, and only then reloads the page", async () => {
  connectMock.mockResolvedValue("connected");
  let synced = () => {};
  rpcMock.refresh.mockReturnValue(new Promise<void>((resolve) => (synced = resolve)));
  await open();
  await act(async () => card("Mercury").click());
  expect(connectMock).toHaveBeenCalledWith("mercury");
  // The page reloads after the sync, so it shows the new accounts rather than an empty list.
  expect(rpcMock.refresh).toHaveBeenCalled();
  expect(onImported).not.toHaveBeenCalled();
  await act(async () => synced());
  expect(onImported).toHaveBeenCalled();
});

it("shows why a connect did not finish", async () => {
  connectMock.mockResolvedValue("cancelled");
  await open();
  await act(async () => card("Brex").click());
  expect(dialog().querySelector('[role="alert"]')?.textContent).toContain("cancelled");
  expect(onClose).not.toHaveBeenCalled();
});

it("badges connected sources and disables their cards", async () => {
  rpcMock.overview.mockResolvedValue({
    sources: [{ provider: "mercury", serverId: null, status: "ok", lastSyncedAt: null }],
  });
  rpcMock.exchanges.mockResolvedValue([{ provider: "coinbase", connected: true }]);
  await open();
  expect(card("Mercury").textContent).toContain("Connected");
  expect(card("Mercury").disabled).toBe(true);
  expect(card("Coinbase").textContent).toContain("Connected");
  expect(card("Coinbase").disabled).toBe(true);
  expect(card("Brex").textContent).not.toContain("Connected");
  expect(card("Kraken").disabled).toBe(false);
  expect(card("Wallet").disabled).toBe(false);
});

it("opens the upload from its card, with Back to the options", async () => {
  await open();
  await act(async () => card("Upload statements").click());
  expect(dialog().querySelector('input[type="file"]')).not.toBeNull();
  await click("Back");
  expect(card("Mercury")).toBeTruthy();
});

it("imports each file as soon as it is read, grouped under one account", async () => {
  rpcMock.statementUpload.mockResolvedValueOnce(statement()).mockResolvedValueOnce(
    statement({
      id: "s2",
      fileName: "feb.pdf",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      createsAccount: false,
      duplicateCount: 2,
      warnings: ["Read by an AI model, not a bank format; review every line before importing."],
    }),
  );
  rpcMock.statementConfirm.mockResolvedValue(statement({ status: "imported" }));
  await open("bank");
  await choose(new File(["x"], "march.pdf"), new File(["y"], "feb.pdf"));
  expect(rpcMock.statementConfirm).toHaveBeenCalledTimes(2);
  expect(rpcMock.statementConfirm).toHaveBeenCalledWith({ id: "s1" });
  expect(onImported).toHaveBeenCalled();
  const text = dialog().textContent ?? "";
  // One header for the account, one row per period.
  expect(text.match(/Example Bank ••1234/g)).toHaveLength(1);
  expect(text.match(/New account/g)).toHaveLength(1);
  expect(text).toContain("$1,000.00 → $1,150.25");
  expect(text).toContain("4 transactions, 2 already imported");
  expect(text).toContain("The transactions read add up to the closing balance");
  expect(text).toContain("Read by an AI model");
  expect(text.match(/Imported/g)).toHaveLength(2);
  expect(labelsOf()).not.toContain("Import");
});

const labelsOf = () => [...dialog().querySelectorAll("button")].map((b) => b.textContent);

it("holds a statement whose balances do not add up until Import anyway", async () => {
  rpcMock.statementUpload.mockResolvedValue(
    statement({ check: { balances: "mismatch", differenceCents: -1_240 } }),
  );
  rpcMock.statementConfirm.mockResolvedValue(statement({ status: "imported" }));
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  expect(rpcMock.statementConfirm).not.toHaveBeenCalled();
  expect(onImported).not.toHaveBeenCalled();
  expect(dialog().textContent).toContain("Transactions are $12.40 off the closing balance");
  expect(dialog().textContent).not.toContain("Imported");
  await click("Import anyway");
  expect(rpcMock.statementConfirm).toHaveBeenCalledWith({ id: "s1", acceptMismatch: true });
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(dialog().textContent).toContain("Imported");
});

it("discards a held statement without importing it", async () => {
  rpcMock.statementUpload.mockResolvedValue(
    statement({ check: { balances: "mismatch", differenceCents: -1_240 } }),
  );
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  await click("Discard");
  expect(rpcMock.statementDiscard).toHaveBeenCalledWith({ id: "s1" });
  expect(rpcMock.statementConfirm).not.toHaveBeenCalled();
  expect(onImported).not.toHaveBeenCalled();
  expect(dialog().textContent).not.toContain("Example Bank");
});

it("lists statements uploaded before, so they can be found and removed later", async () => {
  rpcMock.statements.mockResolvedValue({
    statements: [
      statement({ id: "old", status: "imported", createsAccount: true }),
      statement({ id: "bad", status: "failed", fileName: "broken.pdf" }),
    ],
    reminders: [],
  });
  await open("bank");
  const text = dialog().textContent ?? "";
  expect(text).toContain("Example Bank ••1234");
  expect(text).toContain("Imported");
  expect(text).not.toContain("New account");
  expect(text).not.toContain("broken.pdf");
  await click("Remove");
  // Nothing is deleted until the removal is confirmed.
  expect(rpcMock.statementDiscard).not.toHaveBeenCalled();
  await confirmRemove();
  expect(rpcMock.statementDiscard).toHaveBeenCalledWith({ id: "old" });
  expect(onImported).toHaveBeenCalledTimes(1);
});

it("removes an imported statement and reloads", async () => {
  rpcMock.statementUpload.mockResolvedValue(statement());
  rpcMock.statementConfirm.mockResolvedValue(statement({ status: "imported" }));
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  onImported.mockClear();
  await click("Remove");
  await confirmRemove();
  expect(rpcMock.statementDiscard).toHaveBeenCalledWith({ id: "s1" });
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(dialog().textContent).not.toContain("Example Bank");
});

it("shows an unreadable file's reason and a wrong file type on that file's row", async () => {
  rpcMock.statementUpload.mockResolvedValue(
    statement({ status: "failed", error: "No model is configured to read this PDF" }),
  );
  await open("bank");
  await choose(new File(["x"], "other.pdf"), new File(["x"], "notes.txt"));
  expect(rpcMock.statementUpload).toHaveBeenCalledTimes(1);
  expect(rpcMock.statementConfirm).not.toHaveBeenCalled();
  expect(dialog().textContent).toContain("No model is configured to read this PDF");
  expect(dialog().textContent).toContain("Upload a PDF, CSV, OFX or QFX file");
});

it("shows a rejected import (for example a duplicate) on its row and discards the upload", async () => {
  rpcMock.statementUpload.mockResolvedValue(statement());
  rpcMock.statementConfirm.mockRejectedValue(new Error("This statement is already imported"));
  await open("bank");
  await choose(new File(["x"], "march.pdf"));
  expect(dialog().textContent).toContain("This statement is already imported");
  expect(rpcMock.statementDiscard).toHaveBeenCalledWith({ id: "s1" });
});

it("names a renamed account by its current name and says when there is no balance to check", async () => {
  rpcMock.statements.mockResolvedValue({
    statements: [
      statement({
        id: "old",
        status: "imported",
        accountId: "acc-1",
        accountName: "Backup bank",
        check: { balances: "unavailable", differenceCents: null },
      }),
    ],
    reminders: [],
  });
  await open("bank");
  const text = dialog().textContent ?? "";
  expect(text).toContain("Backup bank ••1234");
  expect(text).not.toContain("Example Bank");
  expect(text).toContain("No closing balance found to check against");
  expect(text).not.toContain("add up");
});

it("says a file the browser cannot read could not be read, not the browser's own error", async () => {
  const real = globalThis.FileReader;
  class Failing {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    error = new DOMException(
      "The requested file could not be read, typically due to permission problems",
    );
    readAsDataURL() {
      setTimeout(() => this.onerror?.(), 0);
    }
  }
  globalThis.FileReader = Failing as unknown as typeof FileReader;
  try {
    await open("bank");
    await choose(new File(["x"], "march.csv"));
    expect(dialog().textContent).toContain("Could not read this file");
    expect(dialog().textContent).not.toContain("permission");
    expect(rpcMock.statementUpload).not.toHaveBeenCalled();
  } finally {
    globalThis.FileReader = real;
  }
});
