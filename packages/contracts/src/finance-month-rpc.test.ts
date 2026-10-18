import { describe, expect, it } from "vitest";
import { appContract } from "./rpc.js";

const schemaOf = (proc: { "~orpc": { inputSchema?: unknown } }) =>
  proc["~orpc"].inputSchema as { safeParse(v: unknown): { success: boolean } };

describe("finance month inputs", () => {
  it("accept months 01-12 and reject 00 and 13", () => {
    const month = schemaOf(appContract.finance.month);
    const category = schemaOf(appContract.finance.category);
    for (const ok of ["2026-01", "2026-09", "2026-12"]) {
      expect(month.safeParse({ month: ok }).success).toBe(true);
      expect(category.safeParse({ slug: "x", month: ok }).success).toBe(true);
    }
    for (const bad of ["2026-00", "2026-13", "2026-99"]) {
      expect(month.safeParse({ month: bad }).success).toBe(false);
      expect(category.safeParse({ slug: "x", month: bad }).success).toBe(false);
    }
  });
});
