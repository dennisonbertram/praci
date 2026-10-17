import { useSyncExternalStore } from "react";

export const HIDE_AMOUNTS_STORAGE_KEY = "rakazo.hideAmounts";

const listeners = new Set<() => void>();
let memoryHidden: boolean | null = null;

function getLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Saved "on" hides amounts. Missing or unreadable storage shows them. */
export function getHideAmounts(): boolean {
  if (memoryHidden !== null) return memoryHidden;
  try {
    return getLocalStorage()?.getItem(HIDE_AMOUNTS_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setHideAmounts(hidden: boolean): void {
  memoryHidden = hidden;
  try {
    getLocalStorage()?.setItem(HIDE_AMOUNTS_STORAGE_KEY, hidden ? "on" : "off");
  } catch {
    // Ignore quota / private-mode failures; the in-memory choice still applies.
  }
  for (const listener of listeners) listener();
}

export function subscribeHideAmounts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the caller when the switch flips. Every component that formats an amount calls this. */
export function useHideAmounts(): boolean {
  return useSyncExternalStore(subscribeHideAmounts, getHideAmounts, () => false);
}

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;
const SCALE = String.raw`(?:\s?(?:million|billion|thousand)\b|[kKmMbB]\b)`;
const CURRENCY = new RegExp(
  [
    // $73,781.83  -$300  €1.2M  $450k  $2 million
    String.raw`(?<sign>[-−+]?)(?<sym>[$€£¥])\s?${NUM}${SCALE}?`,
    // USD 1,200   USD1.5M
    String.raw`(?<sign2>[-−+]?)(?:USD|EUR|GBP)\s?${NUM}${SCALE}?`,
    // 1,200 USD   450k EUR
    String.raw`(?<![\w$€£¥.,])${NUM}${SCALE}?\s(?:USD|EUR|GBP)\b`,
  ].join("|"),
  "g",
);

/** Replaces each currency amount in text (`$73,781.83`, `USD 1,200`, `450k USD`) with `$•••`, keeping a symbol and sign. Plain numbers stay. */
export function maskCurrencyText(text: string): string {
  return text.replace(CURRENCY, (_m, sign, sym, sign2) => `${sign ?? sign2 ?? ""}${sym ?? "$"}•••`);
}

/** Masks currency amounts in display text while amounts are hidden; stored text is never changed. */
export const maskCurrencyWhenHidden = (text: string): string =>
  getHideAmounts() ? maskCurrencyText(text) : text;

/** Test helper: forget the in-memory choice so storage is read again, as after a reload. */
export function resetHideAmountsMemory(): void {
  memoryHidden = null;
}
