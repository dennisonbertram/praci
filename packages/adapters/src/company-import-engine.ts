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
  CompanyImportProgress,
} from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  CompanyEdgeImportInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEventImportInputSchema,
  CompanyImportEventSchema,
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
  listCompanyImportUnitsForScheduling,
  reconcileCompanyImportRunIds,
  reserveCompanyImportCall,
  settleCompanyImportCall,
  startCompanyImportRun,
  updateCompanyImportRun,
} from "@rakazo/db";
import { aiRecipient } from "./ai-consent.js";

const MAX_DISCOVERY_UNITS = 100;
const MAX_READ_BYTES = 500_000;
const MAX_READ_ITEMS = 100;
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
    scope: unknown;
  },
  recipientKey: string,
) {
  return createHash("sha256")
    .update(JSON.stringify([source.sourceKind, source.connectionId, source.scope, recipientKey]))
    .digest("hex");
}

function assertSafePage(page: unknown): asserts page is {
  units: { unitKey: string; cursor: unknown }[];
  nextCursor: unknown | null;
  done: boolean;
} {
  if (!page || typeof page !== "object")
    throw new CompanyImportWorkerError("invalid_discovery_page");
  const candidate = page as { units?: unknown; nextCursor?: unknown; done?: unknown };
  if (
    !Array.isArray(candidate.units) ||
    candidate.units.length > MAX_DISCOVERY_UNITS ||
    typeof candidate.done !== "boolean"
  ) {
    throw new CompanyImportWorkerError("invalid_discovery_page");
  }
  const seen = new Set<string>();
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
    if (seen.has(key)) throw new CompanyImportWorkerError("duplicate_discovery_unit");
    seen.add(key);
  }
}

function assertSafeReadPage(page: unknown): asserts page is CompanyImportReadPage {
  if (!page || typeof page !== "object") throw new CompanyImportWorkerError("invalid_read_page");
  const candidate = page as { items?: unknown; facts?: unknown; done?: unknown };
  if (
    !Array.isArray(candidate.items) ||
    candidate.items.length > MAX_READ_ITEMS ||
    !Array.isArray(candidate.facts) ||
    candidate.facts.length > MAX_READ_ITEMS ||
    typeof candidate.done !== "boolean"
  ) {
    throw new CompanyImportWorkerError("invalid_read_page");
  }
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

function assertFactProvenance(page: CompanyImportReadPage, sourceKind: string) {
  for (const fact of page.facts) {
    const evidence = fact.input.evidence;
    const item = page.items.find((candidate) => candidate.sourceItemId === evidence.sourceItemId);
    if (evidence.sourceKind !== sourceKind || !item || item.contentHash !== evidence.contentHash) {
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

  async function getSourceContext(actor: Actor, runId: string, sourceId: string) {
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
    if (source.run.status === "awaiting_consent") throw new CompanyImportConsentRequired();
    if (source.run.status === "budget_reached") {
      throw new CompanyImportError("budget_reached");
    }
    if (!["running", "paused"].includes(source.run.status)) {
      throw new CompanyImportWorkerError("stale_claim");
    }
    if (source.connectionId) {
      const connection = await deps.prisma.connection.findFirst({
        where: {
          id: source.connectionId,
          spaceId: actor.spaceId,
          userId: actor.userId,
        },
        select: { id: true },
      });
      if (!connection) throw new CompanyImportConsentRequired();
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
        const count = await deps.prisma.dataRoomItem.count({
          where: {
            id: { in: itemIds as string[] },
            spaceId: actor.spaceId,
            userId: actor.userId,
          },
        });
        if (count !== itemIds.length) throw new CompanyImportConsentRequired();
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
    const source = await getSourceContext(actor, runId, sourceId);
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
    const recipientKey = boundConsentKey(source, recipient.key);
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
        const stillAllowed = await currentConsent(
          actor,
          input.runId,
          input.sourceId,
          before.recipient.key,
        );
        if (stillAllowed.recipientKey !== before.recipientKey) {
          throw new CompanyImportConsentRequired();
        }
        const result = await invoke();
        if (result.provider !== before.model.provider || result.model !== before.model.id) {
          throw new CompanyImportWorkerError("model_mismatch");
        }
        const inputTokens = result.usage.inputTokens;
        const outputTokens = result.usage.outputTokens;
        if (Number.isSafeInteger(inputTokens) && Number.isSafeInteger(outputTokens)) {
          if (
            (inputTokens as number) > inputTokenBound ||
            (outputTokens as number) > maxOutputTokens
          ) {
            throw new CompanyImportWorkerError("usage_exceeds_reservation");
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
        }
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
      const availableAt =
        unit.status === "claimed" ? (unit.claimExpiresAt ?? new Date()) : unit.availableAt;
      await deps.jobs.enqueue({
        name: "company.import.unit",
        payload,
        availableAt,
        replaceKey: `company-import-unit:${actor.spaceId}:${actor.userId}:${unit.id}`,
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
        scope: source.scope as Record<string, unknown>,
      };
      if (claim.unitKey.startsWith("discover:")) {
        const page = await worker.discover(
          {
            source: sourceDescriptor,
            cursor: source.cursor,
            maxUnits: MAX_DISCOVERY_UNITS,
          },
          context,
        );
        assertSafePage(page);
        await completeCompanyImportUnit(deps.prisma, actor, {
          ...claimInput,
          nextCursor: page.nextCursor,
          nextSourceCursor: page.nextCursor,
          done: page.done,
          itemsDiscovered: page.units.length,
          itemsRead: 0,
          facts: [],
          discoveredUnits: page.units,
        });
      } else {
        const page = await worker.read(
          {
            source: sourceDescriptor,
            unitKey: claim.unitKey,
            cursor: claim.cursor,
            maxBytes: MAX_READ_BYTES,
          },
          context,
        );
        assertSafeReadPage(page);
        assertFactProvenance(page, source.sourceKind);
        await completeCompanyImportUnit(deps.prisma, actor, {
          ...claimInput,
          nextCursor: page.nextCursor,
          done: page.done,
          itemsDiscovered: 0,
          itemsRead: page.items.length,
          facts: page.facts,
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

  return {
    create: async (actor: Actor, input: CompanyImportCreateInput) => {
      const run = await createCompanyImportRun(deps.prisma, actor, input);
      return publish(actor, run.id);
    },
    progress: (actor: Actor, runId: string) => getCompanyImportProgress(deps.prisma, actor, runId),
    follow,
    consentStatus: async (actor: Actor, runId: string, sourceId: string) => {
      const source = await getSourceContext(actor, runId, sourceId);
      const model = deps.resolveModel ? await deps.resolveModel(actor).catch(() => null) : null;
      const recipient = recipientFor(model);
      if (!recipient) {
        return { allowed: false, recipient: null, version: AI_DISCLOSURE_VERSION };
      }
      const consent = await deps.prisma.aiDataConsent.findUnique({
        where: {
          userId_spaceId_recipientKey: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            recipientKey: boundConsentKey(source, recipient.key),
          },
        },
        select: { version: true },
      });
      return {
        allowed:
          consent?.version === AI_DISCLOSURE_VERSION &&
          source.run.disclosureVersion === AI_DISCLOSURE_VERSION,
        recipient: recipient.name,
        version: AI_DISCLOSURE_VERSION,
      };
    },
    grantConsent: async (actor: Actor, runId: string, sourceId: string) => {
      const source = await getSourceContext(actor, runId, sourceId);
      const model = deps.resolveModel ? await deps.resolveModel(actor).catch(() => null) : null;
      const recipient = recipientFor(model);
      if (!recipient) throw new CompanyImportWorkerError("model_unavailable");
      const recipientKey = boundConsentKey(source, recipient.key);
      await deps.prisma.aiDataConsent.upsert({
        where: {
          userId_spaceId_recipientKey: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            recipientKey,
          },
        },
        create: {
          userId: actor.userId,
          spaceId: actor.spaceId,
          recipientKey,
          version: AI_DISCLOSURE_VERSION,
        },
        update: { version: AI_DISCLOSURE_VERSION, grantedAt: new Date() },
      });
      await deps.prisma.companyImportRun.updateMany({
        where: { id: runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
        data: { disclosureVersion: AI_DISCLOSURE_VERSION },
      });
      if (source.run.status === "awaiting_consent") {
        await deps.prisma.companyImportRun.updateMany({
          where: {
            id: runId,
            spaceId: actor.spaceId,
            ownerUserId: actor.userId,
            status: "awaiting_consent",
          },
          data: { status: "running" },
        });
        await deps.prisma.companyImportSource.updateMany({
          where: {
            id: sourceId,
            runId,
            spaceId: actor.spaceId,
            ownerUserId: actor.userId,
          },
          data: { status: "running" },
        });
        await enqueueRun(actor, runId);
      }
      await publish(actor, runId);
      return { allowed: true, recipient: recipient.name, version: AI_DISCLOSURE_VERSION };
    },
    start: async (actor: Actor, runId: string) => {
      await startCompanyImportRun(deps.prisma, actor, runId);
      await enqueueRun(actor, runId);
      return publish(actor, runId);
    },
    action: async (
      actor: Actor,
      runId: string,
      action: "pause" | "resume" | "retry_failed" | "cancel" | "discard",
      tokenCap?: number,
    ) => {
      await updateCompanyImportRun(deps.prisma, actor, {
        runId,
        action,
        ...(tokenCap === undefined ? {} : { tokenCap }),
      });
      if (action === "resume" || action === "retry_failed") await enqueueRun(actor, runId);
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
