import { describe, expect, it } from "vitest";
import { chainName, shortAddress, tokenAmount } from "./crypto-format";

describe("tokenAmount", () => {
  it("places the decimal point without floats", () => {
    expect(tokenAmount("1500000000000000000", 18)).toBe("1.5");
    expect(tokenAmount("123456789012345678901234567890", 18)).toBe("123,456,789,012.34567");
    expect(tokenAmount("2500000", 6)).toBe("2.5");
    expect(tokenAmount("7", 0)).toBe("7");
    expect(tokenAmount("0", 18)).toBe("0");
  });
  it("shows tiny balances instead of rounding them to zero", () => {
    expect(tokenAmount("1", 18)).toBe("<0.00001");
  });
});

it("shortens addresses and names chains", () => {
  expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  expect(chainName(8453)).toBe("Base");
  expect(chainName(999)).toBe("Chain 999");
});
