import { describe, expect, it } from "vitest";
import {
  axisMoney,
  changeText,
  dayAxisLabels,
  fullDay,
  money,
  moneyExact,
  monthAxisLabels,
  monthFull,
  monthLabel,
  monthShort,
  paidWithLabel,
  shortDay,
  transactionAmount,
} from "./finance-format";

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
    expect(changeText(0)).toBeNull();
    expect(changeText(0.4)).toBeNull();
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
