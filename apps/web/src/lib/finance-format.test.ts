import { afterEach, describe, expect, it } from "vitest";
import {
  accountLabel,
  axisMoney,
  changeText,
  dayAxisLabels,
  fullDay,
  listAmount,
  money,
  moneyExact,
  monthAxisLabels,
  monthFull,
  monthLabel,
  monthShort,
  paidWithLabel,
  shareText,
  shortDay,
  totalPercent,
  transactionAmount,
  trendText,
  txnDay,
} from "./finance-format";
import { setHideAmounts } from "./hide-amounts-preference";

const en = "en-US";
const now = new Date("2026-10-14T12:00:00Z");

describe("finance formatting", () => {
  it("formats cents as dollars without a sign", () => {
    expect(money(7_500_000, en)).toBe("$75,000");
    expect(money(-123_450, en)).toBe("$1,235");
    expect(moneyExact(-123_456, en)).toBe("$1,234.56");
  });

  it("marks money in with a plus and money out with nothing", () => {
    expect(transactionAmount(150_000, en)).toBe("+$1,500.00");
    expect(transactionAmount(-4_200, en)).toBe("$42.00");
  });

  it("shortens axis labels", () => {
    expect(axisMoney(80_000_00)).toBe("$80k");
    expect(axisMoney(150_000)).toBe("$1.5k");
    expect(axisMoney(80_000)).toBe("$800");
    expect(axisMoney(0)).toBe("$0");
    expect(axisMoney(-500_000)).toBe("−$5k");
    // Millions read as $2M, not $2000k.
    expect(axisMoney(200_000_000)).toBe("$2M");
    expect(axisMoney(150_000_000)).toBe("$1.5M");
    expect(axisMoney(99_995_000)).toBe("$1M");
  });

  it("shows list amounts in whole dollars, signed like transactions", () => {
    expect(listAmount(150_050, en)).toBe("+$1,501");
    expect(listAmount(-8_750, en)).toBe("$88");
    expect(listAmount(-8_750, en, "EUR")).toBe("€88");
  });

  it("reads the date part of a day or ISO datetime, adding the year only when it differs", () => {
    expect(shortDay("2026-10-16", now, en)).toBe("Oct 16");
    expect(shortDay("2026-10-16T23:59:00.000Z", now, en)).toBe("Oct 16");
    expect(shortDay("2025-12-02", now, en)).toBe("Dec 2, 2025");
    expect(shortDay("garbage", now, en)).toBe("");
    expect(fullDay("2026-10-16", en)).toBe("Oct 16, 2026");
  });

  it("labels months", () => {
    expect(monthShort("2026-10", en)).toBe("Oct");
    expect(monthLabel("2026-10", en)).toBe("Oct 2026");
    expect(monthFull("2026-10", en)).toBe("October 2026");
    expect(monthLabel("nope", en)).toBe("");
  });

  it("shows the direction and size of a change, or nothing without a comparison", () => {
    expect(changeText(-53.2)).toBe("↓ 53%");
    expect(changeText(12.5)).toBe("↑ 13%");
    expect(changeText(null)).toBeNull();
    expect(changeText(0.04)).toBe("0%");
    // Under 10% one decimal, so a 0.5% rise is not shown as 1%.
    expect(changeText(0.5)).toBe("↑ 0.5%");
    expect(changeText(-4.3)).toBe("↓ 4.3%");
  });

  it("says a flat subscription is flat and a rising one by how much", () => {
    expect(trendText([4_500, 4_500, 4_500])).toBeNull();
    expect(trendText([10_000, 11_000, 12_000])).toBe("↑ 20%");
    expect(trendText([5_000])).toBeNull();
  });

  it("shows a charge on its purchase day, the day its totals and filters use", () => {
    expect(
      txnDay({ purchasedAt: "2026-10-16T00:00:00.000Z", postedAt: "2026-10-17T00:00:00.000Z" }),
    ).toBe("2026-10-16");
    expect(txnDay({ purchasedAt: null, postedAt: "2026-10-17T00:00:00.000Z" })).toBe("2026-10-17");
  });

  it("names an account with its last four digits once", () => {
    expect(accountLabel("MOCK Checking ••1111", "1111")).toBe("MOCK Checking ••1111");
    expect(accountLabel("Checking", "1111")).toBe("Checking ••1111");
    expect(accountLabel("Checking", null)).toBe("Checking");
    expect(
      paidWithLabel([
        { provider: "mercury", kind: "account", name: "MOCK Checking ••1111", lastFour: "1111" },
      ]),
    ).toBe("MOCK Checking ••1111");
  });

  it("describes what paid a vendor", () => {
    expect(
      paidWithLabel([
        { provider: "brex", kind: "card", name: "Card", lastFour: "0003" },
        { provider: "mercury", kind: "account", name: "Mercury Checking", lastFour: "1234" },
      ]),
    ).toBe("Brex ••0003 + Mercury Checking ••1234");
    expect(
      paidWithLabel([
        { provider: "brex", kind: "card", name: "Card", lastFour: "0003" },
        { provider: "brex", kind: "card", name: "Card", lastFour: "0004" },
      ]),
    ).toBe("Brex · 2 cards: ••0003, ••0004");
    expect(paidWithLabel([])).toBe("");
  });
});

describe("axis labels", () => {
  it("puts the year on the first month and on every January", () => {
    expect(monthAxisLabels(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"], en)).toEqual([
      "Nov '25",
      "Dec",
      "Jan '26",
      "Feb",
      "Mar",
    ]);
  });

  it("marks the first month even inside one year", () => {
    expect(monthAxisLabels(["2026-02", "2026-03"], en)).toEqual(["Feb '26", "Mar"]);
  });

  it("shows short dates, with no year inside one year", () => {
    expect(dayAxisLabels(["2026-10-09", "2026-10-10"], en)).toEqual(["Oct 9", "Oct 10"]);
  });

  it("adds the year at the start and at a new year when the range crosses one", () => {
    expect(dayAxisLabels(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"], en)).toEqual([
      "Dec 30 '25",
      "Dec 31",
      "Jan 1 '26",
      "Jan 2",
    ]);
  });
});

describe("shareText", () => {
  it("shows a small real share as <1% rather than 0%", () => {
    expect(shareText(500, 19_847_500)).toBe("<1%");
    expect(shareText(0, 100)).toBe("0%");
    expect(shareText(50, 100)).toBe("50%");
    expect(shareText(5, 0)).toBe("—");
  });
});

describe("figures the Finance pages derive from amounts", () => {
  afterEach(() => setHideAmounts(false));

  it("masks shares, changes and axis labels while amounts are hidden", () => {
    setHideAmounts(true);
    expect(shareText(50, 100)).toBe("");
    expect(shareText(500, 19_847_500)).toBe("");
    // A percentage of a hidden amount would reveal it, so no change text is shown.
    expect(changeText(53)).toBeNull();
    expect(changeText(0)).toBeNull();
    expect(trendText([4_500, 4_500, 4_500])).toBeNull();
    expect(trendText([10_000, 11_000, 12_000])).toBeNull();
    expect(axisMoney(-250_000)).not.toMatch(/\d/);
    expect(txnDay({ purchasedAt: null, postedAt: "2026-10-01T00:00:00Z" })).toBe("2026-10-01");
  });
});

describe("totalPercent", () => {
  it("is null when no ownership is known", () => {
    expect(totalPercent([])).toBeNull();
    expect(totalPercent([null, undefined])).toBeNull();
  });
  it("sums the known values", () => {
    expect(totalPercent([60, null, 40])).toBe(100);
  });
});
