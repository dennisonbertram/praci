import { describe, expect, it } from "vitest";
import type { CapCertificate, CapClass, CapOptionGrant, CapPlan } from "./cap-table.js";
import { computeCapTable } from "./cap-table.js";
import { parseFixed } from "./fixed.js";

const common: CapClass = {
  id: "common",
  name: "Common",
  classType: "common",
  authorizedShares: 10_000_000n,
};
const plan: CapPlan = { id: "plan", name: "Plan", shareClassId: "common", reservedShares: 1_000n };

const cert = (over: Partial<CapCertificate> & { id: string }): CapCertificate => ({
  stakeholderId: "a",
  shareClassId: "common",
  quantity: 0n,
  status: "outstanding",
  issueDate: "2023-01-01",
  cashPaidCents: 0n,
  ...over,
});
const holdings = (certificates: CapCertificate[], asOf: string, extra = {}) =>
  computeCapTable({
    classes: [common],
    certificates,
    plans: [],
    optionGrants: [],
    convertibles: [],
    asOf,
    ...extra,
  });
const sharesOf = (table: ReturnType<typeof holdings>, id: string) =>
  table.stakeholders.find((row) => row.stakeholderId === id)?.outstandingShares ?? 0n;

describe("cap table as of a past date", () => {
  // A holds 1,000 shares bought for $1,000.00, transfers them to B on 2024-06-01.
  const transferred = [
    cert({
      id: "parent",
      quantity: 1_000n,
      status: "transferred",
      closedOn: "2024-06-01",
      cashPaidCents: 100_000n,
    }),
    cert({
      id: "child",
      stakeholderId: "b",
      quantity: 1_000n,
      issueDate: "2024-06-01",
      cashPaidCents: 100_000n,
    }),
  ];

  it("shows the seller before a transfer and the buyer from its date", () => {
    const before = holdings(transferred, "2024-01-01");
    expect(sharesOf(before, "a")).toBe(1_000n);
    expect(sharesOf(before, "b")).toBe(0n);
    const onDay = holdings(transferred, "2024-06-01");
    expect(sharesOf(onDay, "a")).toBe(0n);
    expect(sharesOf(onDay, "b")).toBe(1_000n);
    expect(holdings(transferred, "2025-01-01").totals.outstandingShares).toBe(1_000n);
  });

  it("keeps cash raised per holder and per class across a transfer", () => {
    const after = holdings(transferred, "2025-01-01");
    expect(after.stakeholders.find((row) => row.stakeholderId === "b")?.cashRaisedCents).toBe(
      100_000n,
    );
    expect(after.classes[0]?.amountRaisedCents).toBe(100_000n);
    expect(holdings(transferred, "2024-01-01").classes[0]?.amountRaisedCents).toBe(100_000n);
    expect(after.totals.amountRaisedCents).toBe(100_000n);
  });

  it("keeps the remainder's cash after a partial cancellation", () => {
    // 1,000 shares for $1,000.00; 400 canceled on 2024-06-01 leaves a 600 share child with $600.00.
    const table = holdings(
      [
        cert({
          id: "parent",
          quantity: 1_000n,
          status: "canceled",
          closedOn: "2024-06-01",
          cashPaidCents: 100_000n,
        }),
        cert({
          id: "rest",
          quantity: 600n,
          issueDate: "2024-06-01",
          cashPaidCents: 60_000n,
        }),
      ],
      "2025-01-01",
    );
    expect(table.totals.outstandingShares).toBe(600n);
    expect(table.classes[0]?.amountRaisedCents).toBe(60_000n);
    expect(holdings([], "2025-01-01").classes[0]?.amountRaisedCents).toBe(0n);
    // Before the cancellation the full issuance stands.
    const earlier = holdings(
      [
        cert({
          id: "parent",
          quantity: 1_000n,
          status: "canceled",
          closedOn: "2024-06-01",
          cashPaidCents: 100_000n,
        }),
        cert({ id: "rest", quantity: 600n, issueDate: "2024-06-01", cashPaidCents: 60_000n }),
      ],
      "2024-03-01",
    );
    expect(earlier.totals.outstandingShares).toBe(1_000n);
    expect(earlier.classes[0]?.amountRaisedCents).toBe(100_000n);
  });

  it("counts options exercised after the date as outstanding options, not as shares or pool use", () => {
    const grant: CapOptionGrant = {
      id: "g",
      stakeholderId: "a",
      planId: "plan",
      quantity: 100n,
      exercisedQuantity: 100n,
      canceledQuantity: 0n,
      status: "exercised",
      grantDate: "2024-01-01",
      exercises: [{ date: "2025-03-01", quantity: 100n }],
    };
    const exerciseCertificate = cert({ id: "ex", quantity: 100n, issueDate: "2025-03-01" });
    const input = { plans: [plan], optionGrants: [grant] };
    const before = holdings([exerciseCertificate], "2024-06-01", input);
    expect(before.totals.outstandingShares).toBe(0n);
    expect(before.plans[0]).toMatchObject({ outstandingShares: 100n, availableShares: 900n });
    expect(before.totals.fullyDilutedShares).toBe(1_000n);
    const after = holdings([exerciseCertificate], "2025-06-01", input);
    expect(after.totals.outstandingShares).toBe(100n);
    expect(after.plans[0]).toMatchObject({ outstandingShares: 0n, availableShares: 900n });
    // A grant made after the date does not exist yet.
    const early = holdings([], "2023-06-01", input);
    expect(early.plans[0]).toMatchObject({ outstandingShares: 0n, availableShares: 1_000n });
  });

  it("restores an option cancellation dated after the date, and a reversal of it", () => {
    const canceled: CapOptionGrant = {
      id: "g",
      stakeholderId: "a",
      planId: "plan",
      quantity: 100n,
      exercisedQuantity: 0n,
      canceledQuantity: 100n,
      status: "canceled",
      grantDate: "2024-01-01",
      cancellations: [{ date: "2025-01-01", quantity: 100n }],
    };
    const at = (grant: CapOptionGrant, asOf: string) =>
      holdings([], asOf, { plans: [plan], optionGrants: [grant] }).plans[0]?.outstandingShares;
    expect(at(canceled, "2024-06-01")).toBe(100n);
    expect(at(canceled, "2025-06-01")).toBe(0n);
    const reversed: CapOptionGrant = {
      ...canceled,
      canceledQuantity: 0n,
      status: "outstanding",
      cancellations: [
        { date: "2025-01-01", quantity: 100n },
        { date: "2026-01-01", quantity: -100n },
      ],
    };
    expect(at(reversed, "2024-06-01")).toBe(100n);
    expect(at(reversed, "2025-06-01")).toBe(0n);
    expect(at(reversed, "2026-06-01")).toBe(100n);
  });

  it("keeps a SAFE converted after the date as an open convertible with no shares", () => {
    const safe = {
      id: "safe",
      stakeholderId: "a",
      blockId: null,
      blockName: null,
      principalCents: 50_000n,
      status: "converted",
      issueDate: "2024-01-01",
      closedOn: "2025-02-01",
    };
    const conversion = cert({
      id: "from-safe",
      quantity: 500n,
      issueDate: "2025-02-01",
      debtCanceledCents: 50_000n,
      fromConvertible: true,
    });
    const before = holdings([conversion], "2024-12-31", { convertibles: [safe] });
    expect(before.convertibles).toHaveLength(1);
    expect(before.totals.outstandingShares).toBe(0n);
    expect(before.totals.amountRaisedCents).toBe(50_000n);
    const after = holdings([conversion], "2025-02-01", { convertibles: [safe] });
    expect(after.convertibles).toHaveLength(0);
    expect(after.totals.outstandingShares).toBe(500n);
    // The principal is raised once, not again as the conversion certificate's consideration.
    expect(after.totals.amountRaisedCents).toBe(50_000n);
  });
});

describe("conversion ratio in fully diluted", () => {
  it("counts a class at its ratio as converted, outstanding stays as issued", () => {
    const preferred: CapClass = {
      id: "pref",
      name: "Preferred",
      classType: "preferred",
      authorizedShares: 1_000n,
      conversionRatio: parseFixed("2"),
    };
    const table = computeCapTable({
      classes: [common, preferred],
      certificates: [
        cert({ id: "c", quantity: 100n }),
        cert({ id: "p", stakeholderId: "b", shareClassId: "pref", quantity: 50n }),
      ],
      plans: [],
      optionGrants: [],
      convertibles: [],
      asOf: "2025-01-01",
    });
    expect(table.totals.outstandingShares).toBe(150n);
    expect(table.totals.fullyDilutedShares).toBe(200n);
    expect(table.classes[1]?.fullyDilutedShares).toBe(100n);
    expect(table.classes[1]?.fullyDilutedPercent).toBe("50.0000");
    expect(table.stakeholders.find((row) => row.stakeholderId === "b")?.fullyDilutedShares).toBe(
      100n,
    );
  });
});

describe("plan pool as of a past date", () => {
  // The pool was 600 shares, grew by 400 on 2024-06-01 and gave 100 away on 2025-03-01.
  const grown: CapPlan = {
    ...plan,
    reservedShares: 900n,
    reservedChanges: [
      { date: "2023-01-01", shares: 600n },
      { date: "2024-06-01", shares: 400n },
      { date: "2025-03-01", shares: -100n },
    ],
  };
  const poolOn = (asOf: string) =>
    holdings([], asOf, { plans: [grown] }).totals.availablePlanShares;

  it("replays the dated pool changes instead of using today's reserve", () => {
    expect(poolOn("2022-12-31")).toBe(0n);
    expect(poolOn("2024-01-01")).toBe(600n);
    expect(poolOn("2024-06-01")).toBe(1_000n);
    expect(poolOn("2025-03-01")).toBe(900n);
  });

  it("counts the as-of pool in fully diluted", () => {
    expect(holdings([], "2024-01-01", { plans: [grown] }).totals.fullyDilutedShares).toBe(600n);
  });
});
