import { afterEach, describe, expect, it, vi } from "vitest";
import { axisMoney, changeText, money, moneyExact, transactionAmount } from "./finance-format";
import {
  getHideAmounts,
  HIDE_AMOUNTS_STORAGE_KEY,
  resetHideAmountsMemory,
  setHideAmounts,
  subscribeHideAmounts,
} from "./hide-amounts-preference";

function stubStorage(store: Map<string, string>) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setHideAmounts(false);
  resetHideAmountsMemory();
});

describe("hide amounts", () => {
  it("formats normally when shown and masks without digits when hidden", () => {
    stubStorage(new Map());
    resetHideAmountsMemory();
    expect(money(123_456)).toBe("$1,235");
    expect(transactionAmount(5_000)).toBe("+$50.00");
    setHideAmounts(true);
    expect(money(123_456)).toBe("$•••");
    expect(moneyExact(123_456)).toBe("$•••");
    expect(transactionAmount(5_000)).toBe("+$•••");
    expect(axisMoney(150_000)).toBe("$•••");
    expect(changeText(-53)).toBe("↓ •••%");
    expect(money(1)).toBe(money(99_999_999));
  });

  it("persists, survives a reload and notifies listeners", () => {
    const store = new Map<string, string>();
    stubStorage(store);
    const listener = vi.fn();
    subscribeHideAmounts(listener);
    setHideAmounts(true);
    expect(store.get(HIDE_AMOUNTS_STORAGE_KEY)).toBe("on");
    expect(listener).toHaveBeenCalledOnce();
    resetHideAmountsMemory(); // a reload forgets memory, storage stays
    expect(getHideAmounts()).toBe(true);
  });

  it("falls back to shown when storage throws, and still applies the choice in memory", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    resetHideAmountsMemory();
    expect(getHideAmounts()).toBe(false);
    setHideAmounts(true);
    expect(getHideAmounts()).toBe(true);
  });
});
