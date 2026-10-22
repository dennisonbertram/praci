import { randomUUID } from "node:crypto";
import type {
  FinanceAccount,
  FinanceBill,
  FinanceProvider,
  FinanceTransaction,
  TreasuryYieldMonth,
} from "@rakazo/contracts";
import { financeProviderForEndpoint } from "@rakazo/contracts";
import type { ClassifyContext } from "@rakazo/core";
import { classify } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { createBrexFinanceSource } from "./brex-finance-source.js";
import { FinanceShapeError } from "./finance-source-util.js";
import { createMercuryFinanceSource } from "./mercury-finance-source.js";

/**
 * Calls one read tool on a finance MCP server and returns the tool's JSON payload (the structured
 * content, or the text content parsed as JSON). Authentication and transport belong to whoever builds
 * it; sources never see credentials. Tests pass a function that returns canned responses.
 */
export type FinanceCallTool = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** An account as a source reports it; sync assigns the id. */
export type SourceAccount = Omit<FinanceAccount, "id" | "provider"> & { provider: FinanceProvider };

/** A transaction as a source reports it; sync assigns the id and, from `classify`, the classification. */
export type SourceTransaction = Omit<FinanceTransaction, "id" | "classification" | "provider"> & {
  provider: FinanceProvider;
};

export interface FinanceReceiptLink {
  url: string;
  mimeType: string | null;
}

/**
 * One provider behind a connected MCP server. Mappers validate each response with zod and throw on a
 * shape they do not recognize, so a changed vendor API shows as a sync error and writes no bad rows.
 * Money is converted to whole cents; dollars from the vendor are never kept as floats.
 */
export interface FinanceSource {
  provider: FinanceProvider;
  fetchAccounts(): Promise<SourceAccount[]>;
  /** Transactions posted (Brex: purchased) on or after `sinceISO`, every page. */
  fetchTransactions(sinceISO: string): Promise<SourceTransaction[]>;
  /** Mercury Treasury only. */
  fetchTreasuryYield?(): Promise<TreasuryYieldMonth[]>;
  /** Brex only: bills not yet paid. */
  fetchBills?(): Promise<FinanceBill[]>;
  /** A fresh download link for the transaction's receipt; null when it has none. Vendor links expire, so this is never stored. */
  receiptUrl(externalId: string): Promise<FinanceReceiptLink | null>;
}

export interface FinanceSyncDeps {
  prisma: PrismaClient;
  /** Builds the read-tool caller for one of the user's finance MCP servers. */
  callToolFor(
    server: { id: string; provider: FinanceProvider; endpoint: string },
    signal: AbortSignal,
  ): Promise<FinanceCallTool>;
  /** Clock; defaults to the system clock. */
  now?: () => Date;
}

export interface FinanceSyncOptions {
  /** Skip the 15-minute throttle (the page's refresh button). The in-flight claim still applies. */
  force?: boolean;
  signal?: AbortSignal;
}

/** `skipped`: throttled, claimed by another sync, or the caller left. */
export type FinanceSyncOutcome = "synced" | "skipped" | "failed";

/** One outcome per provider the user has a server for. */
export type FinanceSyncResult = Partial<Record<FinanceProvider, FinanceSyncOutcome>>;

/** Stored timestamps are UTC without a zone, so compare against Postgres' UTC clock. */
const DB_NOW = Prisma.sql`timezone('utc', now())`;
const BACKFILL_MONTHS = 13;
const OVERLAP_MS = 10 * 86_400_000;
/** How far back a still-pending charge can pull the re-read window. */
const PENDING_LOOKBACK_MS = 60 * 86_400_000;
/** Shorter than the 2-minute stale claim, so a slow sync ends before its claim can be taken over. */
const DEADLINE_MS = 100_000;
const INSERT_CHUNK = 200;

type Scope = { spaceId: string; userId: string };
type Server = { id: string; provider: FinanceProvider; endpoint: string };

/**
 * Syncs the user's Mercury and Brex servers into Postgres: accounts, transactions (13-month
 * backfill on the first run, then the last 10 days again so pending charges settle), Treasury yield
 * and open bills. One conditional UPDATE on `finance_sync_states` is the throttle and the claim;
 * the write transaction re-checks the claim token under a row lock, so a sync that lost its claim
 * writes nothing. Provider errors are recorded on the state row, never thrown. After a run that
 * stored data it recomputes `classification` for all the user's rows, because it depends on
 * whether Brex is connected.
 */
export async function syncFinanceForUser(
  deps: FinanceSyncDeps,
  scope: Scope,
  opts: FinanceSyncOptions = {},
): Promise<FinanceSyncResult> {
  const rows = await deps.prisma.mcpServer.findMany({
    where: { spaceId: scope.spaceId, userId: scope.userId, enabled: true },
    select: { id: true, endpoint: true },
    orderBy: { createdAt: "asc" },
  });
  // One server per provider; a second Mercury or Brex server is ignored.
  const servers = new Map<FinanceProvider, Server>();
  for (const row of rows) {
    const provider = financeProviderForEndpoint(row.endpoint);
    if (provider && row.endpoint && !servers.has(provider))
      servers.set(provider, { id: row.id, provider, endpoint: row.endpoint });
  }
  const brexConnected = await brexHasSynced(deps.prisma, servers.get("brex"));
  const result: FinanceSyncResult = {};
  await Promise.all(
    [...servers.values()].map(async (server) => {
      result[server.provider] = await syncServer(deps, scope, server, brexConnected, opts);
    }),
  );
  // Brex counts as connected only once it has synced, so Brex's own sync can turn it on now.
  if (Object.values(result).includes("synced"))
    await reclassify(deps.prisma, scope, await brexHasSynced(deps.prisma, servers.get("brex")));
  return result;
}

/**
 * What `classify` needs for the user right now, for rows that do not come from a sync (statement
 * imports). Matches what `reclassify` uses, so a later sync does not change their classification.
 */
export async function loadClassifyContext(
  prisma: PrismaClient,
  scope: Scope,
): Promise<ClassifyContext> {
  const { spaceId, userId } = scope;
  const rows = await prisma.mcpServer.findMany({
    where: { spaceId, userId, enabled: true },
    select: { id: true, endpoint: true },
    orderBy: { createdAt: "asc" },
  });
  const brex = rows.find((r) => financeProviderForEndpoint(r.endpoint) === "brex");
  const ownAccountNames = (
    await prisma.financeAccount.findMany({
      where: { spaceId, userId, provider: "mercury" },
      select: { name: true },
    })
  ).map((a) => a.name);
  return {
    brexConnected: brex
      ? await brexHasSynced(prisma, {
          id: brex.id,
          provider: "brex",
          endpoint: brex.endpoint ?? "",
        })
      : false,
    ownAccountNames,
  };
}

/** A Brex server whose sign-in never finished, or that needs a reconnect, is not a connected Brex. */
async function brexHasSynced(prisma: PrismaClient, server: Server | undefined): Promise<boolean> {
  if (!server) return false;
  const state = await prisma.financeSyncState.findUnique({
    where: { mcpServerId: server.id },
    select: { lastSyncedAt: true, needsReconnect: true },
  });
  return Boolean(state?.lastSyncedAt) && !state?.needsReconnect;
}

async function syncServer(
  deps: FinanceSyncDeps,
  scope: Scope,
  server: Server,
  brexConnected: boolean,
  opts: FinanceSyncOptions,
): Promise<FinanceSyncOutcome> {
  const { prisma } = deps;
  const { spaceId, userId } = scope;
  const token = randomUUID();
  const started = Date.now();
  const force = opts.force === true;

  await prisma.$executeRaw`
    INSERT INTO finance_sync_states ("mcpServerId", "spaceId", "userId")
    SELECT id, "spaceId", "userId" FROM mcp_servers
    WHERE id = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId} AND enabled
    ON CONFLICT DO NOTHING`;
  // The 15-minute throttle (a failed sync only backs off for a minute) and the in-flight claim.
  const claimed = await prisma.$queryRaw<Array<{ lastSyncedAt: Date | null }>>`
    UPDATE finance_sync_states
    SET "syncStartedAt" = ${DB_NOW}, "claimToken" = ${token}
    WHERE "mcpServerId" = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND (${force}
        OR (("lastSyncedAt" IS NULL OR "lastSyncedAt" < ${DB_NOW} - interval '15 minutes')
          AND ("lastErrorAt" IS NULL OR "lastErrorAt" < ${DB_NOW} - interval '1 minute')))
      AND ("syncStartedAt" IS NULL OR "syncStartedAt" < ${DB_NOW} - interval '2 minutes')
    RETURNING "lastSyncedAt"`;
  const state = claimed[0];
  if (!state) return "skipped";

  const fail = async (error: unknown): Promise<FinanceSyncOutcome> => {
    if (opts.signal?.aborted) {
      // The caller left, which says nothing about the provider: keep the previous error state.
      await prisma.$executeRaw`
        UPDATE finance_sync_states SET "syncStartedAt" = NULL, "claimToken" = NULL
        WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
      return "skipped";
    }
    const reason = failureReason(error);
    getLogger().warn("finance sync failed", {
      provider: server.provider,
      serverId: server.id,
      durationMs: Date.now() - started,
      errorName: error instanceof Error ? error.name : "unknown",
      reason: reason.message,
    });
    await prisma.$executeRaw`
      UPDATE finance_sync_states
      SET "lastErrorAt" = ${DB_NOW}, "lastError" = ${reason.message},
          "needsReconnect" = ${reason.reconnect}, "syncStartedAt" = NULL, "claimToken" = NULL
      WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
    return "failed";
  };

  const now = (deps.now ?? (() => new Date()))();
  let since = state.lastSyncedAt
    ? new Date(state.lastSyncedAt.getTime() - OVERLAP_MS)
    : new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - BACKFILL_MONTHS, now.getUTCDate()),
      );
  if (state.lastSyncedAt) {
    // A charge still pending after 10 days must be re-read too, or it never settles or voids.
    const [oldest] = await prisma.$queryRaw<Array<{ at: Date | null }>>`
      SELECT min(COALESCE("purchasedAt", "postedAt")) AS at FROM finance_transactions
      WHERE "mcpServerId" = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
        AND status = 'pending'`;
    if (oldest?.at) {
      const floor = now.getTime() - PENDING_LOOKBACK_MS;
      since = new Date(Math.min(since.getTime(), Math.max(oldest.at.getTime(), floor)));
    }
  }
  const signal = AbortSignal.any([
    ...(opts.signal ? [opts.signal] : []),
    AbortSignal.timeout(DEADLINE_MS),
  ]);

  let fetched: Fetched;
  try {
    const callTool = await deps.callToolFor(server, signal);
    const source =
      server.provider === "mercury"
        ? createMercuryFinanceSource(callTool)
        : createBrexFinanceSource(callTool);
    // Sequential: the vendors' servers are beta and rate limits are unknown.
    fetched = {
      accounts: await source.fetchAccounts(),
      transactions: await source.fetchTransactions(since.toISOString()),
      yields: (await source.fetchTreasuryYield?.()) ?? [],
      bills: source.fetchBills ? await source.fetchBills() : undefined,
    };
    signal.throwIfAborted();
  } catch (error) {
    return fail(error);
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM finance_sync_states
          WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}
          FOR UPDATE`;
        if (owned.length === 0) return "skipped" as const;
        await writeFetched(tx, scope, server, fetched, brexConnected, now, since);
        await tx.$executeRaw`
          UPDATE finance_sync_states
          SET "lastSyncedAt" = ${DB_NOW}, "lastErrorAt" = NULL, "lastError" = NULL,
              "needsReconnect" = false, "syncStartedAt" = NULL, "claimToken" = NULL
          WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
        return "synced" as const;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return outcome;
  } catch (error) {
    return fail(error);
  }
}

interface Fetched {
  accounts: SourceAccount[];
  transactions: SourceTransaction[];
  yields: TreasuryYieldMonth[];
  /** Undefined when the provider has no bills; an empty list clears the stored ones. */
  bills: FinanceBill[] | undefined;
}

async function writeFetched(
  tx: Prisma.TransactionClient,
  { spaceId, userId }: Scope,
  server: Server,
  fetched: Fetched,
  brexConnected: boolean,
  now: Date,
  since: Date,
): Promise<void> {
  const chunks = <T>(items: T[]) =>
    Array.from({ length: Math.ceil(items.length / INSERT_CHUNK) }, (_, i) =>
      items.slice(i * INSERT_CHUNK, (i + 1) * INSERT_CHUNK),
    );
  const base = (): Prisma.Sql => Prisma.sql`${randomUUID()}, ${spaceId}, ${userId}, ${server.id}`;
  const cents = (n: number) => BigInt(n);

  for (const chunk of chunks(fetched.accounts)) {
    await tx.$executeRaw`
      INSERT INTO finance_accounts (id, "spaceId", "userId", "mcpServerId", provider, "externalId",
        name, "lastFour", kind, "balanceCents", currency, "updatedAt")
      VALUES ${Prisma.join(
        chunk.map(
          (a) => Prisma.sql`(${base()}, ${a.provider}, ${a.externalId}, ${a.name}, ${a.lastFour},
            ${a.kind}, ${cents(a.balanceCents)}, ${a.currency}, ${now})`,
        ),
      )}
      ON CONFLICT ("mcpServerId", "externalId") DO UPDATE SET
        name = EXCLUDED.name, "lastFour" = EXCLUDED."lastFour", kind = EXCLUDED.kind,
        "balanceCents" = EXCLUDED."balanceCents", currency = EXCLUDED.currency,
        "updatedAt" = EXCLUDED."updatedAt"`;
  }

  // An account missing from a fresh snapshot is closed: its old balance must not stay in cash.
  await tx.$executeRaw`
    DELETE FROM finance_accounts
    WHERE "mcpServerId" = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND "externalId" <> ALL(${fetched.accounts.map((a) => a.externalId)}::text[])`;

  // Moves between the user's own Mercury accounts are told apart by account name.
  const ownAccountNames = (
    await tx.financeAccount.findMany({
      where: { spaceId, userId, provider: "mercury" },
      select: { name: true },
    })
  ).map((a) => a.name);
  const unique = new Map(fetched.transactions.map((t) => [t.externalId, t]));
  for (const chunk of chunks([...unique.values()])) {
    await tx.$executeRaw`
      INSERT INTO finance_transactions (id, "spaceId", "userId", "mcpServerId", provider,
        "externalId", "accountExternalId", "postedAt", "purchasedAt", "amountCents", currency,
        counterparty, "vendorKey", category, status, kind, classification, "cardLastFour",
        cardholder, memo, "hasReceipt", "dashboardUrl", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map(
          (t) => Prisma.sql`(${base()}, ${t.provider}, ${t.externalId}, ${t.accountExternalId},
            ${new Date(t.postedAt)}, ${t.purchasedAt ? new Date(t.purchasedAt) : null},
            ${cents(t.amountCents)}, ${t.currency}, ${t.counterparty}, ${t.vendorKey}, ${t.category},
            ${t.status}, ${t.kind}, ${classify(t, { brexConnected, ownAccountNames })},
            ${t.cardLastFour}, ${t.cardholder}, ${t.memo}, ${t.hasReceipt}, ${t.dashboardUrl}, ${now})`,
        ),
      )}
      ON CONFLICT ("mcpServerId", "externalId") DO UPDATE SET
        "accountExternalId" = EXCLUDED."accountExternalId", "postedAt" = EXCLUDED."postedAt",
        "purchasedAt" = EXCLUDED."purchasedAt", "amountCents" = EXCLUDED."amountCents",
        currency = EXCLUDED.currency, counterparty = EXCLUDED.counterparty,
        "vendorKey" = EXCLUDED."vendorKey", category = EXCLUDED.category, status = EXCLUDED.status,
        kind = EXCLUDED.kind, classification = EXCLUDED.classification,
        "cardLastFour" = EXCLUDED."cardLastFour", cardholder = EXCLUDED.cardholder,
        memo = EXCLUDED.memo, "hasReceipt" = EXCLUDED."hasReceipt",
        "dashboardUrl" = EXCLUDED."dashboardUrl", "updatedAt" = EXCLUDED."updatedAt"`;
  }

  // A charge that was pending and is gone (canceled or failed) must not stay on the page. Only rows
  // inside the window just read can be judged; a settled charge comes back under its own id.
  await tx.$executeRaw`
    DELETE FROM finance_transactions
    WHERE "mcpServerId" = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND status = 'pending' AND COALESCE("purchasedAt", "postedAt") >= ${since}
      AND "externalId" <> ALL(${[...unique.keys()]}::text[])`;

  for (const chunk of chunks(fetched.yields)) {
    await tx.$executeRaw`
      INSERT INTO finance_treasury_yields (id, "spaceId", "userId", "mcpServerId",
        "accountExternalId", month, "dividendsCents", "feeCents", "netCents", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map(
          (y) => Prisma.sql`(${base()}, ${y.accountExternalId}, ${y.month},
            ${cents(y.dividendsCents)}, ${cents(y.feeCents)}, ${cents(y.netCents)}, ${now})`,
        ),
      )}
      ON CONFLICT ("mcpServerId", "accountExternalId", month) DO UPDATE SET
        "dividendsCents" = EXCLUDED."dividendsCents", "feeCents" = EXCLUDED."feeCents",
        "netCents" = EXCLUDED."netCents", "updatedAt" = EXCLUDED."updatedAt"`;
  }

  if (fetched.bills) {
    // Bills leave the list when they are paid, so the open set is replaced, not merged.
    await tx.financeBill.deleteMany({ where: { mcpServerId: server.id, spaceId, userId } });
    for (const chunk of chunks(fetched.bills)) {
      await tx.$executeRaw`
        INSERT INTO finance_bills (id, "spaceId", "userId", "mcpServerId", provider, "externalId",
          "vendorName", "vendorKey", "dueAt", "amountCents", status, "updatedAt")
        VALUES ${Prisma.join(
          chunk.map(
            (b) => Prisma.sql`(${base()}, ${b.provider}, ${b.externalId}, ${b.vendorName},
              ${b.vendorKey}, ${new Date(b.dueAt)}, ${cents(b.amountCents)}, ${b.status}, ${now})`,
          ),
        )}
        ON CONFLICT ("mcpServerId", "externalId") DO NOTHING`;
    }
  }
}

/** Recomputes every stored classification of the user, for the current Brex connection state. */
async function reclassify(prisma: PrismaClient, scope: Scope, brexConnected: boolean) {
  const { spaceId, userId } = scope;
  const ownAccountNames = (
    await prisma.financeAccount.findMany({
      where: { spaceId, userId, provider: "mercury" },
      select: { name: true },
    })
  ).map((a) => a.name);
  const rows = await prisma.financeTransaction.findMany({
    where: { spaceId, userId },
    select: {
      id: true,
      provider: true,
      amountCents: true,
      counterparty: true,
      kind: true,
      category: true,
      classification: true,
    },
  });
  const changed = new Map<string, string[]>();
  for (const row of rows) {
    const next = classify(
      {
        provider: row.provider as FinanceProvider,
        amountCents: Number(row.amountCents),
        counterparty: row.counterparty,
        kind: row.kind,
        category: row.category,
      },
      { brexConnected, ownAccountNames },
    );
    if (next !== row.classification) changed.set(next, [...(changed.get(next) ?? []), row.id]);
  }
  for (const [classification, ids] of changed) {
    for (let i = 0; i < ids.length; i += 5_000) {
      await prisma.financeTransaction.updateMany({
        where: { spaceId, userId, id: { in: ids.slice(i, i + 5_000) } },
        data: { classification },
      });
    }
  }
}

/** A short reason for the page: never a vendor payload, credential or URL. */
export function failureReason(error: unknown): { message: string; reconnect: boolean } {
  if (error instanceof FinanceShapeError) return { message: error.message, reconnect: false };
  const text = error instanceof Error ? error.message : "";
  if (/authorization expired|unauthori[sz]ed|reauthori[sz]|\b401\b/i.test(text))
    return { message: "Sign-in expired", reconnect: true };
  if (error instanceof Error && (error.name === "TimeoutError" || /timed? ?out/i.test(text)))
    return { message: "The request timed out", reconnect: false };
  return { message: "The request failed", reconnect: false };
}
