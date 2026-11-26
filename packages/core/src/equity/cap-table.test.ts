import { describe, expect, it } from "vitest";
import type {
  CapCertificate,
  CapClass,
  CapConvertible,
  CapOptionGrant,
  CapPlan,
} from "./cap-table.js";
import { computeCapTable, optionPoolAvailable } from "./cap-table.js";

const common: CapClass = {
  id: "class-common",
  name: "Common",
  classType: "common",
  authorizedShares: 10_000_000n,
};
const preferred: CapClass = {
  id: "class-preferred",
  name: "Series Seed",
  classType: "preferred",
  authorizedShares: 2_000_000n,
  seniority: 1,
  pariPassu: true,
};

const plan: CapPlan = {
  id: "plan-2024",
  name: "2024 Equity Plan",
  shareClassId: common.id,
  reservedShares: 1_000_000n,
};

function certificate(overrides: Partial<CapCertificate> & { id: string }): CapCertificate {
  return {
    stakeholderId: "stakeholder-1",
    shareClassId: common.id,
    quantity: 0n,
    status: "outstanding",
    issueDate: "2024-01-01",
    cashPaidCents: 0n,
    ...overrides,
  };
}

function grant(overrides: Partial<CapOptionGrant> & { id: string }): CapOptionGrant {
  return {
    stakeholderId: "stakeholder-1",
    planId: plan.id,
    quantity: 0n,
    exercisedQuantity: 0n,
    canceledQuantity: 0n,
    status: "outstanding",
    grantDate: "2024-03-01",
    ...overrides,
  };
}

function convertible(overrides: Partial<CapConvertible> & { id: string }): CapConvertible {
  return {
    stakeholderId: "stakeholder-1",
    blockId: null,
    blockName: null,
    principalCents: 0n,
    status: "outstanding",
    issueDate: "2024-01-01",
    ...overrides,
  };
}

const certificates: CapCertificate[] = [
  certificate({
    id: "cert-1",
    stakeholderId: "s-1",
    quantity: 4_000_000n,
    cashPaidCents: 1_000_000n,
  }),
  certificate({
    id: "cert-2",
    stakeholderId: "s-2",
    quantity: 1_000_000n,
    issueDate: "2024-02-01",
    debtCanceledCents: 500_000n,
    ipTransferredCents: 250_000n,
  }),
  certificate({
    id: "cert-3",
    stakeholderId: "s-3",
    shareClassId: preferred.id,
    quantity: 1_000_000n,
    issueDate: "2024-06-01",
    cashPaidCents: 100_000_000n,
  }),
  certificate({
    id: "cert-canceled",
    stakeholderId: "s-4",
    quantity: 500_000n,
    status: "canceled",
    issueDate: "2024-03-01",
  }),
  certificate({
    id: "cert-future",
    stakeholderId: "s-5",
    quantity: 500_000n,
    issueDate: "2025-01-01",
  }),
  certificate({
    id: "cert-recognized",
    stakeholderId: "s-2",
    quantity: 250_000n,
    status: "performance_recognized",
    issueDate: "2024-07-01",
  }),
];

const optionGrants: CapOptionGrant[] = [
  grant({
    id: "grant-1",
    stakeholderId: "s-1",
    quantity: 300_000n,
    exercisedQuantity: 50_000n,
  }),
  grant({ id: "grant-2", stakeholderId: "s-2", quantity: 100_000n, grantDate: "2025-06-01" }),
  grant({
    id: "grant-3",
    stakeholderId: "s-2",
    quantity: 200_000n,
    exercisedQuantity: 100_000n,
    status: "exercised",
    grantDate: "2024-04-01",
  }),
  grant({
    id: "grant-4",
    stakeholderId: "s-3",
    quantity: 40_000n,
    exercisedQuantity: 50_000n,
    grantDate: "2024-05-01",
  }),
];

const convertibles: CapConvertible[] = [
  convertible({
    id: "safe-1",
    stakeholderId: "s-1",
    blockId: "block-ff",
    blockName: "Friends & family",
    principalCents: 500_000n,
    interestCents: 10_000n,
  }),
  convertible({
    id: "safe-2",
    stakeholderId: "s-2",
    blockId: "block-ff",
    blockName: "Friends & family",
    principalCents: 250_000n,
    interestCents: 5_000n,
  }),
  convertible({ id: "safe-3", stakeholderId: "s-3", principalCents: 1_000_000n }),
  convertible({
    id: "safe-converted",
    stakeholderId: "s-1",
    principalCents: 9_000_000n,
    status: "converted",
  }),
];

const input = {
  classes: [common, preferred],
  certificates,
  plans: [plan],
  optionGrants,
  convertibles,
  asOf: "2024-12-31",
};

describe("computeCapTable", () => {
  const table = computeCapTable(input);

  it("totals outstanding and fully diluted shares", () => {
    expect(table.totals.outstandingShares).toBe(6_250_000n);
    expect(table.totals.commonShares).toBe(5_250_000n);
    expect(table.totals.preferredShares).toBe(1_000_000n);
    expect(table.totals.availablePlanShares).toBe(550_000n);
    expect(table.totals.fullyDilutedShares).toBe(7_050_000n);
    // Class cash plus every convertible's principal, converted ones included.
    expect(table.totals.amountRaisedCents).toBe(101_750_000n + 10_750_000n);
  });

  it("builds per-class rows with outstanding and fully diluted percents", () => {
    const commonRow = table.classes[0];
    expect(commonRow).toMatchObject({
      shareClassId: common.id,
      name: "Common",
      classType: "common",
      authorizedShares: 10_000_000n,
      outstandingShares: 5_250_000n,
      outstandingPercent: "84.0000",
      fullyDilutedShares: 6_050_000n,
      fullyDilutedPercent: "85.8156",
      amountRaisedCents: 1_750_000n,
    });
    const preferredRow = table.classes[1];
    expect(preferredRow).toMatchObject({
      shareClassId: preferred.id,
      outstandingShares: 1_000_000n,
      outstandingPercent: "16.0000",
      fullyDilutedShares: 1_000_000n,
      fullyDilutedPercent: "14.1844",
      amountRaisedCents: 100_000_000n,
    });
  });

  it("counts outstanding options and the pool left to grant per plan", () => {
    expect(table.plans).toEqual([
      {
        planId: plan.id,
        name: "2024 Equity Plan",
        outstandingShares: 250_000n,
        availableShares: 550_000n,
        fullyDilutedPercent: "11.3475",
      },
    ]);
  });

  it("groups convertibles by block and ignores converted ones", () => {
    expect(table.convertibles).toEqual([
      {
        blockId: "block-ff",
        name: "Friends & family",
        principalCents: 750_000n,
        interestCents: 15_000n,
        outstandingDebtCents: 765_000n,
        amountRaisedCents: 750_000n,
      },
      {
        blockId: null,
        name: "Convertibles",
        principalCents: 1_000_000n,
        interestCents: 0n,
        outstandingDebtCents: 1_000_000n,
        amountRaisedCents: 1_000_000n,
      },
    ]);
  });

  it("builds stakeholder rows with their options and per-class split", () => {
    const byId = new Map(table.stakeholders.map((row) => [row.stakeholderId, row]));
    expect([...byId.keys()]).toEqual(["s-1", "s-2", "s-3"]);
    expect(byId.get("s-1")).toEqual({
      stakeholderId: "s-1",
      outstandingShares: 4_000_000n,
      outstandingPercent: "64.0000",
      fullyDilutedShares: 4_250_000n,
      fullyDilutedPercent: "60.2837",
      cashRaisedCents: 1_000_000n,
      byClass: [
        { shareClassId: common.id, outstandingShares: 4_000_000n, fullyDilutedShares: 4_250_000n },
      ],
    });
    expect(byId.get("s-2")).toEqual({
      stakeholderId: "s-2",
      outstandingShares: 1_250_000n,
      outstandingPercent: "20.0000",
      fullyDilutedShares: 1_250_000n,
      fullyDilutedPercent: "17.7305",
      cashRaisedCents: 0n,
      byClass: [
        { shareClassId: common.id, outstandingShares: 1_250_000n, fullyDilutedShares: 1_250_000n },
      ],
    });
    expect(byId.get("s-3")).toEqual({
      stakeholderId: "s-3",
      outstandingShares: 1_000_000n,
      outstandingPercent: "16.0000",
      fullyDilutedShares: 1_000_000n,
      fullyDilutedPercent: "14.1844",
      cashRaisedCents: 100_000_000n,
      byClass: [
        {
          shareClassId: preferred.id,
          outstandingShares: 1_000_000n,
          fullyDilutedShares: 1_000_000n,
        },
      ],
    });
  });

  it("counts nothing before the first issue, and reports zero percents safely", () => {
    const empty = computeCapTable({
      classes: [common],
      certificates: [],
      plans: [],
      optionGrants: [],
      convertibles: [],
      asOf: "2023-01-01",
    });
    expect(empty.totals).toEqual({
      outstandingShares: 0n,
      fullyDilutedShares: 0n,
      commonShares: 0n,
      preferredShares: 0n,
      availablePlanShares: 0n,
      amountRaisedCents: 0n,
    });
    expect(empty.classes[0]).toMatchObject({
      outstandingPercent: "0.0000",
      fullyDilutedPercent: "0.0000",
      fullyDilutedShares: 0n,
    });
    expect(empty.stakeholders).toEqual([]);
  });

  it("handles counts past 2^53", () => {
    const big = 9_007_199_254_740_993n;
    const table = computeCapTable({
      classes: [common],
      certificates: [certificate({ id: "big", quantity: big, cashPaidCents: big })],
      plans: [],
      optionGrants: [],
      convertibles: [],
      asOf: "2024-12-31",
    });
    expect(table.totals.outstandingShares).toBe(big);
    expect(table.totals.amountRaisedCents).toBe(big);
    expect(table.classes[0]?.outstandingPercent).toBe("100.0000");
  });

  it("counts a plan's exercised shares but never lets its pool go negative", () => {
    const smallPlan: CapPlan = {
      id: "plan-small",
      name: "Small plan",
      shareClassId: common.id,
      reservedShares: 100n,
    };
    expect(
      optionPoolAvailable(smallPlan, [grant({ id: "g", planId: smallPlan.id, quantity: 500n })]),
    ).toBe(0n);
    expect(
      optionPoolAvailable(smallPlan, [
        grant({ id: "g", planId: smallPlan.id, quantity: 100n, exercisedQuantity: 40n }),
        grant({ id: "other", planId: "other-plan", quantity: 900n }),
      ]),
    ).toBe(0n);
    expect(
      optionPoolAvailable({ ...smallPlan, reservedShares: 200n }, [
        grant({ id: "g", planId: smallPlan.id, quantity: 100n, exercisedQuantity: 40n }),
      ]),
    ).toBe(100n);
    expect(optionPoolAvailable(smallPlan, [])).toBe(100n);
  });
});
