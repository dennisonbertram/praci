import { EquityRoundModelSchema } from "@rakazo/contracts";
import { divRoundHalfUp, parseFixed, SCALE } from "@rakazo/core/equity";
import { afterAll, beforeAll, expect, it } from "vitest";
import { EquityInputError } from "./ledger.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { equityModelRound } from "./views-model-round.js";
import { createEquityRoundScenario } from "./views-scenarios.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres("equity round modeling (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-model-round");
    await seedViewsTestLedger(f, f.mine);
  });
  afterAll(async () => {
    await f?.close();
  });

  const terms = {
    preMoneyValuationCents: "2000000000",
    targetPoolPercent: "10",
    investments: [{ name: "New Investor", amountCents: "500000000" }],
  };

  it("models unsaved terms without touching the ledger", async () => {
    const { prisma, owner, mine } = f;
    const counts = async () =>
      Promise.all([
        owner.equityTransaction.count({ where: mine }),
        owner.equityCertificate.count({ where: mine }),
      ]);
    const before = await counts();
    const model = EquityRoundModelSchema.parse(
      await f.as(mine, () => equityModelRound(prisma, mine, terms)),
    );
    expect(await counts()).toEqual(before);

    // Conversions and the pool increase are both counted pre-money. The kernel prices on the exact
    // (unfloored) conversion shares, so allow for the share floors.
    const roundPrice = divRoundHalfUp(
      BigInt(terms.preMoneyValuationCents) * SCALE,
      100n * BigInt(model.preMoneyFullyDilutedShares),
    );
    const modeled = parseFixed(model.pricePerShare);
    const priceGap = modeled > roundPrice ? modeled - roundPrice : roundPrice - modeled;
    expect(priceGap * 1_000_000n).toBeLessThan(roundPrice);

    // The shared kernel returns both SAFE conversions and new-money shares.
    const conversion = model.rows.find((row) => row.kind === "conversion");
    expect(conversion).toBeDefined();
    expect(BigInt(model.conversionShares)).toBeGreaterThan(0n);
    expect(BigInt(model.newMoneyShares)).toBeGreaterThan(0n);
    expect(model.rows.find((row) => row.kind === "new_money")?.id).toBe("investment-0");

    // The row shares sum to post-money fully diluted.
    const postSum = model.rows.reduce((sum, row) => sum + BigInt(row.postShares), 0n);
    expect(postSum).toBe(BigInt(model.postMoneyFullyDilutedShares));
    expect(BigInt(model.postMoneyValuationCents)).toBe(
      BigInt(terms.preMoneyValuationCents) + BigInt(terms.investments[0]!.amountCents),
    );
  });

  it("models a saved scenario by id", async () => {
    const { prisma, mine } = f;
    const saved = await f.as(mine, () =>
      createEquityRoundScenario(prisma, mine, { ...terms, name: "Series A plan" }),
    );
    const model = await f.as(mine, () => equityModelRound(prisma, mine, { scenarioId: saved.id }));
    const direct = await f.as(mine, () => equityModelRound(prisma, mine, terms));
    expect(model.pricePerShare).toBe(direct.pricePerShare);
    expect(model.postMoneyFullyDilutedShares).toBe(direct.postMoneyFullyDilutedShares);
    expect(model.rows.map((row) => row.id)).toEqual(direct.rows.map((row) => row.id));
  });

  it("keeps a scenario to its owner", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const saved = await f.as(mine, () =>
      createEquityRoundScenario(prisma, mine, { ...terms, name: "Private plan" }),
    );
    for (const scope of [sameSpace, otherSpace])
      await expect(
        f.as(scope, () => equityModelRound(prisma, scope, { scenarioId: saved.id })),
      ).rejects.toThrow(/not found/);
  });

  it("refuses an empty ledger and an unknown convertible", async () => {
    const { prisma, otherSpace, mine } = f;
    await expect(
      f.as(otherSpace, () => equityModelRound(prisma, otherSpace, terms)),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        equityModelRound(prisma, mine, { ...terms, convertibleIds: ["not-in-ledger"] }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });
});
