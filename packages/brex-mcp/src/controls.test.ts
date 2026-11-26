import type { BrexCardsControls } from "@rakazo/contracts";
import { BREX_CARDS_CONTROLS_DEFAULTS } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  checkCreateCard,
  checkCreateSpendLimit,
  checkUpdateCard,
  checkUpdateSpendLimit,
} from "./controls.js";

const NOW = new Date("2026-11-01T12:00:00Z");
const controls: BrexCardsControls = {
  ...BREX_CARDS_CONTROLS_DEFAULTS,
  allowedDurations: [...BREX_CARDS_CONTROLS_DEFAULTS.allowedDurations],
};

const card = (over: Record<string, unknown> = {}) =>
  ({
    id: "card_1",
    card_name: "Figma",
    last_four: "4242",
    status: "ACTIVE",
    limit_type: "CARD",
    spend_controls: {
      spend_limit: { amount: 50_000, currency: "USD" },
      spend_duration: "MONTHLY",
      lock_after_date: null,
      allowed_merchant_details: [{ name: "Figma" }],
      blocked_merchant_details: null,
    },
    ...over,
  }) as never;

const spendLimit = (over: Record<string, unknown> = {}) =>
  ({
    id: "sl_1",
    name: "Software",
    status: "ACTIVE",
    authorization_settings: {
      base_limit: { amount: 100_000, currency: "USD" },
      authorization_type: "HARD",
      limit_buffer_percentage: null,
      rollover_refresh_rate: "OFF",
    },
    auto_create_limit_cards_setting: "DISABLED",
    member_user_ids: ["u_ada", "u_ben"],
    ...over,
  }) as never;

describe("checkCreateCard", () => {
  it("accepts a card within every control", () => {
    expect(checkCreateCard(controls, { amountCents: 100_000, duration: "MONTHLY" }, NOW)).toEqual({
      ok: true,
    });
  });

  it("refuses an amount over the new-card cap and says which cap", () => {
    const result = checkCreateCard(controls, { amountCents: 200_000, duration: "MONTHLY" }, NOW);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.reason).toMatch(/\$2,000\.00.*\$1,000\.00/);
  });

  it("refuses a duration the owner did not allow", () => {
    const result = checkCreateCard(controls, { amountCents: 1000, duration: "YEARLY" }, NOW);
    expect(result.ok === false && result.reason).toContain("YEARLY");
  });

  it("refuses a ONE_TIME card without a lock date", () => {
    const result = checkCreateCard(controls, { amountCents: 1000, duration: "ONE_TIME" }, NOW);
    expect(result.ok === false && result.reason).toMatch(/lock date/i);
  });

  it("refuses a ONE_TIME lock date beyond oneTimeMaxDays and accepts the last allowed day", () => {
    const tooLate = checkCreateCard(
      controls,
      { amountCents: 1000, duration: "ONE_TIME", lockAfterDate: "2027-02-01" },
      NOW,
    );
    expect(tooLate.ok).toBe(false);
    const lastDay = checkCreateCard(
      controls,
      { amountCents: 1000, duration: "ONE_TIME", lockAfterDate: "2027-01-30" },
      NOW,
    );
    expect(lastDay).toEqual({ ok: true });
  });

  it("applies no lifetime rule when oneTimeMaxDays is null", () => {
    const open = { ...controls, oneTimeMaxDays: null };
    expect(
      checkCreateCard(
        open,
        { amountCents: 1000, duration: "ONE_TIME", lockAfterDate: "2030-01-01" },
        NOW,
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a lock date that is not a real calendar day", () => {
    const result = checkCreateCard(
      controls,
      { amountCents: 1000, duration: "ONE_TIME", lockAfterDate: "2026-02-31" },
      NOW,
    );
    expect(result.ok).toBe(false);
  });
});

describe("checkUpdateCard", () => {
  it("keeps every omitted field and returns the resulting state", () => {
    const result = checkUpdateCard(controls, card(), { amountCents: 70_000 }, NOW);
    expect(result).toEqual({
      ok: true,
      next: {
        amountCents: 70_000,
        currency: "USD",
        duration: "MONTHLY",
        lockAfterDate: null,
        allowedMerchants: ["Figma"],
        blockedMerchants: null,
      },
    });
  });

  it("clears the lock date and merchant lists on explicit null", () => {
    const current = card({
      spend_controls: {
        spend_limit: { amount: 1000, currency: "USD" },
        spend_duration: "ONE_TIME",
        lock_after_date: "2026-12-01",
        allowed_merchant_details: [{ name: "Figma" }],
        blocked_merchant_details: [{ name: "Other" }],
      },
    });
    const result = checkUpdateCard(
      controls,
      current,
      { duration: "MONTHLY", lockAfterDate: null, allowedMerchants: null, blockedMerchants: null },
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      next: { lockAfterDate: null, allowedMerchants: null, blockedMerchants: null },
    });
  });

  it("checks the cap against the resulting amount", () => {
    const result = checkUpdateCard(controls, card(), { amountCents: 600_000 }, NOW);
    expect(result.ok === false && result.reason).toMatch(/\$6,000\.00.*\$5,000\.00/);
  });

  it("applies the ONE_TIME lifetime rule to the resulting state, not the patch", () => {
    // Switching to ONE_TIME without a lock date leaves the card with no lock date.
    const result = checkUpdateCard(controls, card(), { duration: "ONE_TIME" }, NOW);
    expect(result.ok === false && result.reason).toMatch(/lock date/i);
  });

  it("refuses a duration the owner did not allow", () => {
    const result = checkUpdateCard(controls, card(), { duration: "YEARLY" }, NOW);
    expect(result.ok).toBe(false);
  });

  it("refuses a card whose limit is not USD", () => {
    const eur = card({
      spend_controls: {
        spend_limit: { amount: 1000, currency: "EUR" },
        spend_duration: "MONTHLY",
      },
    });
    const result = checkUpdateCard(controls, eur, { amountCents: 2000 }, NOW);
    expect(result.ok === false && result.reason).toMatch(/USD/);
  });

  it("refuses a USER-limit card and points to update_spend_limit", () => {
    const user = card({ limit_type: "USER", spend_controls: null });
    const result = checkUpdateCard(controls, user, { amountCents: 2000 }, NOW);
    expect(result.ok === false && result.reason).toContain("update_spend_limit");
  });
});

describe("checkCreateSpendLimit", () => {
  it("caps the base amount", () => {
    expect(checkCreateSpendLimit(controls, { amountCents: 1_000_000 })).toEqual({ ok: true });
    const over = checkCreateSpendLimit(controls, { amountCents: 1_000_001 });
    expect(over.ok === false && over.reason).toMatch(/\$10,000\.01.*\$10,000\.00/);
  });
});

describe("checkUpdateSpendLimit", () => {
  const ada = { userId: "u_ada", name: "Ada Example" };
  const cy = { userId: "u_cy", name: "Cy Demo" };

  it("accepts a safe limit and computes the resulting members", () => {
    const result = checkUpdateSpendLimit(controls, spendLimit(), {
      amountCents: 200_000,
      addMembers: [cy],
      removeMembers: [ada],
    });
    expect(result).toEqual({ ok: true, next: { memberUserIds: ["u_ben", "u_cy"] } });
  });

  it("leaves members out of the result when the patch does not touch them", () => {
    expect(checkUpdateSpendLimit(controls, spendLimit(), { endDate: "2027-01-01" })).toEqual({
      ok: true,
      next: {},
    });
  });

  it.each([
    [
      "SOFT",
      {
        authorization_settings: {
          base_limit: { amount: 1, currency: "USD" },
          authorization_type: "SOFT",
          rollover_refresh_rate: "OFF",
        },
      },
    ],
    ["ALL_MEMBERS", { auto_create_limit_cards_setting: "ALL_MEMBERS" }],
    [
      "buffered",
      {
        authorization_settings: {
          base_limit: { amount: 1, currency: "USD" },
          authorization_type: "HARD",
          limit_buffer_percentage: 10,
          rollover_refresh_rate: "OFF",
        },
      },
    ],
  ])("refuses a %s limit and tells the user to edit it in Brex", (_label, over) => {
    const result = checkUpdateSpendLimit(controls, spendLimit(over), { amountCents: 1000 });
    expect(result.ok === false && result.reason).toMatch(/Brex/);
  });

  it("refuses a limit whose settings it cannot read", () => {
    const result = checkUpdateSpendLimit(controls, spendLimit({ authorization_settings: null }), {
      endDate: "2027-01-01",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a non-USD limit and an amount over the base cap", () => {
    const eur = spendLimit({
      authorization_settings: {
        base_limit: { amount: 1, currency: "EUR" },
        authorization_type: "HARD",
        rollover_refresh_rate: "OFF",
      },
    });
    expect(checkUpdateSpendLimit(controls, eur, { amountCents: 1000 }).ok).toBe(false);
    const over = checkUpdateSpendLimit(controls, spendLimit(), { amountCents: 1_000_001 });
    expect(over.ok === false && over.reason).toMatch(/base amount/i);
  });

  it("checks the resulting amount, so an over-cap limit cannot be extended or given members", () => {
    const big = spendLimit({
      authorization_settings: {
        base_limit: { amount: 2_000_000, currency: "USD" },
        authorization_type: "HARD",
        rollover_refresh_rate: "OFF",
      },
    });
    const members = checkUpdateSpendLimit(controls, big, { addMembers: [cy] });
    expect(members.ok === false && members.reason).toMatch(/\$20,000\.00.*\$10,000\.00/);
    expect(checkUpdateSpendLimit(controls, big, { endDate: "2027-01-01" }).ok).toBe(false);
    expect(checkUpdateSpendLimit(controls, big, { status: "ACTIVE" }).ok).toBe(false);
    // Archiving stops all spending, so it is allowed; lowering below the cap is the other way out.
    expect(checkUpdateSpendLimit(controls, big, { status: "ARCHIVED" }).ok).toBe(true);
    expect(checkUpdateSpendLimit(controls, big, { amountCents: 500_000 }).ok).toBe(true);
  });

  it("refuses removing someone who is not a member", () => {
    const result = checkUpdateSpendLimit(controls, spendLimit(), { removeMembers: [cy] });
    expect(result.ok === false && result.reason).toContain("Cy Demo");
  });
});
