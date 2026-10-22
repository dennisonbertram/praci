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

type CapFacts = Pick<SafeFacts, "amountCents" | "capCents"> & { valuationType?: string };

/** Only a post-money cap converts to an ownership share; a pre-money or no-valuation SAFE has none. */
const atCapRatio = (safe: CapFacts) =>
  safe.capCents && (safe.valuationType ?? "post_money_cap") === "post_money_cap"
    ? safe.amountCents / safe.capCents
    : null;

/** Post-money ownership if converted at the cap: amount over cap, one decimal. Null without a cap. */
export function atCapPercent(safe: CapFacts): number | null {
  const ratio = atCapRatio(safe);
  return ratio == null ? null : Math.round(ratio * 1000) / 10;
}

/** Combined at-cap dilution: the SAFEs' ratios summed, then rounded once; a SAFE without a cap adds nothing. */
export function atCapSum(safes: readonly CapFacts[]): number {
  return Math.round(safes.reduce((sum, safe) => sum + (atCapRatio(safe) ?? 0), 0) * 1000) / 10;
}

/** A Finance transaction that could be a SAFE's deposit. `linkedSafeId` is the SAFE already using it. */
export type DepositCandidate = {
  id: string;
  amountCents: number;
  currency: string;
  classification: string;
  postedAt: Date | string;
  linkedSafeId: string | null;
};

const DEPOSIT_WINDOW_MS = 5 * DAY_MS;

/**
 * Best-effort deposit for a paid Mercury SAFE: a USD financing deposit of exactly the SAFE amount,
 * posted within 5 days of `paidAt`, not already linked to another SAFE. Returns its id only when
 * exactly one qualifies; with none or several it links nothing and never picks among equal amounts.
 */
export function matchDeposit(
  safe: { amountCents: number; paidAt: Date | string | null },
  candidates: readonly DepositCandidate[],
): string | null {
  if (!safe.paidAt) return null;
  const paid = time(safe.paidAt);
  const fits = candidates.filter(
    (c) =>
      c.currency === "USD" &&
      c.classification === "financing" &&
      c.linkedSafeId === null &&
      c.amountCents === safe.amountCents &&
      Math.abs(time(c.postedAt) - paid) <= DEPOSIT_WINDOW_MS,
  );
  return fits.length === 1 ? (fits[0]?.id ?? null) : null;
}
