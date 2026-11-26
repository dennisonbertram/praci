import { EquityCashRaisedSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { EquityInputError } from "./ledger.js";
import { createEquityFundingRound, getEquityFundingRound } from "./rounds.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { attachEquityToRound, equityCashRaised } from "./views-financing.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres("equity cash raised and round membership (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-financing");
    await seedViewsTestLedger(f, f.mine);
  });
  afterAll(async () => {
    await f?.close();
  });

  it("totals cash by class, convertibles last, and by holder", async () => {
    const { prisma, mine } = f;
    const cash = EquityCashRaisedSchema.parse(
      await f.as(mine, () => equityCashRaised(prisma, mine)),
    );
    expect(cash.byClass.at(-1)).toMatchObject({ shareClassId: null, cashRaisedCents: "25000000" });
    expect(cash.byHolder[0]).toMatchObject({
      name: "Example Ventures",
      cashRaisedCents: "200000000",
    });
    expect(cash.totalCents).toBe("225000000");
    const early = await f.as(mine, () => equityCashRaised(prisma, mine, { asOf: "1999-01-01" }));
    expect(early.securities).toEqual([]);
  });

  it("attaches securities to a round and takes them out again", async () => {
    const { prisma, mine, owner } = f;
    const round = await f.as(mine, () =>
      createEquityFundingRound(prisma, mine, { name: "Seed", startDate: "2025-01-01" }),
    );
    const cash = await f.as(mine, () => equityCashRaised(prisma, mine));
    const seed = cash.securities.find((row) => row.stakeholderName === "Example Ventures")!;
    expect(
      await f.as(mine, () =>
        attachEquityToRound(prisma, mine, { roundId: round.id, certificateIds: [seed.id] }),
      ),
    ).toEqual({ certificates: 1, convertibles: 0 });
    expect(
      (await f.as(mine, () => getEquityFundingRound(prisma, mine, round.id))).cashRaisedCents,
    ).toBe("200000000");
    expect(
      await owner.equityTransaction.count({
        where: { ...mine, certificateId: seed.id, kind: "modify" },
      }),
    ).toBe(1);
    await f.as(mine, () =>
      attachEquityToRound(prisma, mine, { roundId: null, certificateIds: [seed.id] }),
    );
    expect(
      (await f.as(mine, () => getEquityFundingRound(prisma, mine, round.id))).cashRaisedCents,
    ).toBe("0");
  });

  it("keeps other users and spaces out", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const cash = await f.as(mine, () => equityCashRaised(prisma, mine));
    const id = cash.securities[0]!.id;
    for (const scope of [sameSpace, otherSpace]) {
      expect((await f.as(scope, () => equityCashRaised(prisma, scope))).securities).toEqual([]);
      await expect(
        f.as(scope, () =>
          attachEquityToRound(prisma, scope, { roundId: null, certificateIds: [id] }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
  });
});
