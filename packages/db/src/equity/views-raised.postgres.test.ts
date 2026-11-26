import { afterAll, beforeAll, expect, it } from "vitest";
import { equityOverview } from "./overview.js";
import { createEquityFundingRound, listEquityFundingRounds } from "./rounds.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { attachEquityToRound, equityCashRaised } from "./views-financing.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres(
  "money raised agrees across overview, rounds and cash raised (PostgreSQL)",
  () => {
    let f: EquityFixture;
    beforeAll(async () => {
      f = await equityFixture("views-raised");
      await seedViewsTestLedger(f, f.mine);
    });
    afterAll(async () => {
      await f?.close();
    });

    it("counts a transfer child instead of its parent and not a conversion certificate as new money", async () => {
      const { prisma, mine, owner } = f;
      const fund = await owner.equityCertificate.findFirstOrThrow({
        where: { ...mine, cashPaidCents: { gt: 0n } },
      });
      const safe = await owner.equityConvertible.findFirstOrThrow({ where: mine });
      // The fund's certificate is transferred whole: its child carries the same cash and replaces
      // it. A certificate a SAFE converted into carries a figure that must not be counted again
      // (invented values).
      const child = await owner.equityCertificate.create({
        data: {
          ...mine,
          label: "PS-T1",
          stakeholderId: fund.stakeholderId,
          shareClassId: fund.shareClassId,
          quantity: 1000n,
          cashPaidCents: fund.cashPaidCents,
          issueDate: fund.issueDate,
          parentId: fund.id,
        },
      });
      await owner.equityCertificate.update({
        where: { id: fund.id },
        data: { status: "transferred" },
      });
      const converted = await owner.equityCertificate.create({
        data: {
          ...mine,
          label: "PS-C1",
          stakeholderId: safe.stakeholderId,
          shareClassId: fund.shareClassId,
          quantity: 2000n,
          cashPaidCents: 0n,
          debtCanceledCents: safe.principalCents,
          issueDate: fund.issueDate,
        },
      });
      await owner.equityConvertible.update({
        where: { id: safe.id },
        data: { status: "converted", convertedToId: converted.id },
      });

      const round = await f.as(mine, () =>
        createEquityFundingRound(prisma, mine, { name: "Seed", startDate: "2020-01-01" }),
      );
      await f.as(mine, () =>
        attachEquityToRound(prisma, mine, {
          roundId: round.id,
          certificateIds: [fund.id, child.id, converted.id],
          convertibleIds: [safe.id],
        }),
      );

      const overview = await f.as(mine, () => equityOverview(prisma, mine));
      const cash = await f.as(mine, () => equityCashRaised(prisma, mine));
      const rounds = await f.as(mine, () => listEquityFundingRounds(prisma, mine, {}));
      const expected = (fund.cashPaidCents + safe.principalCents).toString();
      expect(overview.totals.amountRaisedCents).toBe(expected);
      expect(cash.totalCents).toBe(expected);
      expect(rounds.items.find((row) => row.id === round.id)?.cashRaisedCents).toBe(expected);
      expect(cash.securities.map((row) => row.label)).toContain("PS-T1");
      expect(cash.securities.map((row) => row.label)).not.toContain(fund.label);
      expect(cash.securities.map((row) => row.label)).not.toContain("PS-C1");
    });
  },
);
