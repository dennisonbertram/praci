import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createNotificationEvents } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

/** Topic-keyed in-process fanout: a subscriber hears only the topic it asked for. */
function fakeFanout() {
  const subs = new Map<string, Set<(payload: string) => void>>();
  return {
    describe: () => ({ id: "fake", contractVersion: "1", adapterVersion: "0", capabilities: {} }),
    publish: async (topic: string, payload: string) => {
      for (const fn of subs.get(topic) ?? []) fn(payload);
    },
    subscribe: async (topic: string, fn: (payload: string) => void) => {
      const set = subs.get(topic) ?? new Set();
      set.add(fn);
      subs.set(topic, set);
      return async () => {
        set.delete(fn);
      };
    },
    close: async () => {},
  };
}

describePostgres("notifications RPC (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `rpc-org-${suffix}`;
  const spaceA = `rpc-space-a-${suffix}`;
  const spaceB = `rpc-space-b-${suffix}`;
  const alice: Actor = {
    spaceId: spaceA,
    userId: `rpc-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `rpc-bob-${suffix}`, email: "b@example.test" };
  const aliceElsewhere: Actor = { ...alice, spaceId: spaceB };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const fanout = fakeFanout();
  const events = createNotificationEvents(fanout);
  const clientFor = (actor: Actor) =>
    createRouterClient(
      createRouter({ prisma, notificationEvents: events } as unknown as RouterDeps),
      { context: { actor } },
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "RPC Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
    await prisma.notification.createMany({
      data: [
        { ...alice, surface: "legal", title: "alice legal", dedupeKey: "1" },
        { ...bob, surface: "legal", title: "bob legal", dedupeKey: "2" },
        { ...aliceElsewhere, surface: "legal", title: "alice other space", dedupeKey: "3" },
      ].map(({ spaceId, userId, surface, title, dedupeKey }) => ({
        spaceId,
        userId,
        surface,
        title,
        dedupeKey,
      })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("lists, counts, marks seen and shown only for the caller in the caller's space", async () => {
    const mine = await clientFor(alice).notifications.list({});
    expect(mine.notifications.map((n) => n.title)).toEqual(["alice legal"]);
    expect(mine.nextCursor).toBeNull();
    expect((await clientFor(alice).notifications.unseenCounts()).counts).toEqual({ legal: 1 });

    // Bob cannot mark Alice's notification shown, nor clear her dot.
    const id = mine.notifications[0]!.id;
    expect(await clientFor(bob).notifications.markShown({ id })).toEqual({ ok: false });
    expect(await clientFor(aliceElsewhere).notifications.markShown({ id })).toEqual({ ok: false });
    expect(await clientFor(bob).notifications.markSeen({ surface: "legal" })).toEqual({ count: 1 });
    expect((await clientFor(alice).notifications.unseenCounts()).counts).toEqual({ legal: 1 });

    expect(await clientFor(alice).notifications.markShown({ id })).toEqual({ ok: true });
    expect(await clientFor(alice).notifications.markSeen({ surface: "legal" })).toEqual({
      count: 1,
    });
    expect((await clientFor(alice).notifications.unseenCounts()).counts).toEqual({});
    // Her other space still has its own.
    expect((await clientFor(aliceElsewhere).notifications.unseenCounts()).counts).toEqual({
      legal: 1,
    });
  });

  it("rejects a malformed cursor", async () => {
    await expect(clientFor(alice).notifications.list({ cursor: "nonsense" })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
  });

  it("subscribe delivers only the caller's own signals", async () => {
    const abort = new AbortController();
    const stream = await clientFor(alice).notifications.subscribe(undefined, {
      signal: abort.signal,
    });
    const received = (async () => {
      for await (const signal of stream) return signal;
    })();
    // Let the subscription register before publishing.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await events.notify(
      { spaceId: spaceA, userId: bob.userId },
      { id: "bob-1", surface: "legal", importance: "attention" },
    );
    await events.notify(
      { spaceId: spaceB, userId: alice.userId },
      { id: "other-space", surface: "legal", importance: "attention" },
    );
    await events.notify(
      { spaceId: spaceA, userId: alice.userId },
      { id: "alice-1", surface: "legal", importance: "info" },
    );
    expect(await received).toEqual({ id: "alice-1", surface: "legal", importance: "info" });
    abort.abort();
  });
});
