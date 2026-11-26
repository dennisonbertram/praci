import type { EquityCertificate } from "@rakazo/contracts";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("../../../lib/rpc", () => ({ rpc: {} }));

import { transactionForm, transactionProblem } from "./CertificateTransactionDialog";

const certificate = {
  quantity: "1000",
  stakeholderId: "sh-1",
  issueDate: "2025-01-01",
} as EquityCertificate;
const form = {
  toStakeholderId: "sh-2",
  newStakeholderName: "",
  toShareClassId: "",
  quantity: "400",
  effectiveDate: "2026-03-01",
  reason: "gift",
  pricePerShare: "",
  ratio: "1",
  note: "",
};

it("accepts a partial transfer to a chosen stakeholder", () => {
  expect(transactionProblem("transfer", certificate, form)).toBeNull();
});

it("refuses more shares than the certificate holds, zero shares and a bad price", () => {
  expect(transactionProblem("cancel", certificate, { ...form, quantity: "1001" })).toContain(
    "1,000",
  );
  expect(transactionProblem("cancel", certificate, { ...form, quantity: "0" })).not.toBeNull();
  expect(
    transactionProblem("repurchase", certificate, { ...form, pricePerShare: "1.2.3" }),
  ).not.toBeNull();
});

it("needs a recipient name for a new stakeholder and a class and ratio to convert", () => {
  expect(
    transactionProblem("transfer", certificate, { ...form, toStakeholderId: "__new" }),
  ).not.toBeNull();
  expect(transactionProblem("convert", certificate, form)).not.toBeNull();
  expect(
    transactionProblem("convert", certificate, { ...form, toShareClassId: "sc-a", ratio: "0" }),
  ).not.toBeNull();
  expect(
    transactionProblem("convert", certificate, { ...form, toShareClassId: "sc-a", ratio: "0.5" }),
  ).toBeNull();
});

it("starts with no reason and needs one before review where the action has reasons", () => {
  for (const action of ["transfer", "repurchase", "cancel", "modify"] as const) {
    expect(transactionForm(action, certificate).reason, action).toBe("");
    expect(transactionProblem(action, certificate, { ...form, reason: "" }), action).toBe(
      "Choose a reason",
    );
  }
  expect(
    transactionProblem("convert", certificate, { ...form, toShareClassId: "sc-a", reason: "" }),
  ).toBeNull();
});
