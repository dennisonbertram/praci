import { expect, it } from "vitest";
import { centsToDollars, dollarsToCents } from "./money";

it("parses dollars to cents exactly", () => {
  expect(dollarsToCents("1,250,000.50")).toBe("125000050");
  expect(dollarsToCents("$12")).toBe("1200");
  expect(dollarsToCents("0.5")).toBe("50");
  expect(dollarsToCents("1.234")).toBeNull();
  expect(dollarsToCents("-3")).toBeNull();
  expect(dollarsToCents("9007199254740993.01")).toBe("900719925474099301");
});

it("rejects commas that are not thousands separators", () => {
  expect(dollarsToCents("1,25")).toBeNull();
  expect(dollarsToCents("1,2500")).toBeNull();
  expect(dollarsToCents("1,250")).toBe("125000");
  expect(dollarsToCents("1,250.5")).toBe("125050");
  expect(dollarsToCents(" $ 12 ")).toBe("1200");
});

it("formats cents for an input box", () => {
  expect(centsToDollars("125000050")).toBe("1250000.50");
  expect(centsToDollars("1200")).toBe("12");
  expect(centsToDollars(null)).toBe("");
});

it("reads separators from the locale: decimal comma in de-DE", () => {
  expect(dollarsToCents("1,25", "de-DE")).toBe("125");
  expect(dollarsToCents("1.250,00", "de-DE")).toBe("125000");
  expect(dollarsToCents("1.250", "de-DE")).toBe("125000");
  expect(dollarsToCents("12", "de-DE")).toBe("1200");
  // Three decimals is never valid money, and "1,250" must not silently become 1250 dollars.
  expect(dollarsToCents("1,250", "de-DE")).toBeNull();
  expect(dollarsToCents("1,250.00", "de-DE")).toBeNull();
});

it("keeps en-US strict when a locale is given", () => {
  expect(dollarsToCents("1,250", "en-US")).toBe("125000");
  expect(dollarsToCents("1.250,00", "en-US")).toBeNull();
  expect(dollarsToCents("1,25", "en-US")).toBeNull();
});

it("round-trips centsToDollars through dollarsToCents in every locale", () => {
  for (const locale of ["en-US", "de-DE", "fr-FR"]) {
    for (const cents of ["0", "5", "1200", "125000050", "900719925474099301"]) {
      expect(dollarsToCents(centsToDollars(cents, locale), locale)).toBe(cents);
    }
  }
  expect(centsToDollars("125050", "de-DE")).toBe("1250,50");
});
