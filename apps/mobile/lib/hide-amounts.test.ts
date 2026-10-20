import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
}));

describe("mobile hide amounts preference", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  it("shows amounts until the reader turns hiding on, and saves the choice", async () => {
    const { HIDE_AMOUNTS_STORAGE_KEY, getHideAmounts, setHideAmounts } = await import(
      "./hide-amounts"
    );
    expect(getHideAmounts()).toBe(false);
    await setHideAmounts(true);
    expect(getHideAmounts()).toBe(true);
    expect(store.get(HIDE_AMOUNTS_STORAGE_KEY)).toBe("on");
  });

  it("loads a saved choice and notifies subscribers", async () => {
    const { HIDE_AMOUNTS_STORAGE_KEY, getHideAmounts, loadHideAmounts, subscribeHideAmounts } =
      await import("./hide-amounts");
    store.set(HIDE_AMOUNTS_STORAGE_KEY, "on");
    const listener = vi.fn();
    subscribeHideAmounts(listener);
    await loadHideAmounts();
    expect(getHideAmounts()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("masks text only while amounts are hidden", async () => {
    const { maskAmountsWhenHidden, setHideAmounts } = await import("./hide-amounts");
    expect(maskAmountsWhenHidden("Paid $1,200 today")).toBe("Paid $1,200 today");
    await setHideAmounts(true);
    expect(maskAmountsWhenHidden("Paid $1,200 today")).toBe("Paid $••• today");
  });

  it("masks figures in chart labels only while amounts are hidden", async () => {
    const { maskSvgWhenHidden, setHideAmounts } = await import("./hide-amounts");
    const svg = '<svg><text x="1">Cash $1,200</text><tspan>Mar</tspan></svg>';
    expect(maskSvgWhenHidden(svg)).toBe(svg);
    await setHideAmounts(true);
    expect(maskSvgWhenHidden(svg)).toBe(
      '<svg><text x="1">Cash $•••</text><tspan>Mar</tspan></svg>',
    );
  });
});
