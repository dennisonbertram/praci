import { describe } from "vitest";
import type { PrismaClient } from "../client.js";
import { createDb } from "../client.js";
import { runAsTenant } from "../row-security.js";
import type { EquityScope } from "./ledger.js";

/**
 * Postgres fixture for the equity store tests. Fixtures are written with the owner connection
 * (DATABASE_MIGRATION_URL, or DATABASE_URL when there is only one); stores run on DATABASE_URL
 * inside `as(scope, ...)`, so with the runtime login row-level security is enforced too.
 *
 *   VERIFY_DATABASE=1 DATABASE_URL=<runtime url> DATABASE_MIGRATION_URL=<owner url> pnpm vitest run packages/db/src/equity
 */
const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? appUrl;

export const describeEquityPostgres: typeof describe.skip =
  process.env.VERIFY_DATABASE && appUrl ? describe.sequential : describe.skip;

export type EquityFixture = {
  /** The app connection: call stores with it inside `as`. */
  prisma: PrismaClient;
  /** The owner connection, for setup and for checks that must see every tenant. */
  owner: PrismaClient;
  /** The main tenant, another user in the same space, and the same user in another space. */
  mine: EquityScope;
  sameSpace: EquityScope;
  otherSpace: EquityScope;
  as: <T>(scope: EquityScope, fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export function barrierAtEquityLedgerLock(prisma: PrismaClient, participants = 2): PrismaClient {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const wrap = (tx: object) =>
    new Proxy(tx, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "$queryRawUnsafe" || typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          const query = String(args[0] ?? "");
          if (
            arrived < participants &&
            query.includes('FROM "equity_ledgers"') &&
            query.includes("FOR UPDATE")
          ) {
            arrived += 1;
            if (arrived === participants) release();
            await gate;
          }
          return Reflect.apply(value, target, args);
        };
      },
    });
  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrap(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
}

/**
 * Runs `hook` once per transaction, just before the first read of `model` in it. A transaction
 * that already holds a lock another one needs never gets a second one to this point, so hooks
 * that wait for each other must also stop waiting once one is blocked (see barrierAtFirstRead).
 */
export function hookFirstRead(
  prisma: PrismaClient,
  model: string,
  hook: () => Promise<void>,
): PrismaClient {
  const wrap = (tx: object) => {
    let hooked = false;
    return new Proxy(tx, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== model || !value || typeof value !== "object") return value;
        return new Proxy(value, {
          get(delegate, method, delegateReceiver) {
            const operation = Reflect.get(delegate, method, delegateReceiver);
            if (
              !["findFirst", "findMany"].includes(String(method)) ||
              typeof operation !== "function"
            )
              return operation;
            return async (...args: unknown[]) => {
              if (!hooked) {
                hooked = true;
                await hook();
              }
              return Reflect.apply(operation, delegate, args);
            };
          },
        });
      },
    });
  };
  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrap(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
}

/** Resolves once some backend waits for a lock, or after `timeoutMs` so a test cannot hang. */
export async function waitForLockWaiter(owner: PrismaClient, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await owner.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (row && row.n > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Both transactions stop before their first read of `model` until each has arrived, so without a
 * lock both read the same stale state. With a lock the second one never arrives (it is waiting
 * for the first), so the first goes on as soon as `owner` sees a backend waiting for a lock.
 * Nothing here depends on how fast the runner is.
 */
export function barrierAtFirstRead(prisma: PrismaClient, owner: PrismaClient, model: string) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return hookFirstRead(prisma, model, async () => {
    arrived += 1;
    if (arrived === 2) release();
    await Promise.race([gate, waitForLockWaiter(owner)]);
  });
}

export function pauseAfterPlanRead(prisma: PrismaClient): {
  prisma: PrismaClient;
  readComplete: Promise<void>;
  resume: () => void;
} {
  let signalRead!: () => void;
  let resume!: () => void;
  let paused = false;
  const readComplete = new Promise<void>((resolve) => (signalRead = resolve));
  const gate = new Promise<void>((resolve) => (resume = resolve));
  const wrap = (tx: object) =>
    new Proxy(tx, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "equityPlan" || !value || typeof value !== "object") return value;
        return new Proxy(value, {
          get(delegate, method, delegateReceiver) {
            const operation = Reflect.get(delegate, method, delegateReceiver);
            if (
              !["findFirst", "findMany"].includes(String(method)) ||
              typeof operation !== "function"
            )
              return operation;
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(operation, delegate, args);
              if (!paused) {
                paused = true;
                signalRead();
                await gate;
              }
              return result;
            };
          },
        });
      },
    });
  const isolated = new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrap(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
  return { prisma: isolated, readComplete, resume };
}

export async function equityFixture(name: string): Promise<EquityFixture> {
  const suffix = `${name}-${process.pid}-${Date.now()}`;
  const organizationId = `eq-org-${suffix}`;
  const mine = { spaceId: `eq-space-a-${suffix}`, userId: `eq-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `eq-user-b-${suffix}` };
  const otherSpace = { spaceId: `eq-space-b-${suffix}`, userId: mine.userId };
  const app = createDb(appUrl!);
  const ownerDb = ownerUrl === appUrl ? app : createDb(ownerUrl!);
  const owner = ownerDb.prisma;
  await owner.user.createMany({
    data: [mine.userId, sameSpace.userId].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
    })),
  });
  await owner.organization.create({
    data: { id: organizationId, name: "Equity Org", slug: organizationId, createdAt: new Date() },
  });
  await owner.space.createMany({
    data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
  });
  return {
    prisma: app.prisma,
    owner,
    mine,
    sameSpace,
    otherSpace,
    as: (scope, fn) => runAsTenant(scope, fn),
    close: async () => {
      await owner.equityLedger.deleteMany({
        where: { spaceId: { in: [mine.spaceId, otherSpace.spaceId] } },
      });
      await owner.organization.deleteMany({ where: { id: organizationId } });
      await owner.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
      await app.prisma.$disconnect();
      await app.pool.end();
      if (ownerDb !== app) {
        await owner.$disconnect();
        await ownerDb.pool.end();
      }
    },
  };
}
