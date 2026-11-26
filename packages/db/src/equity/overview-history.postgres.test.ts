import { randomUUID } from "node:crypto";
import { computeCapTable } from "@rakazo/core/equity";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createEquityOptionGrant } from "./options.js";
import { cancelEquityOptionGrant } from "./options-cancel.js";
import { exerciseEquityOptions } from "./options-exercise.js";
import { loadLedger } from "./overview.js";
import { createEquityCertificate } from "./securities.js";
import {
  cancelEquityCertificate,
  convertEquityCertificate,
  transferEquityCertificate,
} from "./securities-transactions.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { loadEquityRaised } from "./views-raised.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describeEquityPostgres("cap table as of a past date (PostgreSQL)", () => {
  let f: EquityFixture;
  let adaId = "";
  let benId = "";
  let commonId = "";
  let preferredId = "";
  let planId = "";

  beforeAll(async () => {
    f = await equityFixture("overview-history");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    adaId = (
      await owner.equityStakeholder.create({
        data: { ...scope, type: "individual", name: "Ada Example" },
      })
    ).id;
    benId = (
      await owner.equityStakeholder.create({
        data: { ...scope, type: "individual", name: "Ben Sample" },
      })
    ).id;
    const makeClass = async (name: string, prefix: string, classType: string) => {
      const row = await owner.equityShareClass.create({
        data: { ...scope, name, prefix, classType },
      });
      await owner.equityShareClassVersion.create({
        data: {
          ...scope,
          shareClassId: row.id,
          documentDate: day("2022-01-01"),
          authorizedShares: 1_000_000n,
        },
      });
      return row.id;
    };
    commonId = await makeClass("Common", "CS", "common");
    preferredId = await makeClass("Series A Preferred", "PA", "preferred");
    planId = (
      await owner.equityPlan.create({
        data: { ...scope, name: "2024 Plan", shareClassId: commonId, reservedShares: 10_000n },
      })
    ).id;
  });

  afterAll(async () => {
    await f?.close();
  });

  const table = async (asOf: string) => {
    const { input } = await f.as(f.mine, () => loadLedger(f.prisma, f.mine, asOf));
    return computeCapTable(input);
  };
  const shares = (result: Awaited<ReturnType<typeof table>>, id: string) =>
    result.stakeholders.find((row) => row.stakeholderId === id)?.outstandingShares ?? 0n;
  const cash = (result: Awaited<ReturnType<typeof table>>, id: string) =>
    result.stakeholders.find((row) => row.stakeholderId === id)?.cashRaisedCents ?? 0n;

  it("rebuilds holdings before a transfer and keeps cash raised through a transfer and a partial cancel", async () => {
    const { prisma, mine } = f;
    const issued = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "1000",
        cashPaidCents: "100000",
        issueDate: "2023-01-01",
      }),
    );
    const moved = await f.as(mine, () =>
      transferEquityCertificate(prisma, mine, {
        certificateId: issued.id,
        toStakeholderId: benId,
        quantity: "600",
        effectiveDate: "2024-06-01",
        reason: "secondary",
      }),
    );
    const remainder = moved.resulting.find((row) => row.stakeholderId === adaId)!;
    await f.as(mine, () =>
      cancelEquityCertificate(prisma, mine, {
        certificateId: remainder.id,
        quantity: "200",
        effectiveDate: "2024-09-01",
        reason: "dissolved",
      }),
    );

    const before = await table("2024-01-01");
    expect(shares(before, adaId)).toBe(1_000n);
    expect(shares(before, benId)).toBe(0n);
    expect(before.classes.find((row) => row.shareClassId === commonId)?.amountRaisedCents).toBe(
      100_000n,
    );

    const between = await table("2024-07-01");
    expect(shares(between, adaId)).toBe(400n);
    expect(shares(between, benId)).toBe(600n);
    expect(cash(between, adaId)).toBe(40_000n);
    expect(cash(between, benId)).toBe(60_000n);
    expect(between.totals.amountRaisedCents).toBe(100_000n);

    const now = await table("2025-01-01");
    expect(shares(now, adaId)).toBe(200n);
    expect(cash(now, adaId)).toBe(20_000n);
    expect(cash(now, benId)).toBe(60_000n);
    // One definition of raised: the cap table and the shared loader agree.
    const raised = await f.as(mine, () => loadEquityRaised(prisma, mine, { asOf: "2025-01-01" }));
    expect(raised.totalCents).toBe(now.totals.amountRaisedCents);
    expect(raised.totalCents).toBe(80_000n);
    expect(
      (await f.as(mine, () => loadEquityRaised(prisma, mine, { asOf: "2024-07-01" }))).totalCents,
    ).toBe(100_000n);
  });

  it("shows options exercised after the date as options, and a certificate converted after it as it was", async () => {
    const { prisma, mine } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId: adaId,
        planId,
        optionType: "nso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
        earlyExercise: true,
      }),
    );
    await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "40",
        exerciseDate: "2025-03-01",
        requestKey: randomUUID(),
      }),
    );
    await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, {
        id: grant.id,
        quantity: "60",
        canceledOn: "2025-04-01",
        reason: "write_off_cancel",
      }),
    );
    const early = (await table("2024-06-01")).plans[0]!;
    expect(early).toMatchObject({ outstandingShares: 100n, availableShares: 9_900n });
    const late = (await table("2025-06-01")).plans[0]!;
    expect(late).toMatchObject({ outstandingShares: 0n, availableShares: 9_960n });
    expect((await table("2025-03-15")).plans[0]).toMatchObject({ outstandingShares: 60n });

    const preferred = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: benId,
        shareClassId: preferredId,
        quantity: "50",
        issueDate: "2023-02-01",
      }),
    );
    await f.as(mine, () =>
      convertEquityCertificate(prisma, mine, {
        certificateId: preferred.id,
        toShareClassId: commonId,
        ratio: "1",
        effectiveDate: "2025-05-01",
      }),
    );
    const classShares = async (asOf: string, classId: string) =>
      (await table(asOf)).classes.find((row) => row.shareClassId === classId)?.outstandingShares;
    expect(await classShares("2025-04-30", preferredId)).toBe(50n);
    expect(await classShares("2025-05-01", preferredId)).toBe(0n);
  });
});
