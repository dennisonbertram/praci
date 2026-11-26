import type { PrismaClient } from "@rakazo/db";
import {
  createDb,
  getCapTableSnapshot,
  importEquitySnapshot,
  runAsTenant,
  saveCapTableSnapshot,
} from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contactToolFromTool } from "./contact-tools.js";

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? appUrl;
const describePostgres =
  process.env.VERIFY_DATABASE && appUrl ? describe.sequential : describe.skip;

const legacy = {
  companyName: "Legacy Co",
  asOf: "2026-01-31",
  fullyDilutedShares: 1000,
  shareClasses: [{ name: "Common", shares: 1000, percent: 100 }],
  holders: [{ name: "Legacy Holder", security: "Common", shares: 1000 }],
};

describePostgres("cap table tools with and without a ledger (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const org = `ct-org-${suffix}`;
  const withLedger = { spaceId: `ct-space-a-${suffix}`, userId: `ct-user-a-${suffix}` };
  const without = { spaceId: `ct-space-b-${suffix}`, userId: `ct-user-b-${suffix}` };
  const app = createDb(appUrl as string);
  const ownerDb = ownerUrl === appUrl ? app : createDb(ownerUrl as string);
  const prisma: PrismaClient = app.prisma;

  beforeAll(async () => {
    const owner = ownerDb.prisma;
    await owner.user.createMany({
      data: [withLedger, without].map(({ userId: id }) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await owner.organization.create({
      data: { id: org, name: "Tool Org", slug: org, createdAt: new Date() },
    });
    await owner.space.createMany({
      data: [withLedger, without].map(({ spaceId: id }) => ({ id, organizationId: org, name: id })),
    });
    for (const scope of [withLedger, without])
      await runAsTenant(scope, () => saveCapTableSnapshot(prisma, scope, legacy));
    const stored = (await runAsTenant(withLedger, () => getCapTableSnapshot(prisma, withLedger)))!;
    await runAsTenant(withLedger, () =>
      importEquitySnapshot(prisma, withLedger, {
        ...stored,
        holders: [{ ...stored.holders[0]!, name: "Ledger Holder" }],
      }),
    );
  });
  afterAll(async () => {
    const owner = ownerDb.prisma;
    await owner.equityLedger.deleteMany({ where: { spaceId: withLedger.spaceId } });
    await owner.organization.deleteMany({ where: { id: org } });
    await owner.user.deleteMany({
      where: { id: { in: [withLedger.userId, without.userId] } },
    });
    await app.prisma.$disconnect();
    await app.pool.end();
    if (ownerDb !== app) {
      await ownerDb.prisma.$disconnect();
      await ownerDb.pool.end();
    }
  });

  const call = (scope: typeof withLedger, name: string, args: Record<string, unknown> = {}) =>
    runAsTenant(scope, () => contactToolFromTool(name, { prisma, scope }, args));
  const update = {
    companyName: "Changed Co",
    asOf: "2026-02-01",
    fullyDilutedShares: 5,
    shareClasses: [],
    holders: [],
  };

  it("reads the ledger and refuses to write the legacy snapshot once a ledger exists", async () => {
    const read = (await call(withLedger, "cap_table_read")) as {
      capTable: { holders: { name: string }[] };
    };
    expect(read.capTable.holders.map((holder) => holder.name)).toEqual(["Ledger Holder"]);
    expect(await call(withLedger, "cap_table_update", update)).toEqual({
      error: expect.stringContaining("equity ledger"),
    });
    const stored = await runAsTenant(withLedger, () => getCapTableSnapshot(prisma, withLedger));
    expect(stored?.companyName).toBe("Legacy Co");
  });

  it("returns a capped page of holders with a total and a cursor", async () => {
    const owner = ownerDb.prisma;
    const big = { spaceId: `ct-space-c-${suffix}`, userId: withLedger.userId };
    await owner.space.create({ data: { id: big.spaceId, organizationId: org, name: big.spaceId } });
    const holders = Array.from({ length: 250 }, (_, i) => ({
      name: `Bulk ${String(i).padStart(3, "0")}`,
      security: "Common",
      shares: 1000 - i,
    }));
    await runAsTenant(big, () =>
      saveCapTableSnapshot(prisma, big, {
        ...legacy,
        fullyDilutedShares: 250_000,
        holders: holders.slice(0, 1),
      }),
    );
    const stored = (await runAsTenant(big, () => getCapTableSnapshot(prisma, big)))!;
    await runAsTenant(big, () =>
      importEquitySnapshot(prisma, big, {
        ...stored,
        fullyDilutedShares: 250_000,
        holders: holders.map((h) => ({
          ...h,
          email: null,
          organization: null,
          amountUsd: null,
          percent: null,
        })),
      }),
    );
    type Read = { capTable: { holders: unknown[]; holdersTotal: number; nextAfter: number | null } };
    const first = (await call(big, "cap_table_read")) as Read;
    expect(first.capTable.holders).toHaveLength(100);
    expect(first.capTable).toMatchObject({ holdersTotal: 250, nextAfter: 100 });
    const last = (await call(big, "cap_table_read", { after: 200 })) as Read;
    expect(last.capTable.holders).toHaveLength(50);
    expect(last.capTable.nextAfter).toBeNull();
    await owner.equityLedger.deleteMany({ where: { spaceId: big.spaceId } });
    await owner.space.delete({ where: { id: big.spaceId } });
  });

  it("keeps the legacy behavior when the space has no ledger", async () => {
    const read = (await call(without, "cap_table_read")) as {
      capTable: { holders: { name: string }[] };
    };
    expect(read.capTable.holders.map((holder) => holder.name)).toEqual(["Legacy Holder"]);
    expect(await call(without, "cap_table_update", update)).toEqual({ ok: true });
    const stored = await runAsTenant(without, () => getCapTableSnapshot(prisma, without));
    expect(stored?.companyName).toBe("Changed Co");
  });
});
