import { describe, expect, it } from "vitest";
import {
  divRoundHalfUp,
  formatFixed,
  formatInt,
  parseCents,
  parseFixed,
  parseShares,
  percentOf,
  SCALE,
  sharesTimesPrice,
} from "./fixed.js";

describe("parseShares and parseCents", () => {
  it("parses whole non-negative integers, including values past 2^53", () => {
    expect(parseShares("0")).toBe(0n);
    expect(parseShares("12500000")).toBe(12_500_000n);
    expect(parseShares("9007199254740993")).toBe(9_007_199_254_740_993n);
    expect(parseCents("150000000")).toBe(150_000_000n);
    expect(parseCents("123456789012345678901234567890")).toBe(123456789012345678901234567890n);
  });

  it("rejects anything that is not a whole non-negative integer", () => {
    for (const value of ["", "-1", "+1", "1.5", "1e3", " 12", "12 ", "one", "0x10"]) {
      expect(() => parseShares(value)).toThrow();
      expect(() => parseCents(value)).toThrow();
    }
  });

  it("formats round trips", () => {
    expect(formatInt(9_007_199_254_740_993n)).toBe("9007199254740993");
    expect(parseShares(formatInt(42n))).toBe(42n);
  });
});

describe("parseFixed and formatFixed", () => {
  it("scales up to 10 places", () => {
    expect(SCALE).toBe(10_000_000_000n);
    expect(parseFixed("1.25")).toBe(12_500_000_000n);
    expect(parseFixed("0")).toBe(0n);
    expect(parseFixed("12.3456")).toBe(123_456_000_000n);
    expect(parseFixed("1.0000000001")).toBe(10_000_000_001n);
  });

  it("rejects more than 10 places and malformed values", () => {
    for (const value of ["1.00000000001", "-1", ".5", "1.", "", "1,5", "1e3"]) {
      expect(() => parseFixed(value)).toThrow();
    }
  });

  it("formats with exactly the asked places and half-up rounding", () => {
    expect(formatFixed(123_456_000_000n, 4)).toBe("12.3456");
    expect(formatFixed(12_500_000_000n)).toBe("1.2500000000");
    expect(formatFixed(0n, 2)).toBe("0.00");
    expect(formatFixed(0n, 0)).toBe("0");
    expect(formatFixed(25_000_000_000n, 0)).toBe("3");
    expect(formatFixed(15_000_000_000n, 0)).toBe("2");
    expect(formatFixed(-25_000_000_000n, 0)).toBe("-3");
    expect(formatFixed(500_000n, 4)).toBe("0.0001");
    expect(formatFixed(499_999n, 4)).toBe("0.0000");
    expect(formatFixed(10_000_000_000n, 4)).toBe("1.0000");
  });

  it("rejects places outside 0..10", () => {
    expect(() => formatFixed(0n, 11)).toThrow();
    expect(() => formatFixed(0n, -1)).toThrow();
    expect(() => formatFixed(0n, 1.5)).toThrow();
  });
});

describe("percentOf", () => {
  it("returns a decimal percent, 4 places by default", () => {
    expect(percentOf(1n, 3n)).toBe("33.3333");
    expect(percentOf(2n, 3n)).toBe("66.6667");
    expect(percentOf(1n, 8n, 2)).toBe("12.50");
    expect(percentOf(5n, 5n)).toBe("100.0000");
    expect(percentOf(0n, 5n)).toBe("0.0000");
  });

  it("returns zero percent for a zero denominator instead of dividing", () => {
    expect(percentOf(7n, 0n)).toBe("0.0000");
    expect(percentOf(7n, 0n, 0)).toBe("0");
  });

  it("handles values past 2^53", () => {
    expect(percentOf(9_007_199_254_740_993n, 18_014_398_509_481_986n)).toBe("50.0000");
  });
});

describe("sharesTimesPrice", () => {
  it("multiplies shares by a dollar price into cents, half-up", () => {
    expect(sharesTimesPrice(1_000n, parseFixed("1.25"))).toBe(125_000n);
    expect(sharesTimesPrice(1n, parseFixed("0.005"))).toBe(1n);
    expect(sharesTimesPrice(1n, parseFixed("0.0049999999"))).toBe(0n);
    expect(sharesTimesPrice(9_007_199_254_740_993n, parseFixed("0.01"))).toBe(
      9_007_199_254_740_993n,
    );
  });
});

describe("divRoundHalfUp", () => {
  it("rounds half away from zero", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(4n, 2n)).toBe(2n);
    expect(divRoundHalfUp(1n, 2n)).toBe(1n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(5n, -2n)).toBe(-3n);
    expect(divRoundHalfUp(-1n, 3n)).toBe(0n);
  });

  it("throws on a zero denominator", () => {
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
  });
});
