import { i18n } from "@lingui/core";
import { afterEach, describe, expect, it } from "vitest";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { isoShortDay, usd, usdOrNull } from "./format";

i18n.loadAndActivate({ locale: "en", messages: {} });

// The helpers read the active locale and the hide-amounts flag at call time.
afterEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  setHideAmounts(false);
});

describe("usd", () => {
  it("formats cents as whole dollars", () => {
    expect(usd(7_500_000)).toBe("$75,000");
    expect(usd(0)).toBe("$0");
    expect(usd(99)).toBe("$1");
    expect(usd(-123_450)).toBe("-$1,235");
  });

  it("masks while amounts are hidden", () => {
    setHideAmounts(true);
    expect(usd(7_500_000)).toBe("$•••");
  });
});

describe("usdOrNull", () => {
  it("keeps null null, for the caller's own empty mark", () => {
    expect(usdOrNull(null)).toBeNull();
    expect(usdOrNull(250_000)).toBe("$2,500");
  });

  it("still keeps null while amounts are hidden", () => {
    setHideAmounts(true);
    expect(usdOrNull(null)).toBeNull();
    expect(usdOrNull(250_000)).toBe("$•••");
  });
});

describe("isoShortDay", () => {
  it("shows the UTC day, with the year only outside this one", () => {
    const year = new Date().getUTCFullYear();
    expect(isoShortDay(`${year}-10-16T23:59:00.000Z`)).toBe("Oct 16");
    expect(isoShortDay("2001-05-04T12:00:00.000Z")).toBe("May 4, 2001");
    expect(isoShortDay("garbage")).toBe("");
  });
});

describe("locale", () => {
  it("formats in the active locale, read at call time", () => {
    expect(usd(7_500_000)).toBe("$75,000");
    i18n.loadAndActivate({ locale: "de", messages: {} });
    expect(usd(7_500_000)).toBe("75.000 $");
    expect(isoShortDay(`${new Date().getUTCFullYear()}-06-15T00:00:00.000Z`)).toBe("15. Juni");
    expect(isoShortDay("2001-05-04T12:00:00.000Z")).toBe("4. Mai 2001");
  });
});
