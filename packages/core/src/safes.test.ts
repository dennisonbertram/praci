import { describe, expect, it } from "vitest";
import { atCapPercent, atCapSum, isActiveSafe, needsAttention, safeStatus } from "./safes.js";

const base = {
  source: "native" as const,
  amountCents: 5_000_000,
  capCents: 100_000_000 as number | null,
  valuationType: "post_money_cap",
  discountPercent: null as number | null,
  mfn: false,
  sentAt: null as string | null,
  signedByOwnerAt: null as string | null,
  signedByInvestorAt: null as string | null,
  paidAt: null as string | null,
  expiresAt: null as string | null,
  canceledAt: null as string | null,
};
const now = new Date("2026-10-21T12:00:00.000Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("safeStatus", () => {
  it("is Draft until sent, then follows the timestamps", () => {
    expect(safeStatus(base, now)).toBe("draft");
    expect(safeStatus({ ...base, sentAt: day(1) }, now)).toBe("sent");
    const signed = { ...base, sentAt: day(3), signedByOwnerAt: day(2), signedByInvestorAt: day(2) };
    expect(safeStatus(signed, now)).toBe("signed");
    expect(safeStatus({ ...signed, paidAt: day(1) }, now)).toBe("funded");
  });
  it("needs both signatures to be Signed", () => {
    expect(safeStatus({ ...base, sentAt: day(3), signedByOwnerAt: day(2) }, now)).toBe("sent");
  });
  it("lets Canceled win over everything and Funded over Signed", () => {
    expect(safeStatus({ ...base, paidAt: day(1), canceledAt: day(1) }, now)).toBe("canceled");
    expect(safeStatus({ ...base, paidAt: day(1) }, now)).toBe("funded");
  });
  it("treats a Mercury SAFE as Sent unless Mercury says otherwise, and Expired once past expiry", () => {
    const mercury = { ...base, source: "mercury" as const };
    expect(safeStatus(mercury, now)).toBe("sent");
    expect(safeStatus({ ...mercury, expiresAt: day(1) }, now)).toBe("expired");
    expect(safeStatus({ ...mercury, expiresAt: day(-5) }, now)).toBe("sent");
  });
  it("counts only Draft, Sent, Signed and Funded as active", () => {
    expect(["draft", "sent", "signed", "funded"].every((s) => isActiveSafe(s as never))).toBe(true);
    expect(isActiveSafe("canceled")).toBe(false);
    expect(isActiveSafe("expired")).toBe(false);
  });
});

describe("needsAttention", () => {
  const signed = { ...base, sentAt: day(20), signedByOwnerAt: day(2), signedByInvestorAt: day(2) };
  it("flags a signed, unpaid SAFE for a deposit", () => {
    expect(needsAttention(signed, now)).toBe("deposit");
    expect(needsAttention({ ...signed, paidAt: day(1) }, now)).toBeNull();
  });
  it("flags a native SAFE sent and unsigned for 14 days", () => {
    expect(needsAttention({ ...base, sentAt: day(14) }, now)).toBe("signature");
    expect(needsAttention({ ...base, sentAt: day(13) }, now)).toBeNull();
    expect(needsAttention(base, now)).toBeNull();
  });
  it("never asks for a signature on a Mercury SAFE, which has no sent date", () => {
    expect(needsAttention({ ...base, source: "mercury" }, now)).toBeNull();
  });
});

describe("at-cap math", () => {
  it("is amount over cap, to one decimal", () => {
    expect(atCapPercent(base)).toBe(5);
    expect(atCapPercent({ ...base, amountCents: 3_333_333 })).toBe(3.3);
  });
  it("shows nothing for a SAFE without a cap, such as a Mercury discount-only SAFE", () => {
    const discountOnly = { ...base, capCents: null, discountPercent: 20 };
    expect(atCapPercent(discountOnly)).toBeNull();
    expect(atCapSum([discountOnly])).toBe(0);
  });
  it("sums the percentages of the SAFEs that have a cap", () => {
    const other = { ...base, amountCents: 2_500_000 };
    expect(atCapSum([base, other, { ...base, capCents: null }])).toBe(7.5);
  });
  it("rounds only the total, so many small SAFEs are not summed as zero", () => {
    const small = { ...base, amountCents: 4_000_000, capCents: 10_000_000_000 };
    expect(atCapSum(Array.from({ length: 10 }, () => small))).toBe(0.4);
  });
});
