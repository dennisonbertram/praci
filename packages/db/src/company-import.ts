import { createHash, randomUUID } from "node:crypto";
import type { AgentUsage, CompanyImportReadPage, UsageOperationKind } from "@rakazo/adapter-kit";
import type {
  Actor,
  CompanyEdgeImportInput,
  CompanyEntityImportInput,
  CompanyEventImportInput,
  CompanyImportCreateInput,
  CompanyImportProgress,
  CompanyImportSourceInput,
} from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  COMPANY_IMPORT_CURSOR_MAX_BYTES,
  CompanySourceKindSchema,
} from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { companyWriter } from "./company.js";
import { persistCompanyExtraction } from "./company-import-extraction.js";
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

async function lockRun(tx: Prisma.TransactionClient, scope: Scope, runId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT "id", "status" FROM "company_import_runs"
    WHERE "id" = ${runId} AND "spaceId" = ${scope.spaceId} AND "ownerUserId" = ${scope.ownerUserId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function finalizeCompanyImportRun(tx: Prisma.TransactionClient, scope: Scope, runId: string) {
  const run = await tx.companyImportRun.findFirst({
    where: { ...scope, id: runId },
    select: { mode: true },
  });
  if (!run) return;
  const pending = await tx.companyImportUnit.count({
    where: { ...scope, runId, status: { in: ["waiting", "claimed"] } },
  });
  if (pending > 0) return;
  const failed = await tx.companyImportUnit.count({
    where: { ...scope, runId, status: "failed" },
  });
  const done = await tx.companyImportUnit.count({
    where: { ...scope, runId, status: "done" },
  });
  const sources = await tx.companyImportSource.findMany({
    where: { ...scope, runId },
    select: { id: true },
  });
  for (const source of sources) {
    const sourceFailed = await tx.companyImportUnit.count({
      where: { ...scope, runId, sourceId: source.id, status: "failed" },
    });
    const sourceDone = await tx.companyImportUnit.count({
      where: { ...scope, runId, sourceId: source.id, status: "done" },
    });
    await tx.companyImportSource.update({
      where: { ...scope, id: source.id },
      data: {
        status: sourceFailed > 0 ? "failed" : sourceDone > 0 ? "completed" : "failed",
        ...(sourceFailed === 0 ? { lastError: null } : {}),
      },
    });
  }
  await tx.companyImportRun.updateMany({
    where: { ...scope, id: runId, status: { in: ["running", "paused", "budget_reached"] } },
    data: {
      status:
        failed > 0 && done > 0
          ? "partial"
          : failed > 0
            ? "failed"
            : run.mode === "sample"
              ? "preview_ready"
              : "completed",
      completedAt: new Date(),
    },
  });
}

function importSourceKey(source: CompanyImportSourceInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        source.sourceKind,
        source.connectionId ?? null,
        source.mcpServerId ?? null,
        source.scope,
      ]),
    )
    .digest("hex");
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function assertBoundedJson(value: unknown, maxBytes = 16_384) {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new CompanyImportError("invalid_state");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized) > maxBytes) {
    throw new CompanyImportError("invalid_state");
  }
}

function isCompanySampleResumeCursor(
  value: unknown,
): value is { companySampleResume: true; cursor: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return (
    Object.keys(cursor).length === 2 &&
    cursor.companySampleResume === true &&
    Object.hasOwn(cursor, "cursor") &&
    cursor.cursor !== null
  );
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
  const sourceKeys = new Set<string>();
  for (const source of input.sources) {
    if (
      (source.sourceKind === "mcp" && (!source.mcpServerId || source.connectionId)) ||
      (source.sourceKind !== "mcp" && source.mcpServerId) ||
      (source.sourceKind !== "mcp" && source.sourceKind !== "data_room" && !source.connectionId)
    ) {
      throw new CompanyImportError("invalid_state");
    }
    assertBoundedJson(source.scope);
    const key = importSourceKey(source);
    if (sourceKeys.has(key)) throw new CompanyImportError("invalid_state");
    sourceKeys.add(key);
  }
  await requireMember(prisma, scope);
  for (const source of input.sources) {
    if (source.mcpServerId) {
      const server = await prisma.mcpServer.findFirst({
        where: {
          id: source.mcpServerId,
          spaceId: scope.spaceId,
          userId: scope.ownerUserId,
          enabled: true,
        },
        select: { id: true },
      });
      if (!server) throw new CompanyImportError("not_found");
      continue;
    }
    if (!source.connectionId) continue;
    const connection = await prisma.connection.findFirst({
      where: {
        id: source.connectionId,
        spaceId: scope.spaceId,
        userId: scope.ownerUserId,
        status: "connected",
      },
      select: { id: true },
    });
    if (!connection) throw new CompanyImportError("not_found");
  }
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      await requireMember(tx, scope);
      const run = await tx.companyImportRun.create({
        data: {
          ...scope,
          status: "draft",
          mode: input.mode ?? "full",
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
            mcpServerId: sourceInput.mcpServerId ?? null,
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
    await lockCompanyScope(tx, scope);
    const locked = await lockRun(tx, scope, runId);
    if (!locked) throw new CompanyImportError("not_found");
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
    select: {
      sourceId: true,
      status: true,
      itemsDiscovered: true,
      itemsRead: true,
      factsFound: true,
      tokensReserved: true,
      inputTokensUsed: true,
      outputTokensUsed: true,
      lastError: true,
    },
  });
  const counts: Record<string, number> = {};
  for (const unit of units) counts[unit.status] = (counts[unit.status] ?? 0) + 1;
  const sources = run.sources.map((source) => ({
    id: source.id,
    sourceKind: source.sourceKind as CompanyImportProgress["sources"][number]["sourceKind"],
    status: source.status,
    units: units.filter((unit) => unit.sourceId === source.id).length,
    itemsDiscovered: units
      .filter((unit) => unit.sourceId === source.id)
      .reduce((n, u) => n + u.itemsDiscovered, 0),
    itemsRead: units
      .filter((unit) => unit.sourceId === source.id)
      .reduce((n, u) => n + u.itemsRead, 0),
    factsFound: units
      .filter((unit) => unit.sourceId === source.id)
      .reduce((n, u) => n + u.factsFound, 0),
    reservedTokens: Number(
      units
        .filter((unit) => unit.sourceId === source.id)
        .reduce((n, u) => n + u.tokensReserved, 0n),
    ),
    inputTokensUsed: Number(
      units
        .filter((unit) => unit.sourceId === source.id)
        .reduce((n, u) => n + u.inputTokensUsed, 0n),
    ),
    outputTokensUsed: Number(
      units
        .filter((unit) => unit.sourceId === source.id)
        .reduce((n, u) => n + u.outputTokensUsed, 0n),
    ),
    lastError:
      units.find((unit) => unit.sourceId === source.id && unit.lastError)?.lastError ?? null,
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
    action: "pause" | "resume" | "continue" | "retry_failed" | "cancel" | "discard";
    tokenCap?: number;
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const locked = await lockRun(tx, scope, input.runId);
      if (!locked) throw new CompanyImportError("not_found");
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId },
        select: { id: true, status: true, mode: true, tokenCap: true },
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
        if (!["paused", "budget_reached"].includes(run.status)) {
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
      } else if (input.action === "continue") {
        if (run.status !== "preview_ready" || run.mode !== "sample") {
          throw new CompanyImportError("invalid_state");
        }
        const sources = await tx.companyImportSource.findMany({
          where: { ...scope, runId: run.id },
          select: { id: true, cursor: true },
        });
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { mode: "full", status: "running", completedAt: null },
        });
        for (const source of sources) {
          const resumeData = {
            status: "waiting" as const,
            attempts: 0,
            claimToken: null,
            claimExpiresAt: null,
            availableAt: now,
            lastError: null,
            completedAt: null,
          };
          let resumed = false;
          if (source.cursor !== null) {
            const discovery = await tx.companyImportUnit.updateMany({
              where: {
                ...scope,
                runId: run.id,
                sourceId: source.id,
                unitKey: "discover:0",
                status: "done",
              },
              data: resumeData,
            });
            resumed = discovery.count > 0;
          }
          const doneReads = await tx.companyImportUnit.findMany({
            where: {
              ...scope,
              runId: run.id,
              sourceId: source.id,
              status: "done",
            },
            select: { id: true, unitKey: true, cursor: true },
          });
          const resumeIds = doneReads
            .filter(
              (unit) =>
                !unit.unitKey.startsWith("discover:") && isCompanySampleResumeCursor(unit.cursor),
            )
            .map((unit) => unit.id);
          if (resumeIds.length) {
            await tx.companyImportUnit.updateMany({
              where: {
                ...scope,
                runId: run.id,
                sourceId: source.id,
                id: { in: resumeIds },
                status: "done",
              },
              data: resumeData,
            });
            resumed = true;
          }
          if (resumed) {
            await tx.companyImportSource.update({
              where: { ...scope, id: source.id },
              data: { status: "running", lastError: null },
            });
          }
        }
        await finalizeCompanyImportRun(tx, scope, run.id);
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
        await tx.companyImportSource.updateMany({
          where: { ...scope, runId: run.id, status: "failed" },
          data: { status: "running", lastError: null },
        });
      } else {
        if (
          input.action === "cancel" &&
          ["cancelled", "discarded", "completed", "partial", "failed"].includes(run.status)
        ) {
          throw new CompanyImportError("invalid_state");
        }
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: input.action === "cancel" ? "cancelled" : "discarded", completedAt: now },
        });
        await tx.companyImportUnit.updateMany({
          where: { ...scope, runId: run.id, status: { not: "done" } },
          data: { status: "cancelled", claimToken: null, claimExpiresAt: null },
        });
        await tx.companyImportSource.updateMany({
          where: { ...scope, runId: run.id },
          data: { status: input.action === "cancel" ? "cancelled" : "discarded" },
        });
        if (input.action === "discard") {
          const affectedEvidence = await tx.companyEvidence.findMany({
            where: {
              ...scope,
              OR: [{ extractorRunId: run.id }, { importObservations: { some: { runId: run.id } } }],
            },
            select: { id: true, extractorRunId: true },
          });
          await tx.companyImportEvidence.deleteMany({ where: { ...scope, runId: run.id } });
          if (affectedEvidence.length > 0) {
            const evidenceIds = affectedEvidence.map((evidence) => evidence.id);
            const survivingObservations = await tx.companyImportEvidence.findMany({
              where: { ...scope, evidenceId: { in: evidenceIds } },
              select: { evidenceId: true },
            });
            const observedEvidenceIds = new Set(
              survivingObservations.map((observation) => observation.evidenceId),
            );
            const originRunIds = [
              ...new Set(
                affectedEvidence.flatMap((evidence) =>
                  evidence.extractorRunId ? [evidence.extractorRunId] : [],
                ),
              ),
            ];
            const discardedOrigins = await tx.companyImportRun.findMany({
              where: { ...scope, id: { in: originRunIds }, status: "discarded" },
              select: { id: true },
            });
            const discardedOriginIds = new Set(discardedOrigins.map((origin) => origin.id));
            const deletableEvidenceIds = affectedEvidence
              .filter(
                (evidence) =>
                  evidence.extractorRunId &&
                  discardedOriginIds.has(evidence.extractorRunId) &&
                  !observedEvidenceIds.has(evidence.id),
              )
              .map((evidence) => evidence.id);
            if (deletableEvidenceIds.length > 0) {
              await tx.companyEvidence.deleteMany({
                where: { ...scope, id: { in: deletableEvidenceIds } },
              });
            }
          }
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
      await lockCompanyScope(tx, scope);
      const run = await lockRun(tx, scope, input.runId);
      if (!run) throw new CompanyImportError("not_found");
      if (run.status !== "running") return null;
      const unit = await tx.companyImportUnit.findFirst({
        where: { ...scope, id: input.unitId, runId: input.runId },
        include: { source: true },
      });
      if (!unit) throw new CompanyImportError("not_found");
      if (
        unit.source.runId !== input.runId ||
        unit.source.spaceId !== scope.spaceId ||
        unit.source.ownerUserId !== scope.ownerUserId
      )
        throw new CompanyImportError("not_found");
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
      if (expired.count > 0) await finalizeCompanyImportRun(tx, scope, input.runId);
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
      await finalizeCompanyImportRun(tx, scope, input.runId);
      return { ...fresh, claimToken, claimExpiresAt, source: unit.source };
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
      await lockCompanyScope(tx, scope);
      const locked = await lockRun(tx, scope, input.runId);
      const run = locked
        ? await tx.companyImportRun.findFirst({
            where: { ...scope, id: input.runId },
            select: {
              id: true,
              status: true,
              tokenCap: true,
              reservedTokens: true,
              inputTokensUsed: true,
              outputTokensUsed: true,
            },
          })
        : null;
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
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
        select: { id: true },
      });
      if (!unit || !source) throw new CompanyImportError("stale_claim");
      const amount = BigInt(input.inputTokenBound) + BigInt(input.maxOutputTokens);
      const spent = run.reservedTokens + run.inputTokensUsed + run.outputTokensUsed;
      if (spent + amount > run.tokenCap) {
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: "budget_reached" },
        });
        await tx.companyImportUnit.updateMany({
          where: {
            ...scope,
            id: input.unitId,
            runId: input.runId,
            sourceId: input.sourceId,
            status: "claimed",
            claimToken: input.claimToken,
          },
          data: {
            status: "waiting",
            claimToken: null,
            claimExpiresAt: null,
            availableAt: new Date(),
          },
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
    inputTokens === null ||
    outputTokens === null ||
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  )
    return false;
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const lockedRun = await lockRun(tx, scope, input.runId);
      if (!lockedRun) throw new CompanyImportError("not_found");
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
      const claimed = await tx.companyImportCall.updateMany({
        where: { ...scope, id: call.id, status: "reserved", claimToken: input.claimToken },
        data: { status: "settling" },
      });
      if (claimed.count !== 1) return false;
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId },
      });
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
      });
      const unit = await tx.companyImportUnit.findFirst({
        where: { ...scope, id: input.unitId, runId: input.runId, sourceId: input.sourceId },
      });
      if (!run || !source || !unit || !Number.isSafeInteger(inputTokens + outputTokens))
        return false;
      const amount = call.reservedInput + call.reservedOutput;
      const overBound =
        BigInt(inputTokens) > call.reservedInput || BigInt(outputTokens) > call.reservedOutput;
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
          reservedTokens: { decrement: amount },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: {
          tokensReserved: { decrement: amount },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await tx.companyImportUnit.update({
        where: { ...scope, id: input.unitId },
        data: {
          tokensReserved: { decrement: amount },
          inputTokensUsed: { increment: BigInt(inputTokens) },
          outputTokensUsed: { increment: BigInt(outputTokens) },
        },
      });
      await recordUsage(
        tx,
        {
          ...input.usage,
          type: "usage",
          callId: input.reservationId,
          provider: input.provider,
          model: input.model,
          operationKind: "company_import" satisfies UsageOperationKind,
          inputTokens,
          outputTokens,
        },
        {
          spaceId: scope.spaceId,
          userId: scope.ownerUserId,
          operationId: `${run.id}:${source.id}:${unit.id}:${input.reservationId}`,
          operationKind: "company_import",
        },
      );
      if (
        overBound &&
        ["running", "paused", "budget_reached", "awaiting_consent"].includes(run.status)
      ) {
        await tx.companyImportRun.update({
          where: { ...scope, id: run.id },
          data: { status: "budget_reached" },
        });
      }
      return !overBound;
    }),
  );
}

export async function releaseCompanyImportCall(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    reservationId: string;
    runId: string;
    sourceId: string;
    unitId: string;
    claimToken: string;
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const lockedRun = await lockRun(tx, scope, input.runId);
      if (!lockedRun) return false;
      const [source, unit] = await Promise.all([
        tx.companyImportSource.findFirst({
          where: { ...scope, id: input.sourceId, runId: input.runId },
          select: { id: true },
        }),
        tx.companyImportUnit.findFirst({
          where: {
            ...scope,
            id: input.unitId,
            runId: input.runId,
            sourceId: input.sourceId,
          },
          select: { id: true },
        }),
      ]);
      if (!source || !unit) return false;
      const call = await tx.companyImportCall.findFirst({
        where: {
          ...scope,
          reservationId: input.reservationId,
          runId: input.runId,
          sourceId: input.sourceId,
          unitId: input.unitId,
          claimToken: input.claimToken,
          status: "reserved",
        },
        select: { id: true, reservedInput: true, reservedOutput: true },
      });
      if (!call) return false;
      const released = await tx.companyImportCall.updateMany({
        where: {
          ...scope,
          id: call.id,
          reservationId: input.reservationId,
          runId: input.runId,
          sourceId: input.sourceId,
          unitId: input.unitId,
          claimToken: input.claimToken,
          status: "reserved",
        },
        data: { status: "released", settledAt: new Date() },
      });
      if (released.count !== 1) return false;
      const amount = call.reservedInput + call.reservedOutput;
      await tx.companyImportRun.update({
        where: { ...scope, id: input.runId },
        data: { reservedTokens: { decrement: amount } },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: { tokensReserved: { decrement: amount } },
      });
      await tx.companyImportUnit.update({
        where: { ...scope, id: input.unitId },
        data: { tokensReserved: { decrement: amount } },
      });
      return true;
    }),
  );
}

export async function grantCompanyImportConsent(
  prisma: PrismaClient,
  actor: Actor,
  input: {
    runId: string;
    sourceId: string;
    recipientKey: string;
    version: string;
    requiredKeys: string[];
  },
) {
  const scope = scopeOf(actor);
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const lockedRun = await lockRun(tx, scope, input.runId);
      const run = await tx.companyImportRun.findFirst({
        where: { ...scope, id: input.runId },
        select: { status: true },
      });
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
        select: { id: true },
      });
      if (!lockedRun || !run || !source) throw new CompanyImportError("not_found");
      if (["cancelled", "discarded", "completed", "partial", "failed"].includes(run.status))
        throw new CompanyImportError("invalid_state");
      await tx.aiDataConsent.upsert({
        where: {
          userId_spaceId_recipientKey: {
            userId: scope.ownerUserId,
            spaceId: scope.spaceId,
            recipientKey: input.recipientKey,
          },
        },
        create: {
          userId: scope.ownerUserId,
          spaceId: scope.spaceId,
          recipientKey: input.recipientKey,
          version: input.version,
        },
        update: { version: input.version, grantedAt: new Date() },
      });
      const grant = await tx.companyImportRun.updateMany({
        where: { ...scope, id: input.runId, status: run.status },
        data: { disclosureVersion: input.version },
      });
      if (grant.count !== 1) throw new CompanyImportError("invalid_state");
      let resumed = false;
      if (run.status === "awaiting_consent") {
        const grants = await tx.aiDataConsent.findMany({
          where: {
            userId: scope.ownerUserId,
            spaceId: scope.spaceId,
            recipientKey: { in: input.requiredKeys },
            version: input.version,
          },
          select: { recipientKey: true },
        });
        resumed =
          new Set(grants.map((grant) => grant.recipientKey)).size === input.requiredKeys.length;
        if (resumed) {
          await tx.companyImportRun.update({
            where: { ...scope, id: input.runId },
            data: { status: "running" },
          });
          await tx.companyImportSource.updateMany({
            where: { ...scope, runId: input.runId },
            data: { status: "running" },
          });
        }
      }
      return { allowed: true, resumed };
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
    extractions?: CompanyImportReadPage["extractions"];
    reusedEvidenceIds?: string[];
    readItems?: { sourceItemId: string; contentHash: string }[];
    discoveredUnits?: { unitKey: string; cursor: unknown }[];
    nextSourceCursor?: unknown | null;
    cooldownMs?: number;
  },
) {
  const scope = scopeOf(actor);
  assertBoundedJson(input.nextCursor, COMPANY_IMPORT_CURSOR_MAX_BYTES);
  if (input.nextSourceCursor !== undefined)
    assertBoundedJson(input.nextSourceCursor, COMPANY_IMPORT_CURSOR_MAX_BYTES);
  for (const discovered of input.discoveredUnits ?? []) {
    if (
      !discovered.unitKey ||
      discovered.unitKey.length > 200 ||
      discovered.unitKey.startsWith("discover:")
    )
      throw new CompanyImportError("invalid_state");
    assertBoundedJson(discovered.cursor, COMPANY_IMPORT_CURSOR_MAX_BYTES);
  }
  if (
    !Number.isSafeInteger(input.itemsDiscovered) ||
    input.itemsDiscovered < 0 ||
    !Number.isSafeInteger(input.itemsRead) ||
    input.itemsRead < 0
  ) {
    throw new CompanyImportError("invalid_state");
  }
  if (
    input.cooldownMs !== undefined &&
    (!Number.isSafeInteger(input.cooldownMs) ||
      input.cooldownMs < 0 ||
      input.cooldownMs > 86_400_000)
  ) {
    throw new CompanyImportError("invalid_state");
  }
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const locked = await lockRun(tx, scope, input.runId);
      if (!locked) throw new CompanyImportError("not_found");
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
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
        select: { id: true, sourceKind: true, connectionId: true, mcpServerId: true },
      });
      if (!unit || !run || !source) throw new CompanyImportError("stale_claim");
      if (run.mode === "sample") {
        const priorItems = await tx.companyImportEvidence.findMany({
          where: {
            ...scope,
            runId: run.id,
            evidence: {
              sourceKind: source.sourceKind,
              connectionId: source.connectionId,
              mcpServerId: source.mcpServerId,
            },
          },
          select: { evidence: { select: { sourceItemId: true } } },
        });
        const distinctItems = new Set([
          ...priorItems.map(({ evidence }) => evidence.sourceItemId),
          ...(input.readItems ?? []).map((item) => item.sourceItemId),
        ]);
        if (distinctItems.size > 25) throw new CompanyImportError("invalid_state");
      }
      const writer = companyWriter(tx, actor);
      let persistedFacts = 0;
      for (const fact of input.facts) {
        const evidence = { ...fact.input.evidence, extractorRunId: run.id };
        const result =
          fact.kind === "entity"
            ? await writer.importEntity({ ...fact.input, evidence })
            : fact.kind === "edge"
              ? await writer.importEdge({ ...fact.input, evidence })
              : await writer.importEvent({ ...fact.input, evidence });
        if (!("suppressed" in result) && !("deferred" in result)) persistedFacts++;
      }
      for (const extraction of input.extractions ?? []) {
        if (
          !input.readItems?.some(
            (item) =>
              item.sourceItemId === extraction.sourceItemId &&
              item.contentHash === extraction.contentHash,
          )
        )
          throw new CompanyImportError("invalid_state");
        persistedFacts += await persistCompanyExtraction(tx, actor, extraction, {
          sourceKind: CompanySourceKindSchema.parse(source.sourceKind),
          connectionId: source.connectionId,
          mcpServerId: source.mcpServerId,
          runId: run.id,
        });
      }
      if (input.reusedEvidenceIds?.length) {
        const ids = [...new Set(input.reusedEvidenceIds)];
        const prior = await tx.companyEvidence.findMany({
          where: {
            ...scope,
            id: { in: ids },
            sourceKind: source.sourceKind,
            connectionId: source.connectionId,
            mcpServerId: source.mcpServerId,
            OR: input.readItems ?? [],
          },
          select: { id: true },
        });
        if (prior.length !== ids.length) throw new CompanyImportError("invalid_state");
        await tx.companyImportEvidence.createMany({
          data: prior.map((evidence) => ({ ...scope, runId: run.id, evidenceId: evidence.id })),
          skipDuplicates: true,
        });
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
          lastError: null,
          ...(input.nextCursor === null ? {} : { cursor: jsonInput(input.nextCursor) }),
          itemsDiscovered: { increment: input.itemsDiscovered },
          itemsRead: { increment: input.itemsRead },
          factsFound: { increment: persistedFacts },
        },
      });
      if (input.cooldownMs !== undefined) {
        const until = new Date(Date.now() + input.cooldownMs);
        await tx.companyImportSource.update({
          where: { ...scope, id: input.sourceId },
          data: { backoffUntil: until },
        });
        await tx.companyImportUnit.update({
          where: { ...scope, id: unit.id },
          data: { availableAt: until },
        });
      }
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
      await finalizeCompanyImportRun(tx, scope, input.runId);
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
  const errorCode = /^[a-z0-9_-]{1,80}$/.test(input.errorCode) ? input.errorCode : "worker_failed";
  await requireMember(prisma, scope);
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockCompanyScope(tx, scope);
      const locked = await lockRun(tx, scope, input.runId);
      if (!locked) throw new CompanyImportError("not_found");
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
      const source = await tx.companyImportSource.findFirst({
        where: { ...scope, id: input.sourceId, runId: input.runId },
        select: { id: true },
      });
      if (!unit || !source) return false;
      const genericDelay = Math.min(60_000, 1_000 * 2 ** Math.max(0, unit.attempts - 1));
      const retryAfter =
        input.retryAfterMs && Number.isFinite(input.retryAfterMs)
          ? Math.max(0, input.retryAfterMs)
          : 0;
      const delay = Math.max(genericDelay, retryAfter);
      const failed = unit.attempts >= 3;
      const retryAt = new Date(Date.now() + delay);
      await tx.companyImportUnit.update({
        where: { ...scope, id: unit.id },
        data: {
          status: failed ? "failed" : "waiting",
          claimToken: null,
          claimExpiresAt: null,
          availableAt: retryAt,
          lastError: errorCode,
        },
      });
      await tx.companyImportSource.update({
        where: { ...scope, id: input.sourceId },
        data: {
          backoffUntil: failed ? null : retryAt,
          lastError: errorCode,
        },
      });
      await finalizeCompanyImportRun(tx, scope, input.runId);
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
    await lockCompanyScope(tx, scope);
    const run = await lockRun(tx, scope, input.runId);
    if (!run) return false;
    if (!["running", "paused"].includes(run.status)) return false;
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
      select: { id: true },
    });
    const source = await tx.companyImportSource.findFirst({
      where: { ...scope, id: input.sourceId, runId: input.runId },
      select: { id: true },
    });
    if (!unit || !source) return false;
    await tx.companyImportRun.updateMany({
      where: { ...scope, id: input.runId, status: { in: ["running", "paused"] } },
      data: { status: "awaiting_consent" },
    });
    await tx.companyImportSource.updateMany({
      where: { ...scope, id: input.sourceId, runId: input.runId },
      data: { status: "awaiting_consent" },
    });
    await tx.companyImportUnit.updateMany({
      where: { ...scope, id: input.unitId, status: "claimed", claimToken: input.claimToken },
      data: { status: "waiting", claimToken: null, claimExpiresAt: null },
    });
    return true;
  });
}

export async function reconcileCompanyImportRunIds(prisma: PrismaClient) {
  const runs = await prisma.companyImportRun.findMany({
    where: { status: { in: ["running", "paused"] } },
    orderBy: { updatedAt: "asc" },
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
    select: {
      id: true,
      sourceId: true,
      status: true,
      availableAt: true,
      claimExpiresAt: true,
      source: { select: { backoffUntil: true } },
    },
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
    select: { id: true, status: true, mode: true },
  });
}
