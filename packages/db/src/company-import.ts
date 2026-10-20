import { createHash, randomUUID } from "node:crypto";
import type { AgentUsage, UsageOperationKind } from "@rakazo/adapter-kit";
import type {
  Actor,
  CompanyEdgeImportInput,
  CompanyEntityImportInput,
  CompanyEventImportInput,
  CompanyImportCreateInput,
  CompanyImportProgress,
  CompanyImportSourceInput,
} from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { companyWriter } from "./company.js";
import { withTransactionRetry } from "./transaction-retry.js";
import { recordUsage } from "./usage.js";

type Scope = { spaceId: string; ownerUserId: string };
type Db = PrismaClient | Prisma.TransactionClient;
type ImportWrite =
  | { kind: "entity"; input: CompanyEntityImportInput }
  | { kind: "edge"; input: CompanyEdgeImportInput }
  | { kind: "event"; input: CompanyEventImportInput };

export class CompanyImportError extends Error {
  constructor(readonly code: "not_found" | "invalid_state" | "stale_claim" | "budget_reached") {
    super(code);
  }
}

const scopeOf = (actor: Pick<Actor, "spaceId" | "userId">): Scope => ({
  spaceId: actor.spaceId,
  ownerUserId: actor.userId,
});

async function requireMember(db: Db, scope: Scope) {
  const membership = await db.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.ownerUserId } },
    select: { id: true },
  });
  if (!membership) throw new CompanyImportError("not_found");
}

async function lockCompanyScope(tx: Prisma.TransactionClient, scope: Scope) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`company:${scope.spaceId}:${scope.ownerUserId}`}, 0))`;
}

function importSourceKey(source: CompanyImportSourceInput): string {
  return createHash("sha256")
    .update(JSON.stringify([source.sourceKind, source.connectionId ?? null, source.scope]))
    .digest("hex");
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createCompanyImportRun(
  prisma: PrismaClient,
  actor: Actor,
  input: CompanyImportCreateInput,
) {
  const scope = scopeOf(actor);
  if (!Number.isSafeInteger(input.tokenCap) || input.tokenCap <= 0) {
    throw new CompanyImportError("invalid_state");
  }
  await requireMember(prisma, scope);
  for (const source of input.sources) {
    if (!source.connectionId) continue;
    const connection = await prisma.connection.findFirst({
      where: { id: source.connectionId, spaceId: scope.spaceId, userId: scope.ownerUserId },
      select: { id: true },
    });
    if (!connection) throw new CompanyImportError("not_found");
  }
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await requireMember(tx, scope);
      const run = await tx.companyImportRun.create({
        data: {
          ...scope,
          status: "draft",
          tokenCap: BigInt(input.tokenCap),
          disclosureVersion: AI_DISCLOSURE_VERSION,
        },
        select: { id: true },
      });
      for (const sourceInput of input.sources) {
        const source = await tx.companyImportSource.create({
          data: {
            ...scope,
            runId: run.id,
            sourceKey: importSourceKey(sourceInput),
            sourceKind: sourceInput.sourceKind,
            connectionId: sourceInput.connectionId ?? null,
            scope: jsonInput(sourceInput.scope),
          },
          select: { id: true },
        });
        await tx.companyImportUnit.create({
          data: { ...scope, runId: run.id, sourceId: source.id, unitKey: "discover:0" },
        });
      }
      return run;
    }),
  );
}

export async function startCompanyImportRun(prisma: PrismaClient, actor: Actor, runId: string) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return prisma.$transaction(async (tx) => {
    const run = await tx.companyImportRun.findFirst({
      where: { ...scope, id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new CompanyImportError("not_found");
    if (run.status !== "draft") throw new CompanyImportError("invalid_state");
    const now = new Date();
    await tx.companyImportRun.update({
      where: { ...scope, id: run.id },
      data: { status: "running", startedAt: now, completedAt: null },
    });
    await tx.companyImportSource.updateMany({
      where: { ...scope, runId, status: "waiting" },
      data: { status: "running" },
    });
    return run;
  });
}

export async function getCompanyImportProgress(
  prisma: Db,
  actor: Actor,
  runId: string,
): Promise<CompanyImportProgress> {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  const run = await prisma.companyImportRun.findFirst({
    where: { ...scope, id: runId },
    include: { sources: { select: { id: true, sourceKind: true, status: true } } },
  });
  if (!run) throw new CompanyImportError("not_found");
  const units = await prisma.companyImportUnit.findMany({
    where: { ...scope, runId },
    select: { sourceId: true, status: true },
  });
  const counts: Record<string, number> = {};
  for (const unit of units) counts[unit.status] = (counts[unit.status] ?? 0) + 1;
  const sources = run.sources.map((source) => ({
    id: source.id,
    sourceKind: source.sourceKind as CompanyImportProgress["sources"][number]["sourceKind"],
    status: source.status,
    units: units.filter((unit) => unit.sourceId === source.id).length,
  }));
  const spent = run.reservedTokens + run.inputTokensUsed + run.outputTokensUsed;
  return {
    runId: run.id,
    status: run.status,
    tokenCap: Number(run.tokenCap),
    reservedTokens: Number(run.reservedTokens),
    inputTokensUsed: Number(run.inputTokensUsed),
    outputTokensUsed: Number(run.outputTokensUsed),
    budgetWarning: spent * 100n >= run.tokenCap * 80n,
    counts,
    sources,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function updateCompanyImportRun(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    action: "pause" | "resume" | "retry_failed" | "cancel" | "discard";
    tokenCap?: number;
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId },
        select: { id: true, status: true, tokenCap: true },
      });
      if (!run) throw new CompanyImportError("not_found");
      const now = new Date();
      if (input.action === "pause") {
        if (run.status !== "running") throw new CompanyImportError("invalid_state");
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: "paused" },
        });
      } else if (input.action === "resume") {
        if (!["paused", "awaiting_consent", "budget_reached", "partial"].includes(run.status)) {
          throw new CompanyImportError("invalid_state");
        }
        if (
          input.tokenCap !== undefined &&
          (!Number.isSafeInteger(input.tokenCap) || input.tokenCap < run.tokenCap)
        ) {
          throw new CompanyImportError("invalid_state");
        }
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: {
            status: "running",
            ...(input.tokenCap !== undefined ? { tokenCap: BigInt(input.tokenCap) } : {}),
          },
        });
      } else if (input.action === "retry_failed") {
        if (!["partial", "failed", "running", "paused"].includes(run.status)) {
          throw new CompanyImportError("invalid_state");
        }
        await tx.companyImportUnit.updateMany({
          where: { ...scope, runId: run.id, status: "failed" },
          data: { status: "waiting", attempts: 0, availableAt: now, lastError: null },
        });
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: "running", completedAt: null },
        });
      } else {
        await lockCompanyScope(tx, scope);
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: input.action === "cancel" ? "cancelled" : "discarded", completedAt: now },
        });
        await tx.companyImportUnit.updateMany({
          where: { ...scope, runId: run.id, status: { not: "done" } },
          data: { status: "cancelled", claimToken: null, claimExpiresAt: null },
        });
        if (input.action === "discard") {
          await tx.companyEvidence.deleteMany({
            where: { ...scope, extractorRunId: run.id },
          });
          await tx.companyCandidate.deleteMany({ where: { ...scope, importRunId: run.id } });
        }
      }
      return getCompanyImportProgress(tx, actor, run.id);
    }),
  );
}

export async function claimCompanyImportUnit(
  prisma: PrismaClient,
  actor: Actor,
  input: { runId: string; unitId: string },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const runRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status" FROM "company_import_runs"
        WHERE "id" = ${input.runId} AND "spaceId" = ${scope.spaceId} AND "ownerUserId" = ${scope.ownerUserId}
        FOR UPDATE
      `;
      const run = runRows[0];
      if (!run) throw new CompanyImportError("not_found");
      if (run.status !== "running") return null;
      const unit = await tx.companyImportUnit.findFirst({
        where: { ...scope, id: input.unitId, runId: input.runId },
        include: { source: true },
      });
      if (!unit) throw new CompanyImportError("not_found");
      await tx.$queryRaw`
        SELECT "id" FROM "company_import_sources"
        WHERE "id" = ${unit.sourceId} AND "spaceId" = ${scope.spaceId} AND "ownerUserId" = ${scope.ownerUserId}
        FOR UPDATE
      `;
      const now = new Date();
      if (unit.source.backoffUntil && unit.source.backoffUntil > now) return null;
      const expired = await tx.companyImportUnit.updateMany({
        where: {
          ...scope,
          sourceId: unit.sourceId,
          status: "claimed",
          claimExpiresAt: { lte: now },
          attempts: { gte: 3 },
        },
        data: {
          status: "failed",
          claimToken: null,
          claimExpiresAt: null,
          lastError: "lease_expired",
        },
      });
      await tx.companyImportUnit.updateMany({
        where: {
          ...scope,
          sourceId: unit.sourceId,
          status: "claimed",
          claimExpiresAt: { lte: now },
          attempts: { lt: 3 },
        },
        data: {
          status: "waiting",
          claimToken: null,
          claimExpiresAt: null,
          availableAt: now,
          lastError: "lease_expired",
        },
      });
      const active = await tx.companyImportUnit.count({
        where: {
          ...scope,
          sourceId: unit.sourceId,
          status: "claimed",
          claimExpiresAt: { gt: now },
        },
      });
      if (active >= unit.source.concurrency || (expired.count > 0 && unit.status === "claimed"))
        return null;
      const fresh = await tx.companyImportUnit.findFirst({
        where: {
          ...scope,
          id: input.unitId,
          runId: input.runId,
          status: "waiting",
          availableAt: { lte: now },
          attempts: { lt: 3 },
        },
      });
      if (!fresh) return null;
      const claimToken = randomUUID();
      const claimExpiresAt = new Date(now.getTime() + 120_000);
      await tx.companyImportUnit.update({
        where: { ...scope, id: fresh.id },
        data: {
          status: "claimed",
          attempts: { increment: 1 },
          claimToken,
          claimExpiresAt,
        },
      });
      return { ...fresh, claimToken, claimExpiresAt, source: unit.source };
    }),
  );
}

export async function persistCompanyImportDiscovery(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    sourceId: string;
    units: { unitKey: string; cursor: unknown }[];
    nextCursor: unknown | null;
    done: boolean;
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
        include: { run: true },
      });
      if (!source) throw new CompanyImportError("not_found");
      if (!["running", "paused"].includes(source.run.status))
        throw new CompanyImportError("invalid_state");
      for (const unit of input.units) {
        await tx.companyImportUnit.createMany({
          data: [
            {
              ...scope,
              runId: input.runId,
              sourceId: source.id,
              unitKey: unit.unitKey,
              ...(unit.cursor === null ? {} : { cursor: jsonInput(unit.cursor) }),
            },
          ],
          skipDuplicates: true,
        });
      }
      await tx.companyImportSource.update({
        where: { ...scope, id: source.id },
        data: {
          cursor: input.nextCursor === null ? Prisma.DbNull : jsonInput(input.nextCursor),
          status: input.done ? "reading" : "running",
        },
      });
    }),
  );
}

export async function reserveCompanyImportCall(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    sourceId: string;
    unitId: string;
    claimToken: string;
    recipientKey: string;
    disclosureVersion: string;
    callId: string;
    inputTokenBound: number;
    maxOutputTokens: number;
  },
) {
  const scope = scopeOf(actor);
  if (
    !Number.isSafeInteger(input.inputTokenBound) ||
    input.inputTokenBound <= 0 ||
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens <= 0 ||
    !Number.isSafeInteger(input.inputTokenBound + input.maxOutputTokens)
  ) {
    throw new CompanyImportError("invalid_state");
  }
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          tokenCap: bigint;
          reservedTokens: bigint;
          inputTokensUsed: bigint;
          outputTokensUsed: bigint;
        }>
      >`
        SELECT "id", "status", "tokenCap", "reservedTokens", "inputTokensUsed", "outputTokensUsed"
        FROM "company_import_runs" WHERE "id" = ${input.runId}
        AND "spaceId" = ${scope.spaceId} AND "ownerUserId" = ${scope.ownerUserId} FOR UPDATE
      `;
      const run = rows[0];
      if (!run) throw new CompanyImportError("not_found");
      if (!["running", "paused"].includes(run.status))
        throw new CompanyImportError("invalid_state");
      const unit = await tx.companyImportUnit.findFirst({
        where: {
          ...scope,
          id: input.unitId,
          runId: input.runId,
          sourceId: input.sourceId,
          status: "claimed",
          claimToken: input.claimToken,
          claimExpiresAt: { gt: new Date() },
        },
      });
      if (!unit) throw new CompanyImportError("stale_claim");
      const amount = BigInt(input.inputTokenBound) + BigInt(input.maxOutputTokens);
      const spent = run.reservedTokens + run.inputTokensUsed + run.outputTokensUsed;
      if (spent + amount > run.tokenCap) {
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: "budget_reached" },
        });
        return null;
      }
      const reservationId = randomUUID();
      await tx.companyImportCall.create({
        data: {
          ...scope,
          runId: input.runId,
          sourceId: input.sourceId,
          unitId: input.unitId,
          reservationId,
          claimToken: input.claimToken,
          reservedInput: BigInt(input.inputTokenBound),
          reservedOutput: BigInt(input.maxOutputTokens),
          recipientKey: input.recipientKey,
          disclosureVersion: input.disclosureVersion,
          callId: input.callId,
        },
      });
      await tx.companyImportRun.update({
        where: { ...scope, id: run.id },
        data: { reservedTokens: { increment: amount } },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: { tokensReserved: { increment: amount } },
      });
      await tx.companyImportUnit.update({
        where: { ...scope, id: input.unitId },
        data: { tokensReserved: { increment: amount } },
      });
      return {
        reservationId,
        reservedInput: input.inputTokenBound,
        reservedOutput: input.maxOutputTokens,
      };
    }),
  ).then((reservation) => {
    if (!reservation) throw new CompanyImportError("budget_reached");
    return reservation;
  });
}

export async function settleCompanyImportCall(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    reservationId: string;
    runId: string;
    sourceId: string;
    unitId: string;
    claimToken: string;
    provider: string;
    model: string;
    callId: string;
    usage: AgentUsage;
  },
) {
  const scope = scopeOf(actor);
  const { inputTokens, outputTokens } = input.usage;
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens === null ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens === null
  )
    return false;
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const call = await tx.companyImportCall.findFirst({
        where: {
          ...scope,
          reservationId: input.reservationId,
          runId: input.runId,
          sourceId: input.sourceId,
          unitId: input.unitId,
        },
      });
      if (call?.status !== "reserved" || call.claimToken !== input.claimToken) return false;
      const unit = await tx.companyImportUnit.findFirst({
        where: {
          ...scope,
          id: input.unitId,
          runId: input.runId,
          sourceId: input.sourceId,
          status: "claimed",
          claimToken: input.claimToken,
          claimExpiresAt: { gt: new Date() },
        },
      });
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId, status: { in: ["running", "paused"] } },
      });
      if (!unit || !run) return false;
      if (
        !Number.isSafeInteger(inputTokens + outputTokens) ||
        BigInt(inputTokens) > call.reservedInput ||
        BigInt(outputTokens) > call.reservedOutput
      )
        return false;
      const amount = call.reservedInput + call.reservedOutput;
      const actual = BigInt(inputTokens + outputTokens);
      await tx.companyImportCall.update({
        where: { ...scope, id: call.id },
        data: {
          status: "settled",
          actualInput: inputTokens,
          actualOutput: outputTokens,
          provider: input.provider,
          model: input.model,
          callId: input.callId,
          settledAt: new Date(),
        },
      });
      await tx.companyImportRun.update({
        where: { ...scope, id: run.id },
        data: {
          reservedTokens: { decrement: amount - actual },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: {
          tokensReserved: { decrement: amount - actual },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await tx.companyImportUnit.update({
        where: { ...scope, id: input.unitId },
        data: {
          tokensReserved: { decrement: amount - actual },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await recordUsage(
        tx,
        {
          type: "usage",
          provider: input.provider,
          model: input.model,
          callId: input.callId,
          operationKind: "company_import" satisfies UsageOperationKind,
          ...input.usage,
          inputTokens,
          outputTokens,
        },
        {
          spaceId: scope.spaceId,
          userId: scope.ownerUserId,
          operationId: run.id,
          operationKind: "company_import",
        },
      );
      return true;
    }),
  );
}

export async function completeCompanyImportUnit(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    sourceId: string;
    unitId: string;
    claimToken: string;
    nextCursor: unknown | null;
    done: boolean;
    itemsDiscovered: number;
    itemsRead: number;
    facts: ImportWrite[];
    discoveredUnits?: { unitKey: string; cursor: unknown }[];
    nextSourceCursor?: unknown | null;
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      await requireMember(tx, scope);
      const unit = await tx.companyImportUnit.findFirst({
        where: {
          ...scope,
          id: input.unitId,
          runId: input.runId,
          sourceId: input.sourceId,
          status: "claimed",
          claimToken: input.claimToken,
          claimExpiresAt: { gt: new Date() },
        },
      });
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId, status: { in: ["running", "paused"] } },
      });
      if (!unit || !run) throw new CompanyImportError("stale_claim");
      const writer = companyWriter(tx, actor);
      for (const fact of input.facts) {
        const evidence = { ...fact.input.evidence, extractorRunId: run.id };
        if (fact.kind === "entity") await writer.importEntity({ ...fact.input, evidence });
        else if (fact.kind === "edge") await writer.importEdge({ ...fact.input, evidence });
        else await writer.importEvent({ ...fact.input, evidence });
      }
      for (const discovered of input.discoveredUnits ?? []) {
        await tx.companyImportUnit.createMany({
          data: [
            {
              ...scope,
              runId: input.runId,
              sourceId: input.sourceId,
              unitKey: discovered.unitKey,
              ...(discovered.cursor === null ? {} : { cursor: jsonInput(discovered.cursor) }),
            },
          ],
          skipDuplicates: true,
        });
      }
      await tx.companyImportUnit.update({
        where: { ...scope, id: unit.id },
        data: {
          status: input.done ? "done" : "waiting",
          attempts: 0,
          claimToken: null,
          claimExpiresAt: null,
          completedAt: input.done ? new Date() : null,
          ...(input.nextCursor === null ? {} : { cursor: jsonInput(input.nextCursor) }),
          itemsDiscovered: { increment: input.itemsDiscovered },
          itemsRead: { increment: input.itemsRead },
          factsFound: { increment: input.facts.length },
        },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: {
          ...(input.nextSourceCursor === undefined
            ? {}
            : {
                cursor:
                  input.nextSourceCursor === null
                    ? Prisma.DbNull
                    : jsonInput(input.nextSourceCursor),
              }),
          ...(input.discoveredUnits ? { status: input.done ? "reading" : "running" } : {}),
        },
      });
      const pending = await tx.companyImportUnit.count({
        where: { ...scope, runId: input.runId, status: { in: ["waiting", "claimed"] } },
      });
      const failed = await tx.companyImportUnit.count({
        where: { ...scope, runId: input.runId, status: "failed" },
      });
      if (pending === 0) {
        await tx.companyImportRun.update({
          where: { ...scope, id: input.runId },
          data: { status: failed > 0 ? "partial" : "completed", completedAt: new Date() },
        });
      }
    }),
  );
}

export async function failCompanyImportUnit(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    sourceId: string;
    unitId: string;
    claimToken: string;
    errorCode: string;
    retryAfterMs?: number;
  },
) {
  const scope = scopeOf(actor);
  const errorCode = input.errorCode.slice(0, 80);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const unit = await tx.companyImportUnit.findFirst({
        where: {
          ...scope,
          id: input.unitId,
          runId: input.runId,
          sourceId: input.sourceId,
          status: "claimed",
          claimToken: input.claimToken,
        },
      });
      if (!unit) return false;
      const genericDelay = Math.min(60_000, 1_000 * 2 ** Math.max(0, unit.attempts - 1));
      const retryAfter =
        input.retryAfterMs && Number.isFinite(input.retryAfterMs)
          ? Math.max(0, input.retryAfterMs)
          : 0;
      const delay = Math.max(genericDelay, retryAfter);
      const failed = unit.attempts >= 3;
      await tx.companyImportUnit.update({
        where: { ...scope, id: unit.id },
        data: {
          status: failed ? "failed" : "waiting",
          claimToken: null,
          claimExpiresAt: null,
          availableAt: new Date(Date.now() + delay),
          lastError: errorCode,
        },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: {
          backoffUntil: failed ? null : new Date(Date.now() + delay),
          lastError: errorCode,
        },
      });
      return true;
    }),
  );
}

export async function awaitCompanyImportConsent(
  prisma: PrismaClient,
  actor: Actor,
  input: { runId: string; sourceId: string; unitId: string; claimToken: string },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return prisma.$transaction(async (tx) => {
    const unit = await tx.companyImportUnit.findFirst({
      where: {
        ...scope,
        id: input.unitId,
        runId: input.runId,
        sourceId: input.sourceId,
        status: "claimed",
        claimToken: input.claimToken,
      },
      select: { id: true },
    });
    if (!unit) return false;
    await tx.companyImportRun.updateMany({
      where: { ...scope, id: input.runId, status: { in: ["running", "paused"] } },
      data: { status: "awaiting_consent" },
    });
    await tx.companyImportSource.update({
      where: { ...scope, id: input.sourceId },
      data: { status: "awaiting_consent" },
    });
    await tx.companyImportUnit.update({
      where: { ...scope, id: input.unitId },
      data: { status: "waiting", claimToken: null, claimExpiresAt: null },
    });
    return true;
  });
}

export async function reconcileCompanyImportRunIds(prisma: PrismaClient, limit = 100) {
  const runs = await prisma.companyImportRun.findMany({
    where: { status: { in: ["running", "paused"] } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true, spaceId: true, ownerUserId: true },
  });
  return runs.map((run) => ({ runId: run.id, spaceId: run.spaceId, userId: run.ownerUserId }));
}

export async function listCompanyImportUnitsForScheduling(
  prisma: PrismaClient,
  actor: Actor,
  runId: string,
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return prisma.companyImportUnit.findMany({
    where: { ...scope, runId, status: { in: ["waiting", "claimed"] } },
    select: { id: true, sourceId: true, status: true, availableAt: true, claimExpiresAt: true },
  });
}

export async function getCompanyImportRunForScheduling(
  prisma: PrismaClient,
  actor: Actor,
  runId: string,
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return prisma.companyImportRun.findFirst({
    where: { ...scope, id: runId },
    select: { id: true, status: true },
  });
}
