import { afterEach, describe, expect, it, vi } from "vitest";
import {
  axisMoney,
  changeText,
  hiddenOr,
  money,
  moneyExact,
  transactionAmount,
} from "./finance-format";
import {
  getHideAmounts,
  resetHideAmountsMemory,
  setHideAmounts,
  setHideAmountsUser,
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
    expect(money(123_456)).toBe("$1,235");
    expect(transactionAmount(5_000)).toBe("+$50.00");
    setHideAmounts(true);
    expect(money(123_456)).toBe("$•••");
    expect(moneyExact(123_456)).toBe("$•••");
    expect(transactionAmount(5_000)).toBe("+$•••");
    expect(axisMoney(150_000)).toBe("$•••");
    // The arrow would say which way spend went, so it is hidden too.
    expect(changeText(-53)).toBeNull();
    expect(money(1)).toBe(money(99_999_999));
  });

  it("notifies listeners only when the choice changes and keeps nothing in the browser", () => {
    const store = new Map<string, string>();
    stubStorage(store);
    const listener = vi.fn();
    subscribeHideAmounts(listener);
    setHideAmounts(true);
    setHideAmounts(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(getHideAmounts()).toBe(true);
    expect(store.size).toBe(0);
    // The next person's saved choice replaces this one's.
    setHideAmounts(false);
    expect(getHideAmounts()).toBe(false);
  });
});

it("masks token quantities and amount-derived text", async () => {
  const { tokenAmount } = await import("./crypto-format");
  setHideAmounts(true);
  expect(tokenAmount("1500000000000000000", 18)).toBe("•••");
  expect(hiddenOr("$2,400")).toBe("•••");
  setHideAmounts(false);
  expect(tokenAmount("1500000000000000000", 18)).toBe("1.5");
});

it("keeps runway, share counts and ownership visible, since they are not money", async () => {
  const { percentFigure, runwayText, shareCount } = await import("./finance-format");
  setHideAmounts(true);
  expect(runwayText(8.94)).toBe("8.9");
  expect(shareCount(4_000_000, "en")).toBe("4,000,000");
  expect(percentFigure(40)).toBe("40.00%");
  expect(money(41_200_000)).toBe("$•••");
});

describe("hide amounts cache", () => {
  it("restores each user's own choice from this browser before the server answers", () => {
    stubStorage(new Map());
    setHideAmountsUser("user-a");
    setHideAmounts(true);
    setHideAmountsUser("user-b");
    expect(getHideAmounts()).toBe(false);
    setHideAmountsUser("user-a");
    expect(getHideAmounts()).toBe(true);
    setHideAmountsUser(null);
  });
});
