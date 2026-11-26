import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("../../../lib/rpc", () => ({ rpc: {} }));

import { toItem } from "./DraftSetEditor";

const row = {
  stakeholderId: "sh-1",
  shareClassId: "sc-1",
  quantity: "10,000",
  pricePerShare: "0.25",
  kind: "safe" as const,
  principal: "250,000",
  cap: "8,000,000",
  discount: "20",
  issueDate: "2026-01-02",
  isNew: true,
};

it("turns a shares row into a certificate create input", () => {
  expect(toItem("certificate", row)).toEqual({
    stakeholderId: "sh-1",
    shareClassId: "sc-1",
    quantity: "10000",
    issueDate: "2026-01-02",
    pricePerShare: "0.25",
    pricePaidPerShare: "0.25",
  });
});

it("preserves certificate price-paid and explicit cash terms", () => {
  expect(
    toItem("certificate", {
      ...row,
      pricePerShare: "0.50",
      original: {
        pricePaidPerShare: "0.10",
        cashPaidCents: "25000",
        vestingScheduleId: "vesting-schedule-id",
      },
      isNew: false,
    }),
  ).toMatchObject({
    pricePerShare: "0.50",
    pricePaidPerShare: "0.10",
    cashPaidCents: "25000",
    vestingScheduleId: "vesting-schedule-id",
  });
});

it("turns a SAFE row into a convertible create input with cents", () => {
  expect(toItem("convertible", row)).toMatchObject({
    kind: "safe",
    principalCents: "25000000",
    valuationCapCents: "800000000",
    discountPercent: "20",
  });
});

it("preserves hidden note terms and cap type", () => {
  expect(
    toItem("convertible", {
      ...row,
      original: {
        valuationCapCents: "800000000",
        valuationCapType: "pre_money",
        interestRate: "7.5",
        interestStartDate: "2025-02-01",
        interestType: "simple",
        mfn: true,
        proRata: true,
      },
      isNew: false,
    }),
  ).toMatchObject({
    valuationCapCents: "800000000",
    valuationCapType: "pre_money",
    interestRate: "7.5",
    interestStartDate: "2025-02-01",
    interestType: "simple",
    mfn: true,
    proRata: true,
  });
});

it("accepts backend-valid ten-decimal discounts", () => {
  expect(
    toItem("convertible", {
      ...row,
      discount: "20.1234567890",
      original: { discountPercent: "20.1234567890" },
      isNew: false,
    }),
  ).toMatchObject({ discountPercent: "20.1234567890" });
});

it("sends explicit nulls when nullable terms are cleared", () => {
  expect(
    toItem("convertible", {
      ...row,
      cap: "",
      discount: "",
      original: {
        valuationCapCents: "800000000",
        valuationCapType: "pre_money",
        discountPercent: "20",
      },
      isNew: false,
    }),
  ).toMatchObject({
    valuationCapCents: null,
    valuationCapType: null,
    discountPercent: null,
  });
});

it("defaults new certificate paid price to entered price", () => {
  expect(toItem("certificate", { ...row, original: {}, isNew: true })).toMatchObject({
    pricePerShare: "0.25",
    pricePaidPerShare: "0.25",
  });
});

it("preserves a null existing paid price instead of replacing it", () => {
  expect(
    toItem("certificate", {
      ...row,
      original: { pricePaidPerShare: null },
      isNew: false,
    }),
  ).toMatchObject({ pricePaidPerShare: null });
});

it("leaves an absent paid-price field absent on existing certificates", () => {
  const item = toItem("certificate", { ...row, original: {}, isNew: false });
  expect(item).not.toHaveProperty("pricePaidPerShare");
});

it("names what is missing", () => {
  expect(typeof toItem("certificate", { ...row, quantity: "0" })).toBe("string");
  expect(typeof toItem("convertible", { ...row, principal: "" })).toBe("string");
  expect(typeof toItem("certificate", { ...row, stakeholderId: "" })).toBe("string");
});
