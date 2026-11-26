// Fixed-point numbers for the cap table: share counts and cents are exact BigInt integers, and
// prices, ratios and percents are BigInt scaled by 10^10. No float ever touches a stored value.

/** The fixed-point scale: a `Fixed` value of 1 is `10_000_000_000n`. */
export const SCALE = 10_000_000_000n;
/** A decimal (price, ratio, percent) scaled by `SCALE`. */
export type Fixed = bigint;

const TEN = 10n;
const PLACES = 10;
const SHARES_PATTERN = /^\d+$/;
const FIXED_PATTERN = /^(\d+)(?:\.(\d{1,10}))?$/;

function requirePlaces(places: number, min: number): void {
  if (!Number.isInteger(places) || places < min || places > PLACES) {
    throw new RangeError(`places must be an integer from ${min} to ${PLACES}`);
  }
}

function formatScaled(value: bigint, places: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(places + 1, "0");
  if (places === 0) return `${negative ? "-" : ""}${digits}`;
  return `${negative ? "-" : ""}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/** Integer division rounded half away from zero. Throws on a zero denominator. */
export function divRoundHalfUp(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new RangeError("division by zero");
  const negative = a < 0n !== b < 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  const quotient = (absA * 2n + absB) / (absB * 2n);
  return negative ? -quotient : quotient;
}

/** A whole, non-negative share count or cent amount on the wire, e.g. "12500000". */
export function parseShares(s: string): bigint {
  if (!SHARES_PATTERN.test(s)) throw new Error(`not a whole non-negative integer: ${s}`);
  return BigInt(s);
}

/** Whole, non-negative cents on the wire, e.g. "150000000" for $1,500,000.00. */
export function parseCents(s: string): bigint {
  if (!SHARES_PATTERN.test(s)) throw new Error(`not whole non-negative cents: ${s}`);
  return BigInt(s);
}

/** The canonical wire form of a share count or a cent amount. */
export function formatInt(v: bigint): string {
  return v.toString();
}

/** A decimal string with up to 10 places, e.g. "1.25" -> 12_500_000_000n. */
export function parseFixed(s: string): Fixed {
  const match = FIXED_PATTERN.exec(s);
  if (!match) throw new Error(`not a decimal with up to 10 places: ${s}`);
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(PLACES, "0");
  return BigInt(whole) * SCALE + BigInt(fraction);
}

/** A `Fixed` value as a decimal string with exactly `places` decimals, rounded half-up. */
export function formatFixed(v: Fixed, places = PLACES): string {
  requirePlaces(places, 0);
  return formatScaled(divRoundHalfUp(v, TEN ** BigInt(PLACES - places)), places);
}

/** `part` as a percent of `whole`, rounded half-up to `places` decimals (4 by default). */
export function percentOf(part: bigint, whole: bigint, places = 4): string {
  requirePlaces(places, 0);
  if (whole === 0n) return formatScaled(0n, places);
  const scaled = divRoundHalfUp(part * 100n * TEN ** BigInt(places), whole);
  return formatScaled(scaled, places);
}

/** Cents paid for `shares` at `price` dollars per share, rounded half-up. */
export function sharesTimesPrice(shares: bigint, price: Fixed): bigint {
  return divRoundHalfUp(shares * price * 100n, SCALE);
}
