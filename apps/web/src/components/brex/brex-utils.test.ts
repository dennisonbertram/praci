import type { BrexCategorySpend, BrexPerson } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  isSpendCents,
  limitBarClass,
  offboardMessage,
  offboardPlan,
  spendCategoryTotals,
} from "./brex-utils";

const person = (overrides: Partial<BrexPerson> = {}): BrexPerson => ({
  userId: "user_ada",
  name: "Ada Example",
  email: null,
  status: "ACTIVE",
  cards: [
    { cardId: "card_ops", name: "Ops card", lastFour: "4821", status: "ACTIVE" },
    { cardId: "card_old", name: "Old card", lastFour: "1188", status: "TERMINATED" },
  ],
  activeCardCount: 1,
  terminatedCardCount: 1,
  spendLimitIds: ["limit_cloud"],
  spendLimitNames: ["Cloud budget"],
  monthSpendCents: 0,
  windowSpendCents: 0,
  partial: false,
  ...overrides,
});

describe("isSpendCents", () => {
  it("counts only positive amounts as spend", () => {
    expect(isSpendCents(-100)).toBe(false);
    expect(isSpendCents(0)).toBe(false);
    expect(isSpendCents(100)).toBe(true);
  });
});

describe("spendCategoryTotals", () => {
  const category = (
    bucket: BrexCategorySpend["bucket"],
    cents: number,
    count = 1,
  ): BrexCategorySpend => ({ bucket, cents, count, partial: false, merchants: [] });

  it("uses net category cents and drops buckets refunds outweigh", () => {
    expect(
      spendCategoryTotals([
        category("software", 6_000, 2),
        category("meals", -1_000),
        category("travel", 0),
      ]),
    ).toEqual([{ bucket: "software", cents: 6_000, count: 2 }]);
  });
});

describe("offboardPlan", () => {
  it("locks active cards, cancels every card that is not terminated, and keeps spend limits", () => {
    expect(offboardPlan(person())).toEqual({
      lockCardIds: ["card_ops"],
      cancelCardIds: ["card_ops"],
      spendLimitIds: ["limit_cloud"],
    });
  });

  it("does not lock an already locked card but still cancels it", () => {
    const locked = person({
      cards: [
        { cardId: "card_locked", name: "Locked card", lastFour: "1111", status: "LOCKED" },
        { cardId: "card_active", name: "Active card", lastFour: "2222", status: "ACTIVE" },
      ],
    });
    expect(offboardPlan(locked)).toEqual({
      lockCardIds: ["card_active"],
      cancelCardIds: ["card_locked", "card_active"],
      spendLimitIds: ["limit_cloud"],
    });
  });

  it("drops ids that are not safe to send to the agent", () => {
    const unsafe = person({
      cards: [{ cardId: "bad id; drop", name: "Bad", lastFour: "0000", status: "ACTIVE" }],
      spendLimitIds: ["limit_ok", "bad limit"],
    });
    expect(offboardPlan(unsafe)).toEqual({
      lockCardIds: [],
      cancelCardIds: [],
      spendLimitIds: ["limit_ok"],
    });
  });
});

describe("offboardMessage", () => {
  it("is the fixed Offboard template with only ids, never names", () => {
    expect(offboardMessage(person())).toBe(
      "Offboard Ada Example: lock their cards card_ops, cancel card_ops, remove them from limits limit_cloud.",
    );
  });

  it("omits empty steps and keeps the order lock, cancel, limits", () => {
    const invited = person({
      name: "Jules Example",
      cards: [],
      spendLimitIds: ["limit_events", "limit_ops"],
    });
    expect(offboardMessage(invited)).toBe(
      "Offboard Jules Example: remove them from limits limit_events, limit_ops.",
    );
  });
});

describe("limitBarClass", () => {
  it("is ink below 80, warning from 80, destructive from 100", () => {
    expect(limitBarClass(79)).toBe("bg-foreground/70");
    expect(limitBarClass(80)).toBe("bg-warning");
    expect(limitBarClass(99.9)).toBe("bg-warning");
    expect(limitBarClass(100)).toBe("bg-destructive");
    expect(limitBarClass(212)).toBe("bg-destructive");
  });
});
