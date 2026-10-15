import { describe, expect, it } from "vitest";
import { formatPinValue, jsonPointerGet } from "./pins.js";

describe("jsonPointerGet", () => {
  const doc = { accounts: [{ balance: 1234.5 }], "a/b": { "m~n": "x" }, empty: null };
  it("walks objects and arrays and unescapes ~1 and ~0", () => {
    expect(jsonPointerGet(doc, "/accounts/0/balance")).toBe(1234.5);
    expect(jsonPointerGet(doc, "/a~1b/m~0n")).toBe("x");
    expect(jsonPointerGet(doc, "")).toBe(doc);
    expect(jsonPointerGet(doc, "/empty")).toBeNull();
  });
  it("throws when nothing is there", () => {
    for (const path of [
      "/nope",
      "/accounts/1",
      "/accounts/-",
      "/empty/x",
      "accounts",
      "/accounts/length",
    ]) {
      expect(() => jsonPointerGet(doc, path)).toThrow();
    }
  });
});

describe("formatPinValue", () => {
  it("formats usd without cents from 1,000", () => {
    expect(formatPinValue(1234.56, "usd")).toBe("$1,235");
    expect(formatPinValue(999.5, "usd")).toBe("$999.50");
    expect(formatPinValue("2500000", "usd")).toBe("$2,500,000");
    expect(formatPinValue(-1500, "usd")).toBe("-$1,500");
  });
  it("formats numbers, percents and text", () => {
    expect(formatPinValue(1234567, "number")).toBe("1,234,567");
    expect(formatPinValue(12.345, "percent")).toBe("12.3%");
    expect(formatPinValue("on track", "text")).toBe("on track");
    expect(formatPinValue({ a: 1 }, "text")).toBe('{"a":1}');
    expect(formatPinValue("x".repeat(60), "text")).toHaveLength(40);
  });
  it("rejects a non-number for a numeric format", () => {
    expect(() => formatPinValue("abc", "usd")).toThrow(/not a number/);
    expect(() => formatPinValue(null, "number")).toThrow();
  });
});
