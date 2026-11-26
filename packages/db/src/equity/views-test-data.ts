import { getCapTableSnapshot, saveCapTableSnapshot } from "../cap-table.js";
import { importEquitySnapshot } from "./import.js";
import type { EquityScope } from "./ledger.js";
import { createEquityOptionGrant } from "./options.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";

/** An invented snapshot the views Postgres tests copy into the ledger. */
export const snapshot = {
  companyName: "Example Robotics",
  asOf: "2026-01-31",
  fullyDilutedShares: 12_000_000,
  optionPoolAvailable: 1_500_000,
  latest409a: null,
  shareClasses: [
    { name: "Common", shares: 8_000_000, percent: 66.67 },
    { name: "Series Seed Preferred", shares: 2_500_000, percent: 20.83 },
  ],
  holders: [
    { name: "Ada Founder", email: "ada@example.test", security: "Common", shares: 5_000_000 },
    { name: "Ben Founder", email: "ben@example.test", security: "Common", shares: 3_000_000 },
    {
      name: "Example Ventures",
      organization: "Example Ventures",
      security: "Series Seed Preferred",
      shares: 2_500_000,
      amountUsd: 2_000_000,
    },
    { name: "Dee Angel", security: "SAFE", amountUsd: 250_000 },
  ],
};

export async function createTestNsoGrant(
  f: EquityFixture,
  actor: EquityScope,
  input: { holderName: string; quantity: number; exercisePrice: string; grantDate: string },
) {
  const plan = await f.as(actor, () =>
    f.prisma.equityPlan.findFirstOrThrow({
      where: { ...actor, name: "Imported plan" },
      select: { id: true, shareClassId: true },
    }),
  );
  const stakeholder = await f.as(actor, () =>
    createEquityStakeholder(f.prisma, actor, {
      type: "individual",
      name: input.holderName,
    }),
  );
  return f.as(actor, () =>
    createEquityOptionGrant(f.prisma, actor, {
      stakeholderId: stakeholder.id,
      planId: plan.id,
      shareClassId: plan.shareClassId,
      optionType: "nso",
      quantity: input.quantity.toString(),
      exercisePrice: input.exercisePrice,
      grantDate: input.grantDate,
    }),
  );
}

export async function seedViewsTestLedger(f: EquityFixture, actor: EquityScope) {
  await f.as(actor, () => saveCapTableSnapshot(f.prisma, actor, snapshot));
  const stored = (await f.as(actor, () => getCapTableSnapshot(f.prisma, actor)))!;
  const imported = await f.as(actor, () => importEquitySnapshot(f.prisma, actor, stored));
  const grant = await createTestNsoGrant(f, actor, {
    holderName: "Cy Engineer",
    quantity: 1_000_000,
    exercisePrice: "0.42",
    grantDate: snapshot.asOf,
  });
  return { imported, grant };
}
