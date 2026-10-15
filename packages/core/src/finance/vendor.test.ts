import { describe, expect, it } from "vitest";
import { categorySlug, vendorKey } from "./vendor.js";

describe("vendorKey", () => {
  it("drops legal suffixes, punctuation and case", () => {
    expect(vendorKey("Brex Inc.")).toBe("brex");
    expect(vendorKey("BREX")).toBe("brex");
    expect(vendorKey("Vercel Inc")).toBe("vercel");
    expect(vendorKey("Example Legal LLP")).toBe("example-legal");
    expect(vendorKey("Google Workspace")).toBe("google-workspace");
  });
  it("cuts processor suffixes after * or #", () => {
    expect(vendorKey("MODAL*LABS #4412")).toBe("modal");
  });
  it("never returns an empty key", () => {
    expect(vendorKey("  ")).toBe("unknown");
    expect(vendorKey("***")).toBe("unknown");
  });
});

describe("categorySlug", () => {
  it("slugifies the provider category", () => {
    expect(categorySlug("Credit & Loan Payments")).toBe("credit-loan-payments");
    expect(categorySlug("Payroll")).toBe("payroll");
  });
  it("uses uncategorized for none", () => {
    expect(categorySlug(null)).toBe("uncategorized");
    expect(categorySlug("  ")).toBe("uncategorized");
  });
});
