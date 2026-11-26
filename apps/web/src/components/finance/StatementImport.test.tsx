// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { FinanceStatement } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const statements = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: {
    finance: {
      statements,
      statementUpload: vi.fn(),
      statementConfirm: vi.fn(),
      statementDiscard: vi.fn(),
    },
  },
}));

import { StatementImport } from "./StatementImport";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  statements.mockReset();
});

const imported: FinanceStatement = {
  id: "stmt_1",
  accountId: "acc_1",
  fileName: "january-demo.csv",
  format: "csv",
  status: "imported",
  institution: "Demo Bank",
  accountLast4: "0000",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalanceCents: 100_000,
  closingBalanceCents: 90_000,
  transactionCount: 12,
  check: { balances: "match", differenceCents: 0 },
  createsAccount: false,
  duplicateCount: 0,
  warnings: [],
  error: null,
  uploadedAt: "2026-02-01T00:00:00.000Z",
};

const settle = () => act(async () => undefined);
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);
const occurrences = (needle: string) => (document.body.textContent ?? "").split(needle).length - 1;

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <I18nProvider i18n={i18n}>
        <StatementImport onImported={() => undefined} />
      </I18nProvider>,
    ),
  );
  await settle();
}

it("shows a retry when earlier statements fail to load, and lists them once after it", async () => {
  statements.mockRejectedValueOnce(new Error("down"));
  await mount();
  expect(document.body.textContent).toContain("Could not load");
  expect(document.body.textContent).not.toContain("12 transactions");

  statements.mockResolvedValueOnce({ statements: [imported], reminders: [] });
  await act(async () => button("Try again")?.click());
  await settle();
  expect(document.body.textContent).not.toContain("Could not load");
  expect(button("Try again")).toBeUndefined();
  expect(occurrences("12 transactions")).toBe(1);
});

it("uploads while the list failed, and a later retry does not list that statement twice", async () => {
  const { rpc } = await import("../../lib/rpc");
  statements.mockRejectedValueOnce(new Error("down"));
  await mount();
  vi.mocked(rpc.finance.statementUpload).mockResolvedValueOnce({ ...imported, status: "review" });
  vi.mocked(rpc.finance.statementConfirm).mockResolvedValueOnce(null as never);
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  const file = new File(["a,b"], "january-demo.csv", { type: "text/csv" });
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () => input?.dispatchEvent(new Event("change", { bubbles: true })));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(occurrences("12 transactions")).toBe(1);

  statements.mockResolvedValueOnce({ statements: [imported], reminders: [] });
  await act(async () => button("Try again")?.click());
  await settle();
  expect(occurrences("12 transactions")).toBe(1);
});

it("keeps the message when the retry fails too", async () => {
  statements.mockRejectedValue(new Error("down"));
  await mount();
  await act(async () => button("Try again")?.click());
  await settle();
  expect(document.body.textContent).toContain("Could not load");
});
