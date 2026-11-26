import { EQUITY_POSTGRES_BIGINT_MAX, EQUITY_POSTGRES_BIGINT_MIN } from "@rakazo/contracts";
import type { PrismaClient } from "../client.js";
import { Prisma } from "../client.js";
import { IsolationError } from "../scope.js";

/**
 * Shared helpers for the cap table ledger stores. Every store takes the actor's scope, passes it
 * through `scopeOf` (never a whole actor into a query), and runs under the request's tenant
 * context, so row-level security backs up the explicit filters.
 */

export type EquityScope = { spaceId: string; userId: string };
/** The client or an interactive transaction (never a batch `$transaction([...])`). */
export type EquityDb = PrismaClient | Prisma.TransactionClient;

export const scopeOf = ({ spaceId, userId }: EquityScope): EquityScope => ({ spaceId, userId });

/** A record of the caller's ledger is missing, or belongs to someone else: answered the same. */
export const notFound = (what = "Cap table record") => new IsolationError(`${what} not found`);

/** The write conflicts with the ledger's state (a duplicate name or label, a locked field). */
export class EquityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EquityConflictError";
  }
}

/** The input is well-formed but not acceptable (more shares than authorized, a bad reference). */
export class EquityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EquityInputError";
  }
}

/** Creates the user's ledger root on first write. Every Equity row's foreign key needs it. */
export async function ensureLedger(prisma: EquityDb, actor: EquityScope): Promise<void> {
  const scope = scopeOf(actor);
  await prisma.equityLedger.upsert({
    where: { spaceId_userId: scope },
    create: scope,
    update: {},
  });
}

/** The ledger root, or null before the first write. */
export function findLedger(prisma: EquityDb, actor: EquityScope) {
  return prisma.equityLedger.findUnique({ where: { spaceId_userId: scopeOf(actor) } });
}

/** Turns a unique-index violation into a conflict the API answers with CONFLICT. */
export async function withConflict<T>(message: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new EquityConflictError(message);
    throw error;
  }
}

// ---- wire conversions: integer strings <-> BigInt, decimal strings <-> Decimal, dates ----

const POSTGRES_BIGINT_MIN = EQUITY_POSTGRES_BIGINT_MIN;
const POSTGRES_BIGINT_MAX = EQUITY_POSTGRES_BIGINT_MAX;

export function assertPostgresBigInt(value: bigint): bigint {
  if (value < POSTGRES_BIGINT_MIN || value > POSTGRES_BIGINT_MAX)
    throw new EquityInputError("Integer is outside the PostgreSQL BIGINT range");
  return value;
}

export const toBig = (value: string): bigint => assertPostgresBigInt(BigInt(value));
export const toBigOrNull = (value: string | null | undefined) =>
  value == null ? (value as null | undefined) : assertPostgresBigInt(BigInt(value));
export const fromBig = (value: bigint): string => assertPostgresBigInt(value).toString();
export const fromBigOrNull = (value: bigint | null): string | null =>
  value === null ? null : assertPostgresBigInt(value).toString();

export const toDecimal = (value: string) => new Prisma.Decimal(value);
export const toDecimalOrNull = (value: string | null | undefined) =>
  value == null ? (value as null | undefined) : new Prisma.Decimal(value);
/** Plain decimal notation (never exponent), trailing zeros dropped: "1.25", "0.0001". */
export const fromDecimal = (value: Prisma.Decimal): string => {
  const text = value.toFixed(10);
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
};
export const fromDecimalOrNull = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : fromDecimal(value);

/** A YYYY-MM-DD calendar date as the UTC midnight Prisma stores in a `@db.Date` column. */
export const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export const toDateOrNull = (value: string | null | undefined) =>
  value == null ? (value as null | undefined) : toDate(value);
export const fromDate = (value: Date): string => value.toISOString().slice(0, 10);
export const fromDateOrNull = (value: Date | null): string | null =>
  value === null ? null : fromDate(value);
export const iso = (value: Date): string => value.toISOString();

/** Today as YYYY-MM-DD (UTC). */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Removes the keys whose value is undefined, so a partial update never writes them. */
export function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

// ---- lists ----

export type ListInput<F extends string> = {
  page: number;
  pageSize: number;
  sort?: { field: F; dir: "asc" | "desc" } | undefined;
  search?: string | undefined;
};

/** skip/take for a 1-based page. */
export const pageArgs = ({ page, pageSize }: { page: number; pageSize: number }) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

/** One page of items with the total that matched. */
export const pageOf = <T>(
  items: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
) => ({ items, total, page, pageSize });

/** A case-insensitive contains filter, or undefined for an empty search. */
export const contains = (search: string | undefined) =>
  search ? { contains: search, mode: "insensitive" as const } : undefined;

/** A date range filter on a `@db.Date` column. */
export function dateRange(from: string | undefined, to: string | undefined) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: toDate(from) } : {}), ...(to ? { lte: toDate(to) } : {}) };
}

// ---- references and labels ----

type Referenced =
  | "equityStakeholder"
  | "equityShareClass"
  | "equityPlan"
  | "equityVestingTemplate"
  | "equityVestingSchedule"
  | "equityCertificate"
  | "equityConvertibleBlock"
  | "equityConvertible"
  | "equityOptionGrant"
  | "equityFundingRound";

/**
 * Refuses an id that is not a row of the caller's ledger. Foreign keys alone do not check the
 * tenant of a nullable reference, so every store calls this for the ids an input names.
 */
export async function assertInLedger(
  prisma: EquityDb,
  actor: EquityScope,
  model: Referenced,
  id: string | null | undefined,
): Promise<void> {
  if (id == null) return;
  if (model === "equityStakeholder" && inOpenTransaction(prisma)) {
    // A share lock on the holder row waits for a merge that is writing it and then reads its
    // result, so a merge that commits between this check and the insert cannot be missed. The
    // ledger lock comes first, as in the merge, so the two can only queue and never deadlock.
    await lockEquityLedger(prisma as Prisma.TransactionClient, actor);
    const scope = scopeOf(actor);
    const [row] = await (prisma as Prisma.TransactionClient).$queryRawUnsafe<
      Array<{ mergedIntoId: string | null }>
    >(
      'SELECT "mergedIntoId" FROM "equity_stakeholders" WHERE "id" = $1 AND "spaceId" = $2 AND "userId" = $3 FOR SHARE',
      id,
      scope.spaceId,
      scope.userId,
    );
    if (!row) throw new EquityInputError("Unknown stakeholder");
    if (row.mergedIntoId) throw new EquityInputError("This stakeholder is already merged");
    return;
  }
  const delegate = prisma[model] as unknown as {
    findFirst: (args: unknown) => Promise<{ id: string; mergedIntoId?: string | null } | null>;
  };
  const row = await delegate.findFirst({
    where: { id, ...scopeOf(actor) },
    select: model === "equityStakeholder" ? { id: true, mergedIntoId: true } : { id: true },
  });
  if (!row) throw new EquityInputError(`Unknown ${model.replace(/^equity/, "").toLowerCase()}`);
  // A merged holder is hidden from every view, so nothing may be issued or linked to it.
  if (row.mergedIntoId) throw new EquityInputError("This stakeholder is already merged");
}

type Labeled = "equityCertificate" | "equityConvertible" | "equityOptionGrant" | "equityWarrant";

type EquityLockTarget =
  | "certificate"
  | "convertible"
  | "grant"
  | "warrant"
  | "exercise"
  | "shareClass"
  | "plan"
  | "draftSet"
  | "fundingRound"
  | "stakeholder";

const EQUITY_LOCK_TABLES: Record<EquityLockTarget, string> = {
  certificate: "equity_certificates",
  convertible: "equity_convertibles",
  grant: "equity_option_grants",
  warrant: "equity_warrants",
  exercise: "equity_exercises",
  shareClass: "equity_share_classes",
  plan: "equity_plans",
  draftSet: "equity_draft_sets",
  fundingRound: "equity_funding_rounds",
  stakeholder: "equity_stakeholders",
};

function inOpenTransaction(client: object): boolean {
  return !(
    "$transaction" in client &&
    typeof Reflect.get(client, "$transaction") === "function" &&
    typeof Reflect.get(client, "$connect") === "function"
  );
}

function assertInteractiveTransaction(tx: Prisma.TransactionClient): void {
  if (!inOpenTransaction(tx)) throw new Error("Equity locks require an interactive transaction");
}

/** Lock the ledger row as a coarse serialization gate inside an interactive transaction. */
export async function lockEquityLedger(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
): Promise<void> {
  assertInteractiveTransaction(tx);
  const scope = scopeOf(actor);
  const rows = await tx.$queryRawUnsafe<Array<{ spaceId: string }>>(
    'SELECT "spaceId" FROM "equity_ledgers" WHERE "spaceId" = $1 AND "userId" = $2 FOR UPDATE',
    scope.spaceId,
    scope.userId,
  );
  if (rows.length !== 1) throw notFound("Cap table ledger");
}

async function lockEquityRows(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  target: EquityLockTarget,
  ids: readonly string[],
): Promise<void> {
  assertInteractiveTransaction(tx);
  const orderedIds = [...new Set(ids)].sort();
  if (orderedIds.length === 0) return;
  const scope = scopeOf(actor);
  const table = EQUITY_LOCK_TABLES[target];
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "${table}" WHERE "spaceId" = $1 AND "userId" = $2 AND "id" = ANY($3::text[]) ORDER BY "id" FOR UPDATE`,
    scope.spaceId,
    scope.userId,
    orderedIds,
  );
  if (rows.length !== orderedIds.length)
    throw notFound(`${target[0]?.toUpperCase()}${target.slice(1)}`);
}

export const lockEquityCertificates = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "certificate", ids);

export const lockEquityConvertibles = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "convertible", ids);

export const lockEquityOptionGrants = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "grant", ids);

export const lockEquityWarrants = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "warrant", ids);

export const lockEquityExercises = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "exercise", ids);

export const lockEquityShareClasses = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "shareClass", ids);

export const lockEquityPlans = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "plan", ids);

export const lockEquityStakeholders = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "stakeholder", ids);

export const lockEquityDraftSets = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "draftSet", ids);

export const lockEquityFundingRounds = (
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  ids: readonly string[],
) => lockEquityRows(tx, actor, "fundingRound", ids);

/** Serialize automatic labels for this ledger and prefix until the transaction completes. */
export async function lockEquityLabelPrefix(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  model: Labeled,
  prefix: string,
): Promise<void> {
  assertInteractiveTransaction(tx);
  const scope = scopeOf(actor);
  await tx.$queryRawUnsafe<Array<{ locked: number }>>(
    "SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended($1, 0))) AS lock",
    JSON.stringify([scope.spaceId, scope.userId, model, prefix]),
  );
}

/** Copies a certificate's schedule so the child retains terms and the original remains historical. */
export async function copyVestingScheduleForChild(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  scheduleId: string | null,
  childQuantity: bigint,
  sourceQuantity: bigint,
): Promise<string | null> {
  if (!scheduleId) return null;
  const scope = scopeOf(actor);
  const source = await tx.equityVestingSchedule.findFirst({
    where: { id: scheduleId, ...scope },
    select: {
      templateId: true,
      startDate: true,
      totalMonths: true,
      cliffMonths: true,
      frequencyMonths: true,
      tranches: true,
      acceleratedShares: true,
      acceleratedOn: true,
      stoppedOn: true,
    },
  });
  if (!source) throw notFound("Vesting schedule");
  const copy = await tx.equityVestingSchedule.create({
    data: {
      ...scope,
      ...source,
      tranches: toJson(source.tranches),
      acceleratedShares:
        source.acceleratedShares === null
          ? null
          : assertPostgresBigInt((source.acceleratedShares * childQuantity) / sourceQuantity),
    },
    select: { id: true },
  });
  return copy.id;
}

/** The next free "<PREFIX>-<n>" label of a kind in the caller's ledger. */
export async function nextLabel(
  prisma: Prisma.TransactionClient,
  actor: EquityScope,
  model: Labeled,
  prefix: string,
): Promise<string> {
  await lockEquityLabelPrefix(prisma, actor, model, prefix);
  const delegate = prisma[model] as unknown as {
    findMany: (args: unknown) => Promise<Array<{ label: string }>>;
  };
  const rows = await delegate.findMany({
    where: { ...scopeOf(actor), label: { startsWith: `${prefix}-` } },
    select: { label: true },
  });
  const highest = rows.reduce((max, { label }) => {
    const suffix = label.slice(prefix.length + 1);
    if (!/^\d+$/.test(suffix)) return max;
    const number = BigInt(suffix);
    return number > max ? number : max;
  }, 0n);
  return `${prefix}-${highest + 1n}`;
}

// ---- history ----

export type TransactionRecord = {
  kind: string;
  effectiveDate: string;
  reason?: string | null;
  certificateId?: string | null;
  convertibleId?: string | null;
  optionGrantId?: string | null;
  warrantId?: string | null;
  planId?: string | null;
  quantity?: bigint | null;
  valueCents?: bigint | null;
  before?: unknown;
  after?: unknown;
  resulting?: string[];
  note?: string | null;
  actorName?: string | null;
  /** Idempotency key columns of the request that made this change; see request-key.ts. */
  requestKey?: string;
  requestHash?: string;
};

/** JSON for a before/after column: BigInt and Decimal as strings, Dates as ISO strings. */
export function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      typeof entry === "bigint"
        ? assertPostgresBigInt(entry).toString()
        : entry instanceof Prisma.Decimal
          ? fromDecimal(entry)
          : entry,
    ),
  ) as Prisma.InputJsonValue;
}

/**
 * Appends one transaction row. Call it in the same interactive transaction as the change it
 * records; the table is append-only (the app may not update or delete its rows).
 */
export async function recordTransaction(
  prisma: EquityDb,
  actor: EquityScope,
  record: TransactionRecord,
): Promise<string> {
  // Who made the change: the caller's name unless the record names someone (an import, a seed).
  const actorName =
    record.actorName !== undefined
      ? record.actorName
      : ((
          await prisma.user.findUnique({
            where: { id: actor.userId },
            select: { name: true, email: true },
          })
        )?.name ?? null);
  const row = await prisma.equityTransaction.create({
    data: {
      ...scopeOf(actor),
      kind: record.kind,
      effectiveDate: toDate(record.effectiveDate),
      reason: record.reason ?? null,
      certificateId: record.certificateId ?? null,
      convertibleId: record.convertibleId ?? null,
      optionGrantId: record.optionGrantId ?? null,
      warrantId: record.warrantId ?? null,
      planId: record.planId ?? null,
      quantity: record.quantity == null ? record.quantity : assertPostgresBigInt(record.quantity),
      valueCents:
        record.valueCents == null ? record.valueCents : assertPostgresBigInt(record.valueCents),
      before: toJson(record.before),
      after: toJson(record.after),
      resulting: record.resulting ?? [],
      note: record.note ?? null,
      actorName,
      requestKey: record.requestKey,
      requestHash: record.requestHash,
    },
    select: { id: true },
  });
  return row.id;
}

/** Runs `fn` in one interactive transaction (the client's), or inside the one already open. */
export function inTransaction<T>(
  prisma: EquityDb,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { isolationLevel: Prisma.TransactionIsolationLevel },
): Promise<T> {
  const transaction =
    "$transaction" in prisma
      ? (prisma as PrismaClient).$transaction((tx) => fn(tx), options)
      : fn(prisma as Prisma.TransactionClient);
  return transaction.catch((error: unknown) => {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
    if (
      error.code === "P2004" ||
      (error.code === "P2039" && error.message.includes("Code: `23514`"))
    )
      throw new EquityInputError("A cap table value is invalid");
    if (error.code === "P2003")
      throw new EquityInputError("A referenced record is not in this ledger");
    throw error;
  });
}

/** Consistent multi-query plan reads without changing an existing transaction's isolation. */
export function inRepeatableReadTransaction<T>(
  prisma: EquityDb,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return inTransaction(prisma, fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}
