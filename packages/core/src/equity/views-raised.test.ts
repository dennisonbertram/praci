import { expect, it } from "vitest";
import type { RaisedCertificate } from "./views-raised.js";
import { isRaisedConvertibleOn, raisedCents } from "./views-raised.js";

const cert = (over: Partial<RaisedCertificate> = {}) => ({
  shareClassId: "seed",
  roundId: "r-seed",
  cashPaidCents: 100_000n,
  ...over,
});

it("sums the consideration it is given and the convertible principal; conversion results are not new money", () => {
  const totals = raisedCents(
    [
      cert(),
      cert({ fromConvertible: true, cashPaidCents: 0n, debtCanceledCents: 50_000n }),
      cert({
        shareClassId: "common",
        roundId: null,
        cashPaidCents: 400n,
        ipTransferredCents: 100n,
      }),
    ],
    [
      { roundId: "r-safe", principalCents: 50_000n },
      { roundId: null, principalCents: 25_000n },
    ],
  );
  expect(totals.totalCents).toBe(100_000n + 500n + 50_000n + 25_000n);
  expect(totals.byClass.get("seed")).toBe(100_000n);
  expect(totals.byRound.get("r-seed")).toBe(100_000n);
  expect(totals.byRound.get("r-safe")).toBe(50_000n);
  expect(totals.convertiblesCents).toBe(75_000n);
});

it("counts a convertible on a date unless it was canceled by then", () => {
  const safe = { status: "canceled", issueDate: "2024-01-01", closedOn: "2024-09-01" };
  expect(isRaisedConvertibleOn(safe, "2024-06-01")).toBe(true);
  expect(isRaisedConvertibleOn(safe, "2024-09-01")).toBe(false);
  expect(isRaisedConvertibleOn(safe, "2023-12-31")).toBe(false);
  expect(isRaisedConvertibleOn({ ...safe, status: "converted" }, "2025-01-01")).toBe(true);
});
