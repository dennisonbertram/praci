import type { SafeStatus } from "@rakazo/contracts";

/** The fields a SAFE's status and attention are derived from. Dates are ISO strings or Dates. */
export type SafeFacts = {
  source: "native" | "mercury";
  amountCents: number;
  capCents: number | null;
  sentAt: Date | string | null;
  signedByOwnerAt: Date | string | null;
  signedByInvestorAt: Date | string | null;
  paidAt: Date | string | null;
  expiresAt: Date | string | null;
  canceledAt: Date | string | null;
};

const time = (value: Date | string) => new Date(value).getTime();
const DAY_MS = 86_400_000;
/** A SAFE sent and still unsigned after this many days needs the founder's attention. */
export const UNSIGNED_AFTER_DAYS = 14;

/**
 * Status is derived, never stored: Canceled, else Funded, else Signed (both signatures), else
 * Expired, else Sent (a Mercury SAFE exists only once it was sent), else Draft.
 */
export function safeStatus(safe: SafeFacts, now = new Date()): SafeStatus {
  if (safe.canceledAt) return "canceled";
  if (safe.paidAt) return "funded";
  if (safe.signedByOwnerAt && safe.signedByInvestorAt) return "signed";
  if (safe.expiresAt && time(safe.expiresAt) < now.getTime()) return "expired";
  if (safe.sentAt || safe.source === "mercury") return "sent";
  return "draft";
}

/** Draft, Sent, Signed and Funded count; Canceled and Expired count zero. */
export const isActiveSafe = (status: SafeStatus) => status !== "canceled" && status !== "expired";

/**
 * Why the SAFE is on the Attention strip: "deposit" (signed, not yet paid) or "signature" (a native
 * SAFE sent and unsigned for 14 days). The one place this is decided.
 */
export function needsAttention(safe: SafeFacts, now = new Date()): "deposit" | "signature" | null {
  const status = safeStatus(safe, now);
  if (status === "signed") return "deposit";
  if (status === "sent" && safe.source === "native" && safe.sentAt)
    return now.getTime() - time(safe.sentAt) >= UNSIGNED_AFTER_DAYS * DAY_MS ? "signature" : null;
  return null;
}

/** Post-money ownership if converted at the cap: amount over cap, one decimal. Null without a cap. */
export function atCapPercent(safe: Pick<SafeFacts, "amountCents" | "capCents">): number | null {
  return safe.capCents ? Math.round((safe.amountCents / safe.capCents) * 1000) / 10 : null;
}

/** Combined at-cap dilution: the sum of the SAFEs' percentages; a SAFE without a cap adds nothing. */
export function atCapSum(safes: readonly Pick<SafeFacts, "amountCents" | "capCents">[]): number {
  const tenths = safes.reduce((sum, safe) => sum + Math.round((atCapPercent(safe) ?? 0) * 10), 0);
  return tenths / 10;
}
