import { afterAll, beforeAll, expect, it } from "vitest";
import { EquityConflictError } from "./ledger.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import {
  createEquityRoundScenario,
  getEquityRoundScenario,
  listEquityRoundScenarios,
  updateEquityRoundScenario,
} from "./views-scenarios.js";

const terms = {
  name: "Series A at 20M",
  preMoneyValuationCents: "2000000000",
  targetPoolPercent: "10",
  investments: [{ name: "Lead Fund", amountCents: "500000000" }],
};

describeEquityPostgres("equity round scenarios (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-scenarios");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("saves, lists, edits and refuses a duplicate name, without touching the ledger", async () => {
    const { prisma, mine, owner } = f;
    const created = await f.as(mine, () => createEquityRoundScenario(prisma, mine, terms));
    expect(created).toMatchObject({ ...terms, targetPoolPercent: "10", convertibleIds: null });
    await expect(
      f.as(mine, () => createEquityRoundScenario(prisma, mine, terms)),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const updated = await f.as(mine, () =>
      updateEquityRoundScenario(prisma, mine, {
        id: created.id,
        convertibleIds: [],
        name: "Series A at 25M",
      }),
    );
    expect(updated).toMatchObject({ name: "Series A at 25M", convertibleIds: [] });
    const back = await f.as(mine, () =>
      updateEquityRoundScenario(prisma, mine, { id: created.id, convertibleIds: null }),
    );
    expect(back.convertibleIds).toBeNull();
    const page = await f.as(mine, () => listEquityRoundScenarios(prisma, mine, { search: "25m" }));
    expect(page.items.map((row) => row.id)).toEqual([created.id]);
    expect(await owner.equityTransaction.count({ where: mine })).toBe(0);
  });

  it("keeps scenarios to their owner", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const [own] = (await f.as(mine, () => listEquityRoundScenarios(prisma, mine, {}))).items;
    for (const scope of [sameSpace, otherSpace]) {
      expect((await f.as(scope, () => listEquityRoundScenarios(prisma, scope, {}))).items).toEqual(
        [],
      );
      await expect(
        f.as(scope, () => getEquityRoundScenario(prisma, scope, own!.id)),
      ).rejects.toThrow(/not found/);
      await expect(
        f.as(scope, () => updateEquityRoundScenario(prisma, scope, { id: own!.id, name: "Taken" })),
      ).rejects.toThrow(/not found/);
    }
  });
});
