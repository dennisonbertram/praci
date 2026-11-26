import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.js";
import { drainUnscopedDatabaseAccess, runAsSystem, runAsTenant } from "./row-security.js";

// Needs DATABASE_URL as the runtime login and DATABASE_MIGRATION_URL as the
// owner, as `pnpm test:integration` provides after `pnpm db:migrate`.
const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && migrationUrl && runtimeUrl !== migrationUrl
    ? describe.sequential
    : describe.skip;

describePostgres("Brex cards row-level security (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `brex-org-${suffix}`;
  const tenants = ["a", "b"].map((name) => ({
    name,
    userId: `brex-user-${name}-${suffix}`,
    spaceId: `brex-space-${name}-${suffix}`,
    serverId: `brex-server-${name}-${suffix}`,
    brexAccountId: `brex-account-${name}-${suffix}`,
    reservationId: `brex-reservation-${name}-${suffix}`,
  }));
  const [a, b] = tenants as [(typeof tenants)[0], (typeof tenants)[0]];
  let owner: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const ids = tenants.flatMap((t) => [t.serverId, t.reservationId]);

  beforeAll(async () => {
    owner = createDb(migrationUrl!);
    app = createDb(runtimeUrl!, { poolMax: 4 });
    const o = owner.prisma;
    await o.organization.create({
      data: { id: organizationId, name: "Brex", slug: organizationId, createdAt: new Date() },
    });
    for (const t of tenants) {
      await o.user.create({
        data: { id: t.userId, name: t.name, email: `${t.userId}@rakazo.test`, emailVerified: true },
      });
      await o.space.create({ data: { id: t.spaceId, organizationId, name: t.name } });
      await o.mcpServer.create({
        data: {
          id: t.serverId,
          spaceId: t.spaceId,
          userId: t.userId,
          slug: "brex-cards",
          name: "Brex cards",
          transport: "streamable_http",
          endpoint: "rakazo+brex://cards",
        },
      });
      await o.brexCardsConnection.create({
        data: {
          serverId: t.serverId,
          spaceId: t.spaceId,
          createdByUserId: t.userId,
          brexAccountId: t.brexAccountId,
        },
      });
      await o.brexCardReservation.create({
        data: {
          id: t.reservationId,
          spaceId: t.spaceId,
          brexAccountId: t.brexAccountId,
          status: "reserved",
        },
      });
    }
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.prisma.organization.deleteMany({ where: { id: organizationId } });
    await owner.prisma.user.deleteMany({ where: { id: { in: tenants.map((t) => t.userId) } } });
    for (const handle of [owner, app]) {
      await handle.prisma.$disconnect();
      await handle.pool.end();
    }
  });

  const db = () => app.prisma;
  const seen = async () => ({
    connections: (
      await db().brexCardsConnection.findMany({
        where: { serverId: { in: ids } },
        select: { spaceId: true },
      })
    ).map((row) => row.spaceId),
    reservations: (
      await db().brexCardReservation.findMany({
        where: { id: { in: ids } },
        select: { spaceId: true },
      })
    ).map((row) => row.spaceId),
  });

  it("creates the controls with the plan's defaults", async () => {
    const row = await owner.prisma.brexCardsConnection.findUniqueOrThrow({
      where: { serverId: a.serverId },
    });
    expect(row).toMatchObject({
      maxNewCardLimitCents: 100000,
      maxCardLimitCents: 500000,
      maxSpendLimitBaseCents: 1000000,
      maxCardsPerDay: 5,
      allowedDurations: ["MONTHLY", "ONE_TIME"],
      oneTimeMaxDays: 90,
    });
  });

  it("lets a tenant read only its own Space's rows", async () => {
    expect(await runAsTenant(a, seen)).toEqual({
      connections: [a.spaceId],
      reservations: [a.spaceId],
    });
    expect(await runAsTenant(b, seen)).toEqual({
      connections: [b.spaceId],
      reservations: [b.spaceId],
    });
    expect(
      await runAsTenant(b, () =>
        db().brexCardReservation.findUnique({ where: { id: a.reservationId } }),
      ),
    ).toBeNull();
  });

  it("blocks another Space from writing, updating or deleting the rows", async () => {
    await expect(
      runAsTenant(b, () =>
        db().brexCardReservation.create({
          data: { spaceId: a.spaceId, brexAccountId: a.brexAccountId, status: "reserved" },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      runAsTenant(b, () =>
        db().brexCardsConnection.create({
          data: {
            serverId: a.serverId,
            spaceId: a.spaceId,
            createdByUserId: b.userId,
            brexAccountId: "x",
          },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await runAsTenant(b, () =>
        db().brexCardReservation.updateMany({
          where: { id: a.reservationId },
          data: { status: "failed" },
        }),
      ),
    ).toEqual({ count: 0 });
    expect(
      await runAsTenant(b, () =>
        db().brexCardsConnection.updateMany({
          where: { serverId: a.serverId },
          data: { maxCardsPerDay: 99 },
        }),
      ),
    ).toEqual({ count: 0 });
    expect(
      await runAsTenant(b, () =>
        db().brexCardReservation.deleteMany({ where: { id: a.reservationId } }),
      ),
    ).toEqual({ count: 0 });
    // Nothing of A's changed.
    const own = await owner.prisma.brexCardReservation.findUniqueOrThrow({
      where: { id: a.reservationId },
    });
    expect(own.status).toBe("reserved");
  });

  it("lets a tenant write and settle a reservation in its own Space", async () => {
    const result = await runAsTenant(a, async () => {
      const created = await db().brexCardReservation.create({
        data: { spaceId: a.spaceId, brexAccountId: a.brexAccountId, status: "reserved" },
      });
      const settled = await db().brexCardReservation.updateMany({
        where: { id: created.id },
        data: { status: "created", brexCardId: "card_1" },
      });
      return { id: created.id, settled };
    });
    expect(result.settled).toEqual({ count: 1 });
    expect(
      await owner.prisma.brexCardReservation.findUniqueOrThrow({ where: { id: result.id } }),
    ).toMatchObject({ status: "created", brexCardId: "card_1" });
  });

  it("returns no rows and rejects writes without a tenant context", async () => {
    expect(await seen()).toEqual({ connections: [], reservations: [] });
    await expect(
      db().brexCardReservation.create({
        data: { spaceId: a.spaceId, brexAccountId: a.brexAccountId, status: "reserved" },
      }),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db().brexCardsConnection.create({
        data: {
          serverId: a.serverId,
          spaceId: a.spaceId,
          createdByUserId: a.userId,
          brexAccountId: "x",
        },
      }),
    ).rejects.toThrow(/row-level security/);
    // Each unscoped call site is reported, which fails the run unless drained here.
    expect(drainUnscopedDatabaseAccess()).toContainEqual(
      expect.stringMatching(/^BrexCardReservation\.create\n/),
    );
  });

  it("lets the system role read both Spaces", async () => {
    const all = await runAsSystem("brex cards row-level security test", seen);
    expect(all.connections.sort()).toEqual(tenants.map((t) => t.spaceId).sort());
    expect(all.reservations.sort()).toEqual(tenants.map((t) => t.spaceId).sort());
  });

  it("registers a tenant and a system policy on each table", async () => {
    const policies = await owner.prisma.$queryRaw<
      Array<{ tablename: string; policyname: string; qual: string }>
    >`SELECT tablename, policyname, qual FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('brex_cards_connections', 'brex_card_reservations')`;
    for (const table of ["brex_cards_connections", "brex_card_reservations"]) {
      const own = policies.filter((policy) => policy.tablename === table);
      expect(own.find((p) => p.policyname === `${table}_tenant`)?.qual).toContain("app.space_id");
      expect(own.find((p) => p.policyname === `${table}_system`)?.qual).toContain("app.rls_bypass");
      expect(own).toHaveLength(2);
    }
  });
});
