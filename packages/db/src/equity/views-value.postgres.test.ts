import { EquityEstimatedValueSettingsSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { EquityInputError } from "./ledger.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { getEquityEstimatedValue, setEquityEstimatedValue } from "./views-value.js";

describeEquityPostgres("equity estimated value settings (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-value");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("starts hidden with no price, then saves and reads back", async () => {
    const { prisma, mine } = f;
    expect(await f.as(mine, () => getEquityEstimatedValue(prisma, mine))).toEqual({
      visibility: "hidden",
      pricePerShare: null,
      effectiveDate: null,
      updatedAt: null,
    });
    const saved = await f.as(mine, () =>
      setEquityEstimatedValue(prisma, mine, {
        visibility: "holders",
        pricePerShare: "1.25",
        effectiveDate: "2026-06-30",
      }),
    );
    expect(EquityEstimatedValueSettingsSchema.parse(saved)).toMatchObject({
      visibility: "holders",
      pricePerShare: "1.25",
      effectiveDate: "2026-06-30",
    });
    expect(await f.as(mine, () => getEquityEstimatedValue(prisma, mine))).toEqual(saved);
  });

  it("refuses a price without an effective date", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        setEquityEstimatedValue(prisma, mine, {
          visibility: "hidden",
          pricePerShare: "2",
          effectiveDate: null,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps each user's and space's settings apart", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      expect((await f.as(scope, () => getEquityEstimatedValue(prisma, scope))).pricePerShare).toBe(
        null,
      );
    }
    await f.as(otherSpace, () =>
      setEquityEstimatedValue(prisma, otherSpace, {
        visibility: "hidden",
        pricePerShare: "9",
        effectiveDate: "2026-01-01",
      }),
    );
    expect((await f.as(f.mine, () => getEquityEstimatedValue(prisma, f.mine))).pricePerShare).toBe(
      "1.25",
    );
  });
});
