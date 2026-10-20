import { maskCurrencyText, maskPinFigures } from "@rakazo/chat-ui/mask-currency";
import { useSyncExternalStore } from "react";
import { createSecureStorePreference } from "./secure-preference-store";

// Same key as the web preference; each device keeps its own copy.
export const HIDE_AMOUNTS_STORAGE_KEY = "rakazo.hideAmounts";

const store = createSecureStorePreference<"on" | "off">({
  key: HIDE_AMOUNTS_STORAGE_KEY,
  normalize: (stored) => (stored === "on" ? "on" : "off"),
  fallback: "off",
});

export const getHideAmounts = (): boolean => store.getCached() === "on";
export const loadHideAmounts = store.load;
export const setHideAmounts = (hidden: boolean) => store.set(hidden ? "on" : "off");
export const subscribeHideAmounts = store.subscribe;

/** Re-renders the caller when the switch flips. */
export const useHideAmounts = (): boolean =>
  useSyncExternalStore(subscribeHideAmounts, getHideAmounts, () => false);

/** Masks money in display text while amounts are hidden; stored text is never changed. */
export const maskAmountsWhenHidden = (text: string): string =>
  getHideAmounts() ? maskCurrencyText(text) : text;

/** Masks the figures in a chart's text labels while amounts are hidden. */
export const maskSvgWhenHidden = (svg: string): string =>
  getHideAmounts()
    ? svg.replace(
        />([^<>]+)<\/(text|tspan)>/g,
        (_, label, tag) => `>${maskPinFigures(label)}</${tag}>`,
      )
    : svg;
