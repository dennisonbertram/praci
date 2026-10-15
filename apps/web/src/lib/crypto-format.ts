import { CRYPTO_CHAINS } from "@rakazo/contracts";

const FRACTION_DIGITS = 5;

/** A token balance for display. Splits the integer string, so there is no float rounding. */
export function tokenAmount(rawBalance: string, decimals: number, locale?: string): string {
  const padded = rawBalance.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(
    padded.length - decimals,
    padded.length - decimals + FRACTION_DIGITS,
  );
  const trimmed = fraction.replace(/0+$/, "");
  if (BigInt(rawBalance) !== 0n && whole === "0" && trimmed === "")
    return `<0.${"0".repeat(FRACTION_DIGITS - 1)}1`;
  const grouped = BigInt(whole).toLocaleString(locale);
  if (!trimmed) return grouped;
  const point = (0.1).toLocaleString(locale).charAt(1);
  return `${grouped}${point}${trimmed}`;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export const chainName = (chainId: number) =>
  CRYPTO_CHAINS.find((chain) => chain.id === chainId)?.name ?? `Chain ${chainId}`;
