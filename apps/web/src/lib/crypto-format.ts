import { CRYPTO_CHAINS } from "@rakazo/contracts";
import { MASK } from "./finance-format";
import { getHideAmounts } from "./hide-amounts-preference";

const FRACTION_DIGITS = 5;

/** A token balance for display. Splits the integer string, so there is no float rounding. */
export function tokenAmount(rawBalance: string, decimals: number, locale?: string): string {
  if (getHideAmounts()) return MASK;
  const padded = rawBalance.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(
    padded.length - decimals,
    padded.length - decimals + FRACTION_DIGITS,
  );
  const trimmed = fraction.replace(/0+$/, "");
  if (BigInt(rawBalance) !== 0n && whole === "0" && trimmed === "")
    return `<0.${"0".repeat(FRACTION_DIGITS - 1)}1`;
  // A balance of a billion or more (almost always a scam airdrop) is shown as 1.05e+38, cut not rounded.
  if (whole.length > 9) {
    const digits = whole.replace(/^0+/, "");
    const mantissa = `${digits.slice(0, 1)}.${digits.slice(1, 3)}`.replace(/\.?0+$/, "");
    return `${mantissa}e+${digits.length - 1}`;
  }
  const grouped = BigInt(whole).toLocaleString(locale);
  if (!trimmed) return grouped;
  const point = (0.1).toLocaleString(locale).charAt(1);
  return `${grouped}${point}${trimmed}`;
}

/** An exchange's decimal balance (`12000.00`) grouped and trimmed like a token balance (`12,000`); other text as is. */
export function decimalAmount(amount: string, locale?: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return getHideAmounts() ? MASK : amount;
  const fraction = match[2] ?? "";
  return tokenAmount(`${match[1]}${fraction}`.replace(/^0+(?=\d)/, ""), fraction.length, locale);
}

/** USD per token: two decimals from a dollar up, four significant digits below (a $0.00004 token stays readable). */
export function tokenPrice(usdPrice: string, locale?: string): string {
  const price = Number(usdPrice);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits:
      price >= 1 || !(price > 0) ? 2 : Math.min(10, 3 - Math.floor(Math.log10(price))),
  }).format(price);
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export const chainName = (chainId: number) =>
  CRYPTO_CHAINS.find((chain) => chain.id === chainId)?.name ?? `Chain ${chainId}`;
