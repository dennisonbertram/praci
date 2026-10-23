import { createHash, randomUUID } from "node:crypto";
import type {
  AgentRunModel,
  BackgroundJobPayloads,
  CompanyImportReadPage,
  CompanyImportWorker,
  CompanyImportWorkerContext,
  JobPublisher,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import type {
  Actor,
  CompanyImportCreateInput,
  CompanyImportEvent,
  CompanyImportGrantConsentInput,
  CompanyImportProgress,
} from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  COMPANY_IMPORT_CURSOR_MAX_BYTES,
  CompanyEdgeImportInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEventImportInputSchema,
  CompanyImportEventSchema,
  companyImporterSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  awaitCompanyImportConsent,
  CompanyImportError,
  claimCompanyImportUnit,
  completeCompanyImportUnit,
  createCompanyImportRun,
  failCompanyImportUnit,
  followRealtimeTopic,
  getCompanyImportProgress,
  getCompanyImportRunForScheduling,
  grantCompanyImportConsent,
  listCompanyImportUnitsForScheduling,
  reconcileCompanyImportRunIds,
  releaseCompanyImportCall,
  reserveCompanyImportCall,
  settleCompanyImportCall,
  startCompanyImportRun,
  updateCompanyImportRun,
} from "@rakazo/db";
import { aiRecipient } from "./ai-consent.js";
import { validateCompanyExtraction } from "./company-extraction-safety.js";
import { companySourceScope } from "./company-import-sources.js";

const MAX_DISCOVERY_UNITS = 100;
const MAX_SAMPLE_DISCOVERY_UNITS = 25;
const MAX_READ_BYTES = 500_000;
const MAX_READ_ITEMS = 100;
const MAX_SAMPLE_READ_ITEMS = 1;
const UNIT_LEASE_MS = 120_000;
const RUN_TOPIC = (spaceId: string, userId: string) => `company-import:${spaceId}:${userId}`;

export class CompanyImportWorkerError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}

class CompanyImportConsentRequired extends Error {}

type Model = AgentRunModel;

export interface CompanyImportEngineDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  realtime: RealtimeFanout;
  resolveModel?: (scope: Pick<Actor, "spaceId" | "userId">) => Promise<AgentRunModel>;
  worker?: CompanyImportWorker;
}

function workerActor(payload: { spaceId: string; userId: string }): Actor {
  return {
    ...payload,
    email: "",
    isDeploymentOwner: false,
  };
}

function recipientFor(model: Model | null) {
  if (!model) return null;
  return aiRecipient({
    provider: model.provider,
    modelId: model.id,
    baseUrl: model.baseUrl,
    use: "model",
  });
}

function boundConsentKey(
  source: {
    sourceKind: string;
    connectionId: string | null;
    mcpServerId?: string | null;
    scope: unknown;
  },
  recipientKey: string,
  model: Pick<Model, "provider" | "id">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        source.sourceKind,
        source.connectionId,
        source.mcpServerId ?? null,
        source.scope,
        recipientKey,
        model.provider,
        model.id,
      ]),
    )
    .digest("hex");
}

function isBoundedCursor(value: unknown) {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" && Buffer.byteLength(json) <= COMPANY_IMPORT_CURSOR_MAX_BYTES;
  } catch {
    return false;
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

function assertSafePage(
  page: unknown,
  maxUnits = MAX_DISCOVERY_UNITS,
): asserts page is {
  units: { unitKey: string; cursor: unknown }[];
  nextCursor: unknown | null;
  done: boolean;
} {
  if (!page || typeof page !== "object")
    throw new CompanyImportWorkerError("invalid_discovery_page");
  const candidate = page as { units?: unknown; nextCursor?: unknown; done?: unknown };
  if (
    !Array.isArray(candidate.units) ||
    candidate.units.length > maxUnits ||
    typeof candidate.done !== "boolean"
  ) {
    throw new CompanyImportWorkerError("invalid_discovery_page");
  }
  const seen = new Set<string>();
  if (!isBoundedCursor(candidate.nextCursor))
    throw new CompanyImportWorkerError("cursor_too_large");
  for (const unit of candidate.units) {
    if (
      !unit ||
      typeof unit !== "object" ||
      typeof (unit as { unitKey?: unknown }).unitKey !== "string" ||
      !(unit as { unitKey: string }).unitKey.length ||
      (unit as { unitKey: string }).unitKey.length > 200
    ) {
      throw new CompanyImportWorkerError("invalid_discovery_unit");
    }
    const key = (unit as { unitKey: string }).unitKey;
    if (key.startsWith("discover:")) throw new CompanyImportWorkerError("reserved_discovery_unit");
    if (!isBoundedCursor((unit as { cursor?: unknown }).cursor)) {
      throw new CompanyImportWorkerError("cursor_too_large");
    }
    if (seen.has(key)) throw new CompanyImportWorkerError("duplicate_discovery_unit");
    seen.add(key);
  }
}

function assertSafeReadPage(
  page: unknown,
  maxItems = MAX_READ_ITEMS,
): asserts page is CompanyImportReadPage {
  if (!page || typeof page !== "object") throw new CompanyImportWorkerError("invalid_read_page");
  const candidate = page as {
    items?: unknown;
    facts?: unknown;
    extractions?: unknown;
    nextCursor?: unknown;
    done?: unknown;
  };
  if (
    !Array.isArray(candidate.items) ||
    candidate.items.length > maxItems ||
    !Array.isArray(candidate.facts) ||
    candidate.facts.length > MAX_READ_ITEMS ||
    (candidate.extractions !== undefined &&
      (!Array.isArray(candidate.extractions) || candidate.extractions.length > MAX_READ_ITEMS)) ||
    typeof candidate.done !== "boolean"
  ) {
    throw new CompanyImportWorkerError("invalid_read_page");
  }
  if (!Object.hasOwn(candidate, "nextCursor") || candidate.nextCursor === undefined)
    throw new CompanyImportWorkerError("invalid_read_page");
  if (!isBoundedCursor(candidate.nextCursor))
    throw new CompanyImportWorkerError("cursor_too_large");
  let bytes = 0;
  for (const item of candidate.items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { sourceItemId?: unknown }).sourceItemId !== "string" ||
      typeof (item as { contentHash?: unknown }).contentHash !== "string" ||
      typeof (item as { content?: unknown }).content !== "string"
    ) {
      throw new CompanyImportWorkerError("invalid_read_item");
    }
    bytes += Buffer.byteLength((item as { content: string }).content);
    if (bytes > MAX_READ_BYTES) throw new CompanyImportWorkerError("read_page_too_large");
  }
  for (const fact of candidate.facts) {
    if (!fact || typeof fact !== "object" || !("kind" in fact) || !("input" in fact)) {
      throw new CompanyImportWorkerError("invalid_fact");
    }
    const input = (fact as { input: unknown }).input;
    const parsed =
      (fact as { kind: unknown }).kind === "entity"
        ? CompanyEntityImportInputSchema.safeParse(input)
        : (fact as { kind: unknown }).kind === "edge"
          ? CompanyEdgeImportInputSchema.safeParse(input)
          : (fact as { kind: unknown }).kind === "event"
            ? CompanyEventImportInputSchema.safeParse(input)
            : null;
    if (!parsed?.success) throw new CompanyImportWorkerError("invalid_fact");
  }
}

function assertFactProvenance(
  page: CompanyImportReadPage,
  sourceKind: string,
  connectionId: string | null,
  mcpServerId?: string | null,
) {
  if (
    page.extractions !== undefined &&
    (!Array.isArray(page.extractions) || page.extractions.length > MAX_READ_ITEMS)
  )
    throw new CompanyImportWorkerError("invalid_extractions");
  if (
    page.reusedEvidenceIds !== undefined &&
    (!Array.isArray(page.reusedEvidenceIds) ||
      page.reusedEvidenceIds.length > 10_000 ||
      page.reusedEvidenceIds.some((id) => typeof id !== "string"))
  )
    throw new CompanyImportWorkerError("invalid_reused_evidence");
  let count = page.facts.length;
  for (const extraction of page.extractions ?? []) {
    const item = page.items.find((candidate) => candidate.sourceItemId === extraction.sourceItemId);
    if (
      !item ||
      item.contentHash !== extraction.contentHash ||
      createHash("sha256").update(item.content).digest("hex") !== item.contentHash
    )
      throw new CompanyImportWorkerError("invalid_fact_provenance");
    extraction.extraction = validateCompanyExtraction(extraction.extraction, {
      title: "",
      text: item.content,
    });
    count +=
      extraction.extraction.entities.length +
      extraction.extraction.edges.length +
      extraction.extraction.events.length;
    if (count > MAX_READ_ITEMS) throw new CompanyImportWorkerError("too_many_facts");
  }
  for (const fact of page.facts) {
    const evidence = fact.input.evidence;
    const item = page.items.find((candidate) => candidate.sourceItemId === evidence.sourceItemId);
    if (
      evidence.sourceKind !== sourceKind ||
      (evidence.connectionId ?? null) !== connectionId ||
      (evidence.mcpServerId ?? null) !== (mcpServerId ?? null) ||
      !item ||
      item.contentHash !== evidence.contentHash
    ) {
      throw new CompanyImportWorkerError("invalid_fact_provenance");
    }
  }
}

export function createCompanyImportEngine(deps: CompanyImportEngineDeps) {
  const worker: CompanyImportWorker = deps.worker ?? {
    discover: async () => {
      throw new CompanyImportWorkerError("unsupported_reader");
    },
    read: async () => {
      throw new CompanyImportWorkerError("unsupported_reader");
    },
  };

  async function publish(actor: Actor, runId: string): Promise<CompanyImportProgress> {
    const progress = await getCompanyImportProgress(deps.prisma, actor, runId);
    const event: CompanyImportEvent = progress;
    await deps.realtime
      .publish(RUN_TOPIC(actor.spaceId, actor.userId), JSON.stringify(event))
      .catch(() => undefined);
    return progress;
  }

  async function* follow(actor: Actor, runId: string, signal?: AbortSignal) {
    await getCompanyImportProgress(deps.prisma, actor, runId);
    for await (const event of followRealtimeTopic(
      deps.realtime,
      RUN_TOPIC(actor.spaceId, actor.userId),
      (payload) => CompanyImportEventSchema.parse(JSON.parse(payload)),
      signal,
    )) {
      if (event.runId === runId) yield event;
    }
  }

  async function getSourceContext(actor: Actor, runId: string, sourceId: string, active = false) {
    const member = await deps.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
      select: { userId: true },
    });
    if (!member) throw new CompanyImportWorkerError("not_found");
    const source = await deps.prisma.companyImportSource.findFirst({
      where: {
        id: sourceId,
        runId,
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        run: { spaceId: actor.spaceId, ownerUserId: actor.userId },
      },
      include: { run: { select: { status: true, disclosureVersion: true } } },
    });
    if (!source) throw new CompanyImportWorkerError("not_found");
    const sourceKey = JSON.stringify([
      source.sourceKind,
      source.connectionId,
      source.mcpServerId ?? null,
    ]);
    const blocked = await deps.prisma.companySourceBlock.findFirst({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        OR: [
          { sourceKey },
          { sourceKind: source.sourceKind, connectionId: null, mcpServerId: null },
        ],
      },
      select: { id: true },
    });
    if (blocked) throw new CompanyImportConsentRequired();
    if (source.connectionId) {
      const connection = await deps.prisma.connection.findFirst({
        where: {
          id: source.connectionId,
          spaceId: actor.spaceId,
          userId: actor.userId,
          status: "connected",
          allAgents: true,
          privateByDefault: false,
        },
        select: { id: true },
      });
      if (!connection) throw new CompanyImportConsentRequired();
    }
    if (source.sourceKind === "mcp" && (!source.mcpServerId || source.connectionId)) {
      throw new CompanyImportConsentRequired();
    }
    if (source.sourceKind !== "mcp" && source.mcpServerId) {
      throw new CompanyImportConsentRequired();
    }
    if (source.sourceKind === "mcp") {
      const [server, importer] = await Promise.all([
        deps.prisma.mcpServer.findFirst({
          where: {
            id: source.mcpServerId!,
            spaceId: actor.spaceId,
            userId: actor.userId,
            enabled: true,
          },
          select: { id: true },
        }),
        deps.prisma.bot.findFirst({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            spawnKey: companyImporterSpawnKey(actor.userId),
            archivedAt: null,
          },
          select: { id: true },
        }),
      ]);
      if (!server || !importer) throw new CompanyImportConsentRequired();
      const assignment = await deps.prisma.botMcpServer.findFirst({
        where: {
          botId: importer.id,
          serverId: server.id,
          spaceId: actor.spaceId,
          userId: actor.userId,
        },
        select: { id: true },
      });
      if (!assignment) throw new CompanyImportConsentRequired();
    }
    if (source.sourceKind === "data_room") {
      const sourceScope =
        typeof source.scope === "object" && source.scope !== null && !Array.isArray(source.scope)
          ? (source.scope as Record<string, unknown>)
          : {};
      const itemIds = sourceScope.itemIds ?? sourceScope.dataRoomItemIds;
      if (itemIds !== undefined) {
        if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === "string")) {
          throw new CompanyImportConsentRequired();
        }
        const uniqueItemIds = [...new Set(itemIds as string[])];
        const count = await deps.prisma.dataRoomItem.count({
          where: {
            id: { in: uniqueItemIds },
            spaceId: actor.spaceId,
            userId: actor.userId,
          },
        });
        if (count !== uniqueItemIds.length) throw new CompanyImportConsentRequired();
      }
    }
    if (active) {
      if (source.run.status === "awaiting_consent") throw new CompanyImportConsentRequired();
      if (source.run.status === "budget_reached") {
        throw new CompanyImportError("budget_reached");
      }
      if (!["running", "paused"].includes(source.run.status)) {
        throw new CompanyImportWorkerError("stale_claim");
      }
    }
    return source;
  }

  async function currentConsent(
    actor: Actor,
    runId: string,
    sourceId: string,
    expectedKey?: string,
  ) {
    const source = await getSourceContext(actor, runId, sourceId, true);
    let model: Model;
    try {
      if (!deps.resolveModel) throw new Error("model resolver unavailable");
      model = await deps.resolveModel(actor);
    } catch {
      throw new CompanyImportConsentRequired();
    }
    const recipient = recipientFor(model ?? null);
    if (
      !recipient ||
      source.run.disclosureVersion !== AI_DISCLOSURE_VERSION ||
      (expectedKey !== undefined && expectedKey !== recipient.key)
    ) {
      throw new CompanyImportConsentRequired();
    }
    const recipientKey = boundConsentKey(source, recipient.key, model);
    const consent = await deps.prisma.aiDataConsent.findUnique({
      where: {
        userId_spaceId_recipientKey: {
          userId: actor.userId,
          spaceId: actor.spaceId,
          recipientKey,
        },
      },
      select: { version: true },
    });
    if (!consent || consent.version !== AI_DISCLOSURE_VERSION) {
      throw new CompanyImportConsentRequired();
    }
    return { source, model, recipient, recipientKey };
  }

  function workerContext(
    actor: Actor,
    input: { runId: string; sourceId: string; unitId: string; claimToken: string },
    signal: AbortSignal,
  ): CompanyImportWorkerContext {
    return {
      actor: { spaceId: actor.spaceId, userId: actor.userId },
      signal,
      executeModelCall: async ({ inputTokenBound, maxOutputTokens, invoke }) => {
        if (
          !Number.isSafeInteger(inputTokenBound) ||
          inputTokenBound <= 0 ||
          !Number.isSafeInteger(maxOutputTokens) ||
          maxOutputTokens <= 0 ||
          !Number.isSafeInteger(inputTokenBound + maxOutputTokens)
        ) {
          throw new CompanyImportWorkerError("invalid_token_bound");
        }
        const before = await currentConsent(actor, input.runId, input.sourceId);
        const reservation = await reserveCompanyImportCall(deps.prisma, actor, {
          ...input,
          callId: randomUUID(),
          recipientKey: before.recipientKey,
          disclosureVersion: AI_DISCLOSURE_VERSION,
          inputTokenBound,
          maxOutputTokens,
        });
        let stillAllowed: Awaited<ReturnType<typeof currentConsent>>;
        try {
          stillAllowed = await currentConsent(
            actor,
            input.runId,
            input.sourceId,
            before.recipient.key,
          );
          if (stillAllowed.recipientKey !== before.recipientKey) {
            throw new CompanyImportConsentRequired();
          }
          const claim = await deps.prisma.companyImportUnit.findFirst({
            where: {
              id: input.unitId,
              runId: input.runId,
              sourceId: input.sourceId,
              spaceId: actor.spaceId,
              ownerUserId: actor.userId,
              status: "claimed",
              claimToken: input.claimToken,
              claimExpiresAt: { gt: new Date() },
            },
            select: { id: true },
          });
          if (!claim) throw new CompanyImportWorkerError("stale_claim");
          if (signal.aborted) throw new CompanyImportWorkerError("aborted");
        } catch (error) {
          await releaseCompanyImportCall(deps.prisma, actor, {
            ...input,
            reservationId: reservation.reservationId,
          });
          throw error;
        }
        const result = await invoke(stillAllowed.model, signal);
        if (
          result.provider !== stillAllowed.model.provider ||
          result.model !== stillAllowed.model.id
        ) {
          throw new CompanyImportWorkerError("model_mismatch");
        }
        const inputTokens = result.usage.inputTokens;
        const outputTokens = result.usage.outputTokens;
        if (
          inputTokens === null ||
          outputTokens === null ||
          !Number.isSafeInteger(inputTokens) ||
          inputTokens < 0 ||
          !Number.isSafeInteger(outputTokens) ||
          outputTokens < 0
        ) {
          throw new CompanyImportWorkerError("invalid_usage");
        }
        const settled = await settleCompanyImportCall(deps.prisma, actor, {
          ...input,
          reservationId: reservation.reservationId,
          provider: result.provider,
          model: result.model,
          callId: result.callId,
          usage: result.usage,
        });
        if (!settled) throw new CompanyImportWorkerError("stale_claim");
        const after = await currentConsent(
          actor,
          input.runId,
          input.sourceId,
          before.recipient.key,
        );
        if (after.recipientKey !== before.recipientKey) {
          throw new CompanyImportConsentRequired();
        }
        return result;
      },
    };
  }

  async function enqueueRun(actor: Actor, runId: string, delayMs = 0) {
    const payload: BackgroundJobPayloads["company.import.run"] = {
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId,
    };
    await deps.jobs.enqueue({
      name: "company.import.run",
      payload,
      availableAt: new Date(Date.now() + delayMs),
      replaceKey: `company-import-run:${actor.spaceId}:${actor.userId}:${runId}`,
      keepExisting: true,
      maxAttempts: 1,
    });
  }

  async function scheduleUnits(actor: Actor, runId: string) {
    const run = await getCompanyImportRunForScheduling(deps.prisma, actor, runId);
    if (!run || !["running", "paused"].includes(run.status)) return;
    const units = await listCompanyImportUnitsForScheduling(deps.prisma, actor, runId);
    for (const unit of units) {
      if (run.status === "paused" && unit.status !== "claimed") continue;
      const payload: BackgroundJobPayloads["company.import.unit"] = {
        spaceId: actor.spaceId,
        userId: actor.userId,
        runId,
        unitId: unit.id,
      };
      const unitAvailableAt =
        unit.status === "claimed" ? (unit.claimExpiresAt ?? new Date()) : unit.availableAt;
      const availableAt =
        unit.source.backoffUntil && unit.source.backoffUntil > unitAvailableAt
          ? unit.source.backoffUntil
          : unitAvailableAt;
      await deps.jobs.enqueue({
        name: "company.import.unit",
        payload,
        availableAt,
        replaceKey:
          unit.status === "claimed"
            ? `company-import-unit-recovery:${actor.spaceId}:${actor.userId}:${unit.id}:${unit.claimExpiresAt?.getTime() ?? "unknown"}`
            : `company-import-unit:${actor.spaceId}:${actor.userId}:${unit.id}`,
        keepExisting: true,
        maxAttempts: 1,
      });
    }
  }

  async function runUnit(payload: BackgroundJobPayloads["company.import.unit"]) {
    const actor = workerActor(payload);
    const claim = await claimCompanyImportUnit(deps.prisma, actor, {
      runId: payload.runId,
      unitId: payload.unitId,
    });
    if (!claim) return;
    const source = claim.source;
    const claimInput = {
      runId: payload.runId,
      sourceId: source.id,
      unitId: claim.id,
      claimToken: claim.claimToken,
    };
    try {
      // Persist a lease-expiry recovery job before any source or model call.
      await deps.jobs.enqueue({
        name: "company.import.unit",
        payload,
        availableAt: new Date(Date.now() + UNIT_LEASE_MS),
        replaceKey: `company-import-unit-lease:${actor.spaceId}:${actor.userId}:${claim.id}:${claim.claimToken}`,
        keepExisting: true,
        maxAttempts: 1,
      });
      await currentConsent(actor, payload.runId, source.id);
      const context = workerContext(actor, claimInput, AbortSignal.timeout(120_000));
      const sourceDescriptor = {
        id: source.id,
        sourceKind: source.sourceKind,
        connectionId: source.connectionId,
        mcpServerId: source.mcpServerId,
        scope: source.scope as Record<string, unknown>,
      };
      const run = await deps.prisma.companyImportRun.findFirst({
        where: { id: payload.runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
        select: { mode: true },
      });
      const sample = run?.mode === "sample";
      if (claim.unitKey.startsWith("discover:")) {
        const page = await worker.discover(
          {
            source: sourceDescriptor,
            cursor: source.cursor,
            maxUnits: sample ? MAX_SAMPLE_DISCOVERY_UNITS : MAX_DISCOVERY_UNITS,
          },
          context,
        );
        assertSafePage(page, sample ? MAX_SAMPLE_DISCOVERY_UNITS : MAX_DISCOVERY_UNITS);
        await completeCompanyImportUnit(deps.prisma, actor, {
          ...claimInput,
          nextCursor: page.nextCursor,
          nextSourceCursor: page.nextCursor,
          done: sample || page.done,
          itemsDiscovered: page.units.length,
          itemsRead: 0,
          facts: [],
          discoveredUnits: page.units,
          cooldownMs: page.cooldownMs,
        });
      } else {
        const maxItems = sample ? MAX_SAMPLE_READ_ITEMS : MAX_READ_ITEMS;
        const readCursor =
          !sample && isCompanySampleResumeCursor(claim.cursor) ? claim.cursor.cursor : claim.cursor;
        const page = await worker.read(
          {
            source: sourceDescriptor,
            unitKey: claim.unitKey,
            cursor: readCursor,
            maxBytes: MAX_READ_BYTES,
            maxItems,
          },
          context,
        );
        assertSafeReadPage(page, maxItems);
        assertFactProvenance(page, source.sourceKind, source.connectionId, source.mcpServerId);
        let nextCursor = page.nextCursor;
        let done = page.done;
        if (sample && page.items.length > 0) {
          if (!page.done && page.nextCursor === null)
            throw new CompanyImportWorkerError("invalid_read_page");
          nextCursor = page.done
            ? null
            : { companySampleResume: true as const, cursor: page.nextCursor };
          done = true;
          if (!isBoundedCursor(nextCursor)) throw new CompanyImportWorkerError("cursor_too_large");
        }
        await completeCompanyImportUnit(deps.prisma, actor, {
          ...claimInput,
          nextCursor,
          done,
          itemsDiscovered: 0,
          itemsRead: page.items.length,
          facts: page.facts,
          extractions: page.extractions,
          reusedEvidenceIds: page.reusedEvidenceIds,
          readItems: page.items.map(({ sourceItemId, contentHash }) => ({
            sourceItemId,
            contentHash,
          })),
          cooldownMs: page.cooldownMs,
        });
      }
      await publish(actor, payload.runId);
      await enqueueRun(actor, payload.runId);
    } catch (error) {
      if (error instanceof CompanyImportConsentRequired) {
        await awaitCompanyImportConsent(deps.prisma, actor, claimInput);
        await publish(actor, payload.runId);
        return;
      }
      if (error instanceof CompanyImportError && error.code === "budget_reached") {
        await publish(actor, payload.runId);
        return;
      }
      const code = error instanceof CompanyImportWorkerError ? error.code : "worker_failed";
      await failCompanyImportUnit(deps.prisma, actor, {
        ...claimInput,
        errorCode: code,
        ...(error instanceof CompanyImportWorkerError && error.retryAfterMs !== undefined
          ? { retryAfterMs: error.retryAfterMs }
          : {}),
      });
      await publish(actor, payload.runId);
      await enqueueRun(actor, payload.runId, 1_000);
    }
  }

  async function reconcile() {
    const runs = await reconcileCompanyImportRunIds(deps.prisma);
    for (const run of runs) {
      await deps.jobs.enqueue({
        name: "company.import.run",
        payload: { spaceId: run.spaceId, userId: run.userId, runId: run.runId },
        replaceKey: `company-import-run:${run.spaceId}:${run.userId}:${run.runId}`,
        keepExisting: true,
        maxAttempts: 1,
      });
    }
  }

  function recipientView(recipient: NonNullable<ReturnType<typeof recipientFor>>) {
    return {
      key: recipient.key,
      name: recipient.name,
      detail: recipient.detail,
      privacyUrl: recipient.privacyUrl ?? null,
    };
  }

  async function consentStatus(actor: Actor, runId: string, sourceId: string) {
    const source = await getSourceContext(actor, runId, sourceId);
    const model = deps.resolveModel ? await deps.resolveModel(actor).catch(() => null) : null;
    const recipient = recipientFor(model);
    const view = recipient ? recipientView(recipient) : null;
    const consentKey = recipient && model ? boundConsentKey(source, recipient.key, model) : null;
    const consent = consentKey
      ? await deps.prisma.aiDataConsent.findUnique({
          where: {
            userId_spaceId_recipientKey: {
              userId: actor.userId,
              spaceId: actor.spaceId,
              recipientKey: consentKey,
            },
          },
          select: { version: true },
        })
      : null;
    return {
      allowed:
        consent?.version === AI_DISCLOSURE_VERSION &&
        source.run.disclosureVersion === AI_DISCLOSURE_VERSION,
      consentKey,
      sourceKind: source.sourceKind as CompanyImportGrantConsentInput["sourceKind"],
      recipient: view,
      version: AI_DISCLOSURE_VERSION,
    };
  }

  return {
    create: async (actor: Actor, input: CompanyImportCreateInput) => {
      const run = await createCompanyImportRun(deps.prisma, actor, {
        ...input,
        sources: input.sources.map((source) => ({
          ...source,
          scope: companySourceScope(source.sourceKind, source.scope),
        })),
      });
      return publish(actor, run.id);
    },
    progress: (actor: Actor, runId: string) => getCompanyImportProgress(deps.prisma, actor, runId),
    follow,
    consentStatus,
    grantConsent: async (actor: Actor, input: CompanyImportGrantConsentInput) => {
      const { runId, sourceId } = input;
      const source = await getSourceContext(actor, runId, sourceId);
      const model = deps.resolveModel ? await deps.resolveModel(actor).catch(() => null) : null;
      const recipient = recipientFor(model);
      if (!model || !recipient) throw new CompanyImportWorkerError("model_unavailable");
      const recipientKey = boundConsentKey(source, recipient.key, model);
      const view = recipientView(recipient);
      if (
        input.consentKey !== recipientKey ||
        input.version !== AI_DISCLOSURE_VERSION ||
        input.sourceKind !== source.sourceKind ||
        JSON.stringify(input.recipient) !== JSON.stringify(view)
      )
        throw new CompanyImportWorkerError("consent_changed");
      const sources = await deps.prisma.companyImportSource.findMany({
        where: { runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
        select: { id: true, sourceKind: true, connectionId: true, scope: true },
      });
      const requiredKeys = [];
      for (const candidate of sources) {
        const candidateContext = await getSourceContext(actor, runId, candidate.id);
        requiredKeys.push(boundConsentKey(candidateContext, recipient.key, model));
      }
      const grant = await grantCompanyImportConsent(deps.prisma, actor, {
        runId,
        sourceId,
        recipientKey,
        version: AI_DISCLOSURE_VERSION,
        requiredKeys,
      });
      if (grant.resumed) await enqueueRun(actor, runId);
      await publish(actor, runId);
      return {
        allowed: grant.allowed,
        consentKey: recipientKey,
        sourceKind: source.sourceKind,
        recipient: view,
        version: AI_DISCLOSURE_VERSION,
      };
    },
    start: async (actor: Actor, runId: string) => {
      await startCompanyImportRun(deps.prisma, actor, runId);
      await enqueueRun(actor, runId);
      return publish(actor, runId);
    },
    action: async (
      actor: Actor,
      runId: string,
      action: "pause" | "resume" | "continue" | "retry_failed" | "cancel" | "discard",
      tokenCap?: number,
    ) => {
      await updateCompanyImportRun(deps.prisma, actor, {
        runId,
        action,
        ...(tokenCap === undefined ? {} : { tokenCap }),
      });
      if (action === "resume" || action === "continue" || action === "retry_failed")
        await enqueueRun(actor, runId);
      await publish(actor, runId);
      return getCompanyImportProgress(deps.prisma, actor, runId);
    },
    runJob: async (payload: BackgroundJobPayloads["company.import.run"]) => {
      const actor = workerActor(payload);
      await scheduleUnits(actor, payload.runId);
    },
    unitJob: runUnit,
    recoveryJob: reconcile,
  };
}

export type CompanyImportEngine = ReturnType<typeof createCompanyImportEngine>;
