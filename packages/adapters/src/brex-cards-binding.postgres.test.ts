import { BrexApiEmulator } from "@rakazo/brex-mcp";
import { createDb, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectBrexCardsSession, createBrexCardsStore } from "./brex-cards-binding.js";
import { McpSession } from "./mcp-transport.js";

// Needs DATABASE_URL as the runtime login (row-level security enforced) and DATABASE_MIGRATION_URL
// as the owner, as `pnpm test:integration` provides after `pnpm db:migrate`.
const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && migrationUrl && runtimeUrl !== migrationUrl
    ? describe.sequential
    : describe.skip;

const HOUR_MS = 3_600_000;
const TOKEN = "bxt_postgres_token_1234567890";
const CREATE = {
  cardName: "Notion",
  ownerUserId: "u_ada",
  ownerName: "Ada Example",
  amountCents: 25_000,
  duration: "MONTHLY",
};

describePostgres("Brex cards binding (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `brex-bind-org-${suffix}`;
  // Spaces a and b share one Brex account; space c has its own.
  const tenants = [
    { name: "a", account: "shared" },
    { name: "b", account: "shared" },
    { name: "c", account: "other" },
  ].map(({ name, account }) => ({
    userId: `brex-bind-user-${name}-${suffix}`,
    spaceId: `brex-bind-space-${name}-${suffix}`,
    serverId: `brex-bind-server-${name}-${suffix}`,
    brexAccountId: `brex-bind-account-${account}-${suffix}`,
  }));
  const [a, b, c] = tenants as [(typeof tenants)[0], (typeof tenants)[0], (typeof tenants)[0]];
  let owner: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  let secondProcess: ReturnType<typeof createDb>;
  let emulator: BrexApiEmulator;
  let baseUrl: string;
  const sessions: McpSession[] = [];

  const tenant = (t: (typeof tenants)[0]) => ({ spaceId: t.spaceId, userId: t.userId });
  const storeFor = (
    t: (typeof tenants)[0],
    options: { now?: () => Date; prisma?: typeof app.prisma; lockTimeoutMs?: number } = {},
  ) =>
    createBrexCardsStore({
      server: { id: t.serverId, spaceId: t.spaceId, userId: t.userId },
      prisma: options.prisma ?? app.prisma,
      lockDatabaseUrl: runtimeUrl!,
      ...(options.now ? { now: options.now } : {}),
      ...(options.lockTimeoutMs ? { lockTimeoutMs: options.lockTimeoutMs } : {}),
    });
  const setCap = (t: (typeof tenants)[0], maxCardsPerDay: number) =>
    owner.prisma.brexCardsConnection.update({
      where: { serverId: t.serverId },
      data: { maxCardsPerDay },
    });
  const reservations = (t: (typeof tenants)[0]) =>
    owner.prisma.brexCardReservation.findMany({
      where: { spaceId: t.spaceId },
      orderBy: { reservedAt: "asc" },
    });

  beforeAll(async () => {
    owner = createDb(migrationUrl!);
    app = createDb(runtimeUrl!, { poolMax: 8 });
    secondProcess = createDb(runtimeUrl!, { poolMax: 4 });
    emulator = new BrexApiEmulator({ token: TOKEN });
    baseUrl = await emulator.start();
    const o = owner.prisma;
    await o.organization.create({
      data: { id: organizationId, name: "Brex", slug: organizationId, createdAt: new Date() },
    });
    for (const t of tenants) {
      await o.user.create({
        data: {
          id: t.userId,
          name: t.userId,
          email: `${t.userId}@rakazo.test`,
          emailVerified: true,
        },
      });
      await o.space.create({ data: { id: t.spaceId, organizationId, name: t.spaceId } });
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
    }
  });

  afterAll(async () => {
    await Promise.all(sessions.map((session) => session.close()));
    await emulator?.stop();
    if (!owner) return;
    await owner.prisma.organization.deleteMany({ where: { id: organizationId } });
    await owner.prisma.user.deleteMany({ where: { id: { in: tenants.map((t) => t.userId) } } });
    for (const handle of [owner, app, secondProcess]) {
      await handle.prisma.$disconnect();
      await handle.pool.end();
    }
  });

  async function openSession(t: (typeof tenants)[0]) {
    const session = new McpSession({ name: `brex-${t.spaceId}` });
    await runAsTenant(tenant(t), () =>
      connectBrexCardsSession(session, {
        server: { id: t.serverId, spaceId: t.spaceId, userId: t.userId },
        token: TOKEN,
        prisma: app.prisma,
        baseUrl,
      }),
    );
    sessions.push(session);
    return session;
  }

  it("lets two spaces on one Brex account race at the cap and creates one card", async () => {
    await setCap(a, 1);
    await setCap(b, 1);
    const [sessionA, sessionB] = [await openSession(a), await openSession(b)];
    const before = emulator.cards.length;

    const attempts = await Promise.all(
      [
        [a, sessionA, "race-a1"],
        [b, sessionB, "race-b1"],
        [a, sessionA, "race-a2"],
        [b, sessionB, "race-b2"],
      ].map(([t, session, key]) =>
        runAsTenant(tenant(t as (typeof tenants)[0]), () =>
          (session as McpSession).callTool(
            "create_vendor_card",
            { ...CREATE, cardName: `Race ${key}` },
            { meta: { idempotencyKey: key as string } },
          ),
        ),
      ),
    );

    expect(attempts.filter((result) => result.isError !== true)).toHaveLength(1);
    expect(emulator.cards.length).toBe(before + 1);
    const rows = [...(await reservations(a)), ...(await reservations(b))];
    expect(rows.map((row) => row.status).sort()).toEqual(["created"]);
    expect(rows[0]?.brexCardId).toBeTruthy();
  });

  it("counts another space's reservation through the shared account, though row security hides it", async () => {
    await owner.prisma.brexCardReservation.deleteMany({
      where: { spaceId: { in: [a.spaceId, b.spaceId] } },
    });
    expect((await storeFor(a).reserveCard({ maxCardsPerDay: 1 })).ok).toBe(true);

    // The runtime role sees only its own Space's rows, so the cap has to count with an explicit
    // system context; otherwise two spaces on one account would each see an empty table.
    const visibleToB = await runAsTenant(tenant(b), () =>
      app.prisma.brexCardReservation.count({ where: { brexAccountId: a.brexAccountId } }),
    );
    expect(visibleToB).toBe(0);
    expect((await storeFor(b).reserveCard({ maxCardsPerDay: 1 })).ok).toBe(false);
  });

  it("does not count another Brex account's cards", async () => {
    const reserved = await storeFor(c).reserveCard({ maxCardsPerDay: 1 });
    expect(reserved.ok).toBe(true);
  });

  describe("reservation states", () => {
    const store = () => storeFor(c);
    const settleAll = async (status: "failed" | "uncertain" | "created") => {
      await owner.prisma.brexCardReservation.updateMany({
        where: { spaceId: c.spaceId },
        data: { status },
      });
    };

    it("keeps counting an uncertain outcome and a reserved row the call never settled", async () => {
      await settleAll("uncertain");
      expect((await store().reserveCard({ maxCardsPerDay: 2 })).ok).toBe(true);
      // The second row stays `reserved`, as after a crash. Both still count.
      expect((await store().reserveCard({ maxCardsPerDay: 2 })).ok).toBe(false);
      expect((await reservations(c)).map((row) => row.status)).toEqual(["uncertain", "reserved"]);
    });

    it("frees capacity when a call settles as failed, and records a card id when it settles as created", async () => {
      await settleAll("failed");
      const first = await store().reserveCard({ maxCardsPerDay: 1 });
      if (!first.ok) throw new Error("expected a reservation");
      await store().settleReservation(first.reservationId, "failed");
      const second = await store().reserveCard({ maxCardsPerDay: 1 });
      if (!second.ok) throw new Error("expected a reservation after a failed row");
      await store().settleReservation(second.reservationId, "created", "card_new");
      const row = await owner.prisma.brexCardReservation.findUniqueOrThrow({
        where: { id: second.reservationId },
      });
      expect(row).toMatchObject({ status: "created", brexCardId: "card_new", spaceId: c.spaceId });
      expect((await store().reserveCard({ maxCardsPerDay: 1 })).ok).toBe(false);
    });

    it("counts a delayed approval on the day it is dispatched, within a rolling 24 hours", async () => {
      await owner.prisma.brexCardReservation.deleteMany({ where: { spaceId: c.spaceId } });
      const dispatch = new Date("2030-03-10T12:00:00Z");
      // Approved long before; the reservation is made, and dated, when the call runs.
      const reserved = await storeFor(c, { now: () => dispatch }).reserveCard({
        maxCardsPerDay: 1,
      });
      if (!reserved.ok) throw new Error("expected a reservation");
      const [row] = await reservations(c);
      expect(row?.reservedAt.toISOString()).toBe(dispatch.toISOString());

      const at = (hours: number) =>
        storeFor(c, { now: () => new Date(+dispatch + hours * HOUR_MS) });
      expect((await at(23).reserveCard({ maxCardsPerDay: 1 })).ok).toBe(false);
      expect((await at(25).reserveCard({ maxCardsPerDay: 1 })).ok).toBe(true);
    });
  });

  it("settles only its own space's reservation", async () => {
    const mine = await storeFor(c).reserveCard({ maxCardsPerDay: 100 });
    if (!mine.ok) throw new Error("expected a reservation");
    // Another space, even one that guesses the id, cannot change the row.
    await storeFor(a).settleReservation(mine.reservationId, "failed");
    const row = await owner.prisma.brexCardReservation.findUniqueOrThrow({
      where: { id: mine.reservationId },
    });
    expect(row.status).toBe("reserved");
  });

  describe("withTargetLock", () => {
    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { opened, open };
    };

    it("serializes two callers on one target across two Prisma clients", async () => {
      const events: string[] = [];
      const firstHolds = gate();
      const firstStarted = gate();
      const first = storeFor(a).withTargetLock("card:card_1", async () => {
        events.push("first:start");
        firstStarted.open();
        await firstHolds.opened;
        events.push("first:end");
      });
      await firstStarted.opened;
      const second = storeFor(a, { prisma: secondProcess.prisma }).withTargetLock(
        "card:card_1",
        async () => {
          events.push("second:start");
        },
      );
      // The second client is blocked in Postgres, not in this process.
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(["first:start"]);
      firstHolds.open();
      await Promise.all([first, second]);
      expect(events).toEqual(["first:start", "first:end", "second:start"]);
    });

    it("holds the lock across a long call without holding a database transaction open", async () => {
      const holds = gate();
      const started = gate();
      const held = storeFor(a).withTargetLock("card:card_long", async () => {
        started.open();
        await holds.opened;
      });
      await started.opened;
      // A held lock on an open transaction ends with that transaction's timeout, whatever the
      // call is still doing. The lock has to belong to a plain session instead.
      const [counts] = await owner.prisma.$queryRaw<
        Array<{ granted: bigint; inTransaction: bigint }>
      >`SELECT count(*) FILTER (WHERE l.granted) AS granted,
               count(*) FILTER (WHERE l.granted AND a.state LIKE 'idle in transaction%') AS "inTransaction"
        FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory' AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())`;
      expect(Number(counts?.granted)).toBe(1);
      expect(Number(counts?.inTransaction)).toBe(0);
      holds.open();
      await held;
    });

    it("lets locked calls use the Prisma pool even when it has one connection", async () => {
      const tiny = createDb(runtimeUrl!, { poolMax: 1 });
      try {
        const store = storeFor(a, { prisma: tiny.prisma });
        const both = await Promise.all(
          ["card:card_pool_1", "card:card_pool_2"].map((key) =>
            store.withTargetLock(key, async () => (await store.loadControls()).maxCardsPerDay),
          ),
        );
        expect(both).toHaveLength(2);
      } finally {
        await tiny.prisma.$disconnect();
        await tiny.pool.end();
      }
    }, 20_000);

    it("refuses with a clear message when the lock is not free in time, without running the call", async () => {
      const holds = gate();
      const started = gate();
      const held = storeFor(a).withTargetLock("card:card_busy", async () => {
        started.open();
        await holds.opened;
      });
      await started.opened;
      let ran = false;
      const outcome = await Promise.race([
        storeFor(a, { prisma: secondProcess.prisma, lockTimeoutMs: 300 })
          .withTargetLock("card:card_busy", async () => {
            ran = true;
          })
          .then(
            () => "ran",
            (error: Error) => error.message,
          ),
        new Promise<string>((resolve) => setTimeout(() => resolve("still waiting"), 3_000)),
      ]);
      holds.open();
      await held;
      expect(outcome).toMatch(/another change .* in progress/i);
      expect(ran).toBe(false);
    });

    it("does not make a different target wait", async () => {
      const holds = gate();
      const started = gate();
      const held = storeFor(a).withTargetLock("card:card_1", async () => {
        started.open();
        await holds.opened;
      });
      await started.opened;
      const other = await storeFor(a, { prisma: secondProcess.prisma }).withTargetLock(
        "spend_limit:limit_1",
        async () => "ran",
      );
      expect(other).toBe("ran");
      holds.open();
      await held;
    });

    it("releases the lock when the callback throws, and rethrows", async () => {
      await expect(
        storeFor(a).withTargetLock("card:card_2", async () => {
          throw new Error("brex call failed");
        }),
      ).rejects.toThrow("brex call failed");
      await expect(
        storeFor(a, { prisma: secondProcess.prisma }).withTargetLock(
          "card:card_2",
          async () => "ok",
        ),
      ).resolves.toBe("ok");
    });
  });

  describe("controls", () => {
    it("reads the owner's current controls on each call", async () => {
      const store = storeFor(a);
      expect((await store.loadControls()).maxCardsPerDay).toBe(1);
      await setCap(a, 4);
      expect((await store.loadControls()).maxCardsPerDay).toBe(4);
    });

    it("refuses to load another space's connection row", async () => {
      // Server b's id with space a's identity: the row exists, but it belongs to another space.
      const crossed = createBrexCardsStore({
        server: { id: b.serverId, spaceId: a.spaceId, userId: a.userId },
        prisma: app.prisma,
      });
      await expect(crossed.loadControls()).rejects.toThrow();
    });
  });
});
