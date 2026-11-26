import { describe, expect, it } from "vitest";
import { EquityCents, EquityShares } from "./common.js";

const MAX_POSTGRES_BIGINT = "9223372036854775807";

describe("equity BIGINT wire primitives", () => {
  it("accepts zero and the largest signed PostgreSQL BIGINT", () => {
    for (const schema of [EquityShares, EquityCents]) {
      expect(schema.safeParse("0").success).toBe(true);
      expect(schema.safeParse(MAX_POSTGRES_BIGINT).success).toBe(true);
    }
  });

  it("rejects empty, negative, malformed, and out-of-range values", () => {
    for (const schema of [EquityShares, EquityCents]) {
      expect(schema.safeParse("").success).toBe(false);
      expect(schema.safeParse("-1").success).toBe(false);
      expect(schema.safeParse("1.5").success).toBe(false);
      expect(schema.safeParse("9223372036854775808").success).toBe(false);
    }
  });
});
