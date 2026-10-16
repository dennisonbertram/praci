import { describe, expect, it } from "vitest";
import { asRecord, isRecord } from "./record.js";

describe("record helpers", () => {
  it("accepts only plain objects", () => {
    const value = { a: 1 };
    expect(isRecord(value)).toBe(true);
    expect(asRecord(value)).toBe(value);
    for (const other of [null, undefined, [], [1], "x", 3, true]) {
      expect(isRecord(other)).toBe(false);
      expect(asRecord(other)).toBeUndefined();
    }
  });
});
