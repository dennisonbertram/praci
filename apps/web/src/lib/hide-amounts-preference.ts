import { maskCurrencyText } from "@rakazo/chat-ui/mask-currency";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const KEY = "rakazo:hide-amounts:";
const LAST = "rakazo:hide-amounts-last-user";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the server copy still applies once it loads.
  }
}

// Start from this browser's last user's cached choice so amounts never flash before the server copy loads.
let userId: string | null = read(LAST);
let hidden = userId !== null && read(KEY + userId) === "1";

/** Hide amounts is stored on the signed-in user (Me.hideAmounts), not in the browser. */
export function getHideAmounts(): boolean {
  return hidden;
}

/** Applies the choice in this tab; the caller saves it to the user's preferences. */
export function setHideAmounts(next: boolean): void {
  if (userId) write(KEY + userId, next ? "1" : "0");
  if (hidden === next) return;
  hidden = next;
  for (const listener of listeners) listener();
}

/** Switches to this user's cached choice (shown if nothing is cached). Call when the signed-in user is known. */
export function setHideAmountsUser(next: string | null): void {
  userId = next;
  if (!next) return;
  write(LAST, next);
  const cached = read(KEY + next) === "1";
  if (cached !== hidden) {
    hidden = cached;
    for (const listener of listeners) listener();
  }
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
