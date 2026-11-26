import { describe, expect, it } from "vitest";
import { demoLedger } from "./demo-ledger.js";

/** Whole dollars to cents, so the bounds below read as dollars. */
const dollars = (value: number) => BigInt(value) * 100n;

describe("demo ledger convertible terms", () => {
  it("gives every capped SAFE and note a seed-stage cap, in cents, above its principal", () => {
    for (const row of demoLedger().convertibles) {
      if (row.valuationCapCents == null) continue;
      const cap = BigInt(row.valuationCapCents);
      // A cap is a company valuation: between $1M and $100M for this seed-to-B company.
      expect(cap >= dollars(1_000_000) && cap <= dollars(100_000_000), row.label).toBe(true);
      expect(cap > BigInt(row.principalCents), row.label).toBe(true);
    }
  });
});
