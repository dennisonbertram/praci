import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { BrexCardsStore, ReservationStatus } from "@rakazo/brex-mcp";
import { createBrexCardsServer, createBrexClient } from "@rakazo/brex-mcp";
import type { BrexCardsControls } from "@rakazo/contracts";
import { BrexCardsControlsSchema } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { runAsSystem, runAsTenant } from "@rakazo/db";
import { Client } from "pg";
import type { McpSession } from "./mcp-transport.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 60_000;

export interface BrexCardsBindingOptions {
  /** The `McpServer` row this session belongs to; the session is never used for another space. */
  server: { id: string; spaceId: string; userId: string };
  prisma: PrismaClient;
  /** Replaces the clock, so a test can place a reservation on a chosen day. */
  now?: () => Date;
  /**
   * The Postgres connection string that target locks use, on their own connection outside the
   * Prisma pool. Defaults to DATABASE_URL, the runtime login the API and workers already use.
   */
  lockDatabaseUrl?: string;
  /** How long a write waits for another change to the same card or spend limit. */
  lockTimeoutMs?: number;
}

export interface BrexCardsSessionOptions extends BrexCardsBindingOptions {
  /** The row's decrypted token. */
  token: string;
  /** Where Brex is reached; the default is api.brex.com. The demo and tests point it at an emulator. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * The Brex cards server's durable state, on Postgres, scoped to one `McpServer` row. The owner's
 * controls are read inside each write that needs them, so a change between approval and dispatch
 * applies. Nothing is held in this process: the API and the workers share all of it.
 */
export function createBrexCardsStore({
  server,
  prisma,
  now = () => new Date(),
  lockDatabaseUrl,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
}: BrexCardsBindingOptions): BrexCardsStore {
  const tenant = { spaceId: server.spaceId, userId: server.userId };

  /** The space's connection row for this server. Row security already limits it to the space. */
  const loadConnection = async () => {
    const row = await runAsTenant(tenant, () =>
      prisma.brexCardsConnection.findFirst({ where: { serverId: server.id } }),
    );
    if (!row || row.spaceId !== server.spaceId)
      throw new Error("Brex cards are not set up for this space.");
    return row;
  };

  return {
    async loadControls(): Promise<BrexCardsControls> {
      const row = await loadConnection();
      return BrexCardsControlsSchema.parse({
        maxNewCardLimitCents: row.maxNewCardLimitCents,
        maxCardLimitCents: row.maxCardLimitCents,
        maxSpendLimitBaseCents: row.maxSpendLimitBaseCents,
        maxCardsPerDay: row.maxCardsPerDay,
        allowedDurations: row.allowedDurations,
        oneTimeMaxDays: row.oneTimeMaxDays,
      });
    },

    async reserveCard({ maxCardsPerDay }) {
      const { brexAccountId } = await loadConnection();
      // The cap belongs to the Brex account, and spaces that share one account must each see the
      // others' reservations. Row security shows a tenant only its own space, so the count and the
      // insert run as the system; the count is the only thing read, and the row written is this
      // space's own.
      return runAsSystem("count the daily card cap across spaces on one Brex account", () =>
        prisma.$transaction(async (tx) => {
          // Held only for the count and the insert: the next caller counts this row once we commit.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`brex-cards:${brexAccountId}`}, 0))`;
          const at = now();
          const used = await tx.brexCardReservation.count({
            where: {
              brexAccountId,
              status: { not: "failed" },
              reservedAt: { gt: new Date(at.getTime() - DAY_MS) },
            },
          });
          if (used >= maxCardsPerDay)
            return {
              ok: false as const,
              reason: `The daily card limit is reached: ${used} of ${maxCardsPerDay} cards in the last 24 hours. Nothing was created.`,
            };
          const reservation = await tx.brexCardReservation.create({
            data: { spaceId: server.spaceId, brexAccountId, status: "reserved", reservedAt: at },
            select: { id: true },
          });
          return { ok: true as const, reservationId: reservation.id };
        }),
      );
    },

    async settleReservation(id: string, status: ReservationStatus, cardId?: string) {
      await runAsTenant(tenant, () =>
        prisma.brexCardReservation.updateMany({
          where: { id, spaceId: server.spaceId },
          data: { status, ...(cardId ? { brexCardId: cardId } : {}) },
        }),
      );
    },

    /**
     * A session-level Postgres advisory lock on the Brex account and target, so it holds across
     * the API and every worker. It lives on its own short-lived connection, not on the Prisma
     * pool and not in a transaction: a transaction timeout would release it while the Brex call
     * still runs, and a held pool connection would starve the queries the call itself makes. The
     * lock has no expiry while this process lives; if the process dies, the connection drops and
     * Postgres releases it.
     */
    async withTargetLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const { brexAccountId } = await loadConnection();
      const connectionString = lockDatabaseUrl ?? process.env.DATABASE_URL;
      if (!connectionString) throw new Error("The database connection for locks is not set.");
      const lockKey = `brex-cards:${brexAccountId}:${key}`;
      const lock = new Client({ connectionString, application_name: "rakazo-brex-cards-lock" });
      // A dropped connection already released the lock; nothing here needs to crash the process.
      lock.on("error", () => undefined);
      await lock.connect();
      try {
        await lock.query("SELECT set_config('lock_timeout', $1, false)", [`${lockTimeoutMs}ms`]);
        try {
          await lock.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [lockKey]);
        } catch (error) {
          if ((error as { code?: string }).code === "55P03")
            throw new Error(
              "Another change to this card or spend limit is in progress. Try again in a moment. Nothing was changed.",
            );
          throw error;
        }
        try {
          return await fn();
        } finally {
          await lock
            .query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockKey])
            .catch(() => undefined);
        }
      } finally {
        await lock.end().catch(() => undefined);
      }
    },

    idempotencyKey(meta) {
      const key = meta?.idempotencyKey;
      return typeof key === "string" && key.length > 0 ? key : undefined;
    },
  };
}

/**
 * Runs the Brex cards MCP server in this process for one `McpServer` row and connects `session` to
 * it over an in-memory pair. `token` is the row's decrypted secret; it goes to Brex and nowhere else.
 */
export async function connectBrexCardsSession(
  session: McpSession,
  options: BrexCardsSessionOptions,
  connect: { signal?: AbortSignal } = {},
): Promise<void> {
  const { token, fetch: fetchImpl, baseUrl, ...binding } = options;
  const server = createBrexCardsServer({
    client: createBrexClient({
      token,
      ...(baseUrl ? { baseUrl } : {}),
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    }),
    store: createBrexCardsStore(binding),
    ...(binding.now ? { now: binding.now } : {}),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  try {
    await session.connectTransport(clientSide, connect);
  } catch (error) {
    await server.close().catch(() => undefined);
    throw error;
  }
}
