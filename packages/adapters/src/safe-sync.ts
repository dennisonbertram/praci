import { randomUUID } from "node:crypto";
import { financeProviderForEndpoint, SAFE_READ_TOOLS } from "@rakazo/contracts";
import type { MercurySafeInput, PrismaClient } from "@rakazo/db";
import { Prisma, writeMercurySafes } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { z } from "zod";
import { unwrapToolResult } from "./finance-call-tool.js";
import type { FinanceCallTool } from "./finance-sync.js";
import { failureReason } from "./finance-sync.js";
import type { McpConnector } from "./mcp-connector.js";

export interface SafeSyncDeps {
  prisma: PrismaClient;
  /** Builds the SAFE read-tool caller for the user's Mercury server. */
  callToolFor(server: { id: string }, signal: AbortSignal): Promise<FinanceCallTool>;
}

/**
 * Builds the caller SAFE sync uses over the user's stored MCP server. It is deliberately separate
 * from the finance caller: only the tools in SAFE_READ_TOOLS can be called, and Finance sync can
 * never reach a SAFE.
 */
export function createSafeCallToolFor(
  prisma: Pick<PrismaClient, "mcpServer">,
  mcp: Pick<McpConnector, "callServerTool">,
): SafeSyncDeps["callToolFor"] {
  return async (server, signal): Promise<FinanceCallTool> => {
    const row = await prisma.mcpServer.findUnique({ where: { id: server.id } });
    if (!row?.enabled) throw new Error("Mercury server is not available");
    const context = {
      operationId: `safes:${row.id}`,
      traceId: `safes:${row.id}`,
      spaceId: row.spaceId,
      userId: row.userId,
      signal,
    };
    const allowed: readonly string[] = SAFE_READ_TOOLS.mercury;
    return async (name, args) => {
      if (!allowed.includes(name)) throw new Error(`SAFE sync may not call ${name}`);
      return unwrapToolResult(await mcp.callServerTool(row, context, name, args));
    };
  };
}

const validDate = (date: Date) => !Number.isNaN(date.getTime());
const iso = z.iso
  .datetime({ offset: true, local: true })
  .transform((value) => new Date(value))
  .refine(validDate);
const day = z.iso
  .date()
  .transform((value) => new Date(value))
  .refine(validDate);
const cents = (dollars: number) => Math.round(dollars * 100);

/** Mercury's documented SAFE request (GET /safes); fields we do not use are left out. */
const SafeRequestSchema = z.object({
  id: z.string().min(1),
  documentUrl: z.string().nullish(),
  expiresAt: iso.nullish(),
  includesMostFavoredNationClause: z.boolean(),
  includesProRataRightsLetter: z.boolean(),
  investmentAmount: z.number().positive(),
  investmentDate: day.nullish(),
  valuationType: z.enum(["PreMoney", "PostMoney", "NoValuation"]),
  investor: z.object({
    signatoryName: z.string(),
    signatoryEmail: z.string(),
    legalEntityName: z.string(),
  }),
  canceledAt: iso.nullish(),
  discountRate: z.number().nullish(),
  governingState: z.string().nullish(),
  paidAt: iso.nullish(),
  signedByInvestorAt: iso.nullish(),
  signedByOwnerAt: iso.nullish(),
  valuationCap: z.number().nullish(),
});

const VALUATION = {
  PreMoney: "pre_money_cap",
  PostMoney: "post_money_cap",
  NoValuation: "no_valuation",
} as const;

/** One SAFE request as a row to cache, or null when it is not the documented shape. */
export function mapSafeRequest(raw: unknown): MercurySafeInput | null {
  const parsed = SafeRequestSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const email = r.investor.signatoryEmail.trim().toLowerCase();
  return {
    externalId: r.id,
    investorName: r.investor.legalEntityName.trim() || r.investor.signatoryName.trim(),
    investorEmail: email || null,
    amountCents: cents(r.investmentAmount),
    valuationType: VALUATION[r.valuationType],
    capCents: r.valuationCap == null ? null : cents(r.valuationCap),
    discountPercent: r.discountRate ?? null,
    mfn: r.includesMostFavoredNationClause,
    proRata: r.includesProRataRightsLetter,
    governingState: r.governingState ?? null,
    investmentDate: r.investmentDate ?? null,
    expiresAt: r.expiresAt ?? null,
    canceledAt: r.canceledAt ?? null,
    signedByOwnerAt: r.signedByOwnerAt ?? null,
    signedByInvestorAt: r.signedByInvestorAt ?? null,
    paidAt: r.paidAt ?? null,
    documentUrl: r.documentUrl ?? null,
  };
}

const ListSchema = z.union([
  z.array(z.unknown()),
  z.object({ safeRequests: z.array(z.unknown()) }).transform((o) => o.safeRequests),
]);

/** Reads every SAFE request (the API has no paging). Unreadable rows are counted, not returned. */
export async function readSafeRequests(
  callTool: FinanceCallTool,
): Promise<{ rows: MercurySafeInput[]; unreadable: number }> {
  const list = ListSchema.safeParse(await callTool("getSafeRequests", {}));
  if (!list.success) throw new Error("Mercury returned SAFEs in a shape we do not recognize");
  const rows: MercurySafeInput[] = [];
  let unreadable = 0;
  for (const raw of list.data) {
    const row = mapSafeRequest(raw);
    if (row) rows.push(row);
    else unreadable += 1;
  }
  return { rows, unreadable };
}

/** `not_connected`: no enabled Mercury server. `skipped`: throttled, claimed elsewhere or the caller left. */
export type SafeSyncOutcome = "synced" | "skipped" | "failed" | "not_connected";

/** Stored timestamps are UTC without a zone, so compare against Postgres' UTC clock. */
const DB_NOW = Prisma.sql`timezone('utc', now())`;
/** Shorter than the 2-minute stale claim, so a slow sync ends before its claim can be taken over. */
const DEADLINE_MS = 100_000;

/**
 * Syncs the user's Mercury SAFEs into Postgres. One conditional UPDATE on `safe_sync_states` is the
 * 15-minute throttle (a failed sync backs off for a minute) and the claim; the write transaction
 * re-checks the claim token under a row lock, so a sync that lost its claim writes nothing. Errors
 * are recorded on the state row, never thrown. Nothing is written to Mercury.
 */
export async function syncSafesForUser(
  deps: SafeSyncDeps,
  scope: { spaceId: string; userId: string },
  opts: { force?: boolean; signal?: AbortSignal } = {},
): Promise<SafeSyncOutcome> {
  const { prisma } = deps;
  const { spaceId, userId } = scope;
  const servers = await prisma.mcpServer.findMany({
    where: { spaceId, userId, enabled: true },
    select: { id: true, endpoint: true },
    orderBy: { createdAt: "asc" },
  });
  const server = servers.find((s) => financeProviderForEndpoint(s.endpoint) === "mercury");
  if (!server) return "not_connected";

  const token = randomUUID();
  const force = opts.force === true;
  await prisma.$executeRaw`
    INSERT INTO safe_sync_states ("spaceId", "userId") VALUES (${spaceId}, ${userId})
    ON CONFLICT DO NOTHING`;
  const claimed = await prisma.$executeRaw`
    UPDATE safe_sync_states
    SET "syncStartedAt" = ${DB_NOW}, "claimToken" = ${token}
    WHERE "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND (${force}
        OR (("lastSyncedAt" IS NULL OR "lastSyncedAt" < ${DB_NOW} - interval '15 minutes')
          AND ("lastErrorAt" IS NULL OR "lastErrorAt" < ${DB_NOW} - interval '1 minute')))
      AND ("syncStartedAt" IS NULL OR "syncStartedAt" < ${DB_NOW} - interval '2 minutes')`;
  if (claimed === 0) return "skipped";

  const fail = async (error: unknown): Promise<SafeSyncOutcome> => {
    if (opts.signal?.aborted) {
      // The caller left, which says nothing about Mercury: keep the previous result.
      await prisma.$executeRaw`
        UPDATE safe_sync_states SET "syncStartedAt" = NULL, "claimToken" = NULL
        WHERE "spaceId" = ${spaceId} AND "userId" = ${userId} AND "claimToken" = ${token}`;
      return "skipped";
    }
    const reason = failureReason(error);
    getLogger().warn("safe sync failed", {
      serverId: server.id,
      errorName: error instanceof Error ? error.name : "unknown",
      reason: reason.message,
    });
    await prisma.$executeRaw`
      UPDATE safe_sync_states
      SET "lastErrorAt" = ${DB_NOW}, "lastError" = ${reason.message},
          "needsReconnect" = ${reason.reconnect}, "syncStartedAt" = NULL, "claimToken" = NULL
      WHERE "spaceId" = ${spaceId} AND "userId" = ${userId} AND "claimToken" = ${token}`;
    return "failed";
  };

  const signal = AbortSignal.any([
    ...(opts.signal ? [opts.signal] : []),
    AbortSignal.timeout(DEADLINE_MS),
  ]);
  let read: Awaited<ReturnType<typeof readSafeRequests>>;
  try {
    read = await readSafeRequests(await deps.callToolFor(server, signal));
    signal.throwIfAborted();
  } catch (error) {
    return fail(error);
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM safe_sync_states
          WHERE "spaceId" = ${spaceId} AND "userId" = ${userId} AND "claimToken" = ${token}
          FOR UPDATE`;
        if (owned.length === 0) return "skipped" as const;
        await writeMercurySafes(tx, scope, read.rows);
        await tx.$executeRaw`
          UPDATE safe_sync_states
          SET "lastSyncedAt" = ${DB_NOW}, "lastErrorAt" = NULL, "lastError" = NULL,
              "needsReconnect" = false, "unreadable" = ${read.unreadable},
              "syncStartedAt" = NULL, "claimToken" = NULL
          WHERE "spaceId" = ${spaceId} AND "userId" = ${userId} AND "claimToken" = ${token}`;
        return "synced" as const;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    return fail(error);
  }
}
