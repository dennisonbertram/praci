import { describe, expect, it } from "vitest";
import {
  EquityConvertibleCreateInputSchema,
  EquityConvertibleUpdateInputSchema,
} from "./securities.js";

describe("equity convertible inputs", () => {
  it("rejects a 100 percent discount and accepts discounts below 100 percent", () => {
    const input = {
      label: "SAFE-1",
      stakeholderId: "holder-1",
      kind: "safe",
      principalCents: "100",
      issueDate: "2024-01-01",
    };

    expect(
      EquityConvertibleCreateInputSchema.safeParse({
        ...input,
        discountPercent: "99.9999999999",
      }).success,
    ).toBe(true);
    expect(
      EquityConvertibleCreateInputSchema.safeParse({ ...input, discountPercent: "100" }).success,
    ).toBe(false);
  });

  it("rejects malformed discounts without throwing from safeParse", () => {
    const input = {
      label: "SAFE-1",
      stakeholderId: "holder-1",
      kind: "safe",
      principalCents: "100",
      issueDate: "2024-01-01",
    };

    for (const discountPercent of ["abc", "1.2.3", "-1"]) {
      expect(() =>
        EquityConvertibleCreateInputSchema.safeParse({ ...input, discountPercent }),
      ).not.toThrow();
      expect(
        EquityConvertibleCreateInputSchema.safeParse({ ...input, discountPercent }).success,
      ).toBe(false);
    }
  });

  it("requires a cap type whenever a valuation cap is set", () => {
    const input = {
      label: "SAFE-1",
      stakeholderId: "holder-1",
      kind: "safe",
      principalCents: "100",
      issueDate: "2024-01-01",
      valuationCapCents: "1000000",
    };
    const create = (extra: object) =>
      EquityConvertibleCreateInputSchema.safeParse({ ...input, ...extra }).success;
    expect(create({})).toBe(false);
    expect(create({ valuationCapType: null })).toBe(false);
    expect(create({ valuationCapType: "post_money" })).toBe(true);
    expect(create({ valuationCapCents: null })).toBe(true);
    expect(create({ valuationCapCents: "0", valuationCapType: "pre_money" })).toBe(false);
    // A partial update may leave the stored type alone, but may not clear it.
    const update = (extra: object) =>
      EquityConvertibleUpdateInputSchema.safeParse({ id: "c-1", ...extra }).success;
    expect(update({ valuationCapCents: "1000000" })).toBe(true);
    expect(update({ valuationCapCents: "1000000", valuationCapType: null })).toBe(false);
  });
});
