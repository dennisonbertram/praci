import { maskCurrencyText } from "@rakazo/chat-ui/mask-currency";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let hidden = false;

/** Hide amounts is stored on the signed-in user (Me.hideAmounts), not in the browser. */
export function getHideAmounts(): boolean {
  return hidden;
}

/** Applies the choice in this tab; the caller saves it to the user's preferences. */
export function setHideAmounts(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
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

export { maskCurrencyText };

/** Masks currency amounts in display text while amounts are hidden; stored text is never changed. */
export const maskCurrencyWhenHidden = (text: string): string =>
  getHideAmounts() ? maskCurrencyText(text) : text;

/** Test helper: show amounts again, as for a user who has not hidden them. */
export function resetHideAmountsMemory(): void {
  setHideAmounts(false);
}
