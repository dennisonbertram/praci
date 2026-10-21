import { createHash, randomUUID } from "node:crypto";
import type { CompanyImportWorker, JobPublisher, RealtimeFanout } from "@rakazo/adapter-kit";
import type { CompanyCompletion } from "@rakazo/adapters";
import { createCompanyImportEngine, LlmCompanyExtractor } from "@rakazo/adapters";
import type { Actor, CompanyEvidenceInput } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor } from "@rakazo/db";
import {
  createNorthwindCompanyFixture,
  createSecondCompanyFixture,
  northwindGroundTruth,
  secondCompanyGroundTruth,
} from "../company-fixture.js";
import type { CompanyEvalObservations } from "./company-metrics.js";
import { measureCompanyEval } from "./company-metrics.js";
import { companyRecordedUsage, companyRecordings } from "./company-recordings.js";

const kinds = ["data_room", "gmail", "slack", "github", "linear"] as const;

/** Only synthetic fixtures and a recorded completion are reachable from this runner. */
export async function runCompanyEval(prisma: PrismaClient) {
  const id = `company-eval-${randomUUID()}`;
  const actor: Actor = {
    spaceId: `${id}-a`,
    userId: `${id}-owner`,
    email: "owner@example.test",
    isDeploymentOwner: false,
  };
  const peer: Actor = { ...actor, userId: `${id}-peer` };
  const other: Actor = { ...actor, spaceId: `${id}-b` };
  const organizationId = id;
  await prisma.organization.create({
    data: { id, slug: id, name: "Synthetic evaluation", createdAt: new Date() },
  });
  try {
    for (const userId of [actor.userId, peer.userId]) {
      await prisma.user.create({
        data: { id: userId, email: `${userId}@example.test`, name: "Synthetic owner" },
      });
      await prisma.member.create({
        data: {
          id: `${userId}-member`,
          organizationId,
          userId,
          role: "owner",
          createdAt: new Date(),
        },
      });
    }
    for (const spaceId of [actor.spaceId, other.spaceId]) {
      await prisma.space.create({ data: { id: spaceId, organizationId, name: "Synthetic space" } });
      for (const userId of [actor.userId, peer.userId])
        await prisma.spaceMember.create({
          data: {
            id: `${spaceId}-${userId}`,
            spaceId,
            organizationId,
            userId,
            role: "owner",
            createdAt: new Date(),
          },
        });
    }
    const scope = { spaceId: actor.spaceId, ownerUserId: actor.userId };
    const corpus = createNorthwindCompanyFixture();
    const initialCorpus = structuredClone(corpus);
    for (const item of corpus.filter((item) => item.sourceKind === "data_room")) {
      await prisma.dataRoomItem.create({
        data: {
          id: item.sourceItemId,
          spaceId: actor.spaceId,
          userId: actor.userId,
          source: "upload",
          sha256: item.contentHash,
          name: item.title,
          mimeType: "text/plain",
          size: BigInt(Buffer.byteLength(item.body)),
          status: "ready",
        },
      });
      await prisma.dataRoomItemText.create({
        data: {
          itemId: item.sourceItemId,
          spaceId: actor.spaceId,
          userId: actor.userId,
          text: item.body,
        },
      });
    }
    const sourceCalls: Array<{ kind: string; method: string }> = [];
    const calls: Array<{ title: string; stage: "relevance" | "extraction" }> = [];
    const readItems = new Set<string>();
    let outOfAllowlistCalls = 0;
    const completion: CompanyCompletion = async (request, model) => {
      if (request.tools.length) {
        outOfAllowlistCalls += request.tools.length;
        throw new Error("eval_tool_call");
      }
      const source = JSON.parse(request.prompt).untrustedSource as { title: string; text: string };
      const stage = request.maxOutputTokens === 64 ? "relevance" : "extraction";
      calls.push({ title: source.title, stage });
      const recording = companyRecordings[source.title];
      return {
        text: JSON.stringify(stage === "relevance" ? { relevant: !!recording } : recording),
        valid: true,
        provider: model.provider,
        model: model.id,
        usage: companyRecordedUsage[stage],
      };
    };
    const extractor = new LlmCompanyExtractor(completion);
    const allowRead = (
      kind: string,
      method: string,
      requestActor: { spaceId: string; userId: string },
    ) => {
      if (requestActor.spaceId !== actor.spaceId || requestActor.userId !== actor.userId)
        throw new Error("eval_source_scope");
      if (!kinds.some((value) => value === kind)) throw new Error("eval_unknown_source");
      sourceCalls.push({ kind, method });
      if (!["list", "read"].includes(method)) {
        outOfAllowlistCalls++;
        throw new Error("eval_source_write");
      }
    };
    const worker: CompanyImportWorker = {
      discover: async ({ source, cursor, maxUnits }, context) => {
        allowRead(source.sourceKind, "list", context.actor);
        const selected = corpus.filter((item) => item.sourceKind === source.sourceKind);
        const offset = typeof cursor === "number" ? cursor : 0;
        const page = selected.slice(offset, offset + maxUnits);
        return {
          units: page.map((item) => ({ unitKey: item.sourceItemId, cursor: item.sourceItemId })),
          nextCursor: offset + page.length,
          done: offset + page.length >= selected.length,
        };
      },
      read: async ({ source, cursor, maxBytes }, context) => {
        allowRead(source.sourceKind, "read", context.actor);
        const item = corpus.find(
          (item) => item.sourceKind === source.sourceKind && item.sourceItemId === cursor,
        );
        if (!item || Buffer.byteLength(item.body) > maxBytes) throw new Error("eval_fixture_bound");
        readItems.add(`${item.sourceKind}:${item.sourceItemId}`);
        const page = {
          items: [
            { sourceItemId: item.sourceItemId, contentHash: item.contentHash, content: item.body },
          ],
          facts: [],
          nextCursor: null,
          done: true,
        };
        const existing = await prisma.companyEvidence.findMany({
          where: {
            ...scope,
            sourceKind: item.sourceKind,
            sourceItemId: item.sourceItemId,
            contentHash: item.contentHash,
          },
          select: { id: true },
        });
        if (existing.length) return { ...page, reusedEvidenceIds: existing.map((row) => row.id) };
        const document = { title: item.title, text: item.body };
        if (!(await extractor.relevant(document, context))) return page;
        const result = await extractor.extract(document, context);
        return {
          ...page,
          extractions: [
            {
              sourceItemId: item.sourceItemId,
              contentHash: item.contentHash,
              sourceUrl: item.sourceUrl,
              ...result,
            },
          ],
        };
      },
    };
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const engine = createCompanyImportEngine({
      prisma,
      worker,
      jobs,
      realtime: { publish: async () => undefined } as unknown as RealtimeFanout,
      resolveModel: async () => ({ provider: "recorded", id: "company-fixture-v1" }),
    });
    const run = async () => {
      const { runId } = await engine.create(actor, {
        tokenCap: 1_000_000,
        sources: kinds.map((sourceKind) => ({
          sourceKind,
          scope: sourceKind === "gmail" ? { allTime: true } : {},
        })),
      });
      for (const source of await prisma.companyImportSource.findMany({
        where: { ...scope, runId },
      })) {
        const consent = await engine.consentStatus(actor, runId, source.id);
        await engine.grantConsent(actor, {
          runId,
          sourceId: source.id,
          consentKey: consent.consentKey!,
          version: consent.version,
          sourceKind: consent.sourceKind,
          recipient: consent.recipient!,
        });
      }
      await engine.start(actor, runId);
      const payload = { spaceId: actor.spaceId, userId: actor.userId, runId };
      for (let pass = 0; pass < 30; pass++) {
        await engine.runJob(payload);
        for (const unit of await prisma.companyImportUnit.findMany({
          where: { ...scope, runId, status: "waiting" },
          orderBy: [{ unitKey: "asc" }, { id: "asc" }],
          select: { id: true },
        }))
          await engine.unitJob({ ...payload, unitId: unit.id });
        const progress = await engine.progress(actor, runId);
        const errors = await prisma.companyImportUnit.findMany({
          where: { ...scope, runId, lastError: { not: null } },
          select: { unitKey: true, lastError: true },
        });
        if (errors.length) throw new Error(`eval_units_failed:${JSON.stringify(errors)}`);
        if (progress.status === "completed") return runId;
        if (["failed", "partial", "budget_reached", "awaiting_consent"].includes(progress.status))
          throw new Error(`eval_run_${progress.status}`);
      }
      throw new Error("eval_run_did_not_finish");
    };
    const store = companyForActor(prisma, actor);
    const firstRunId = await run();
    const firstCalls = calls.slice();
    const entities = await store.list();
    const edges = await store.listEdges();
    const events = await store.listEvents();
    const facts = [...entities, ...edges, ...events];
    const evidenceCount = await prisma.companyEvidence.count({ where: scope });
    const factCount = async () =>
      (await store.list({ includeRejected: true })).length +
      (await store.listEdges({ includeRejected: true })).length +
      (await store.listEvents({ includeRejected: true })).length;
    const firstFactCount = await factCount();
    await run();
    const addedFactsOnReplay = (await factCount()) - firstFactCount;
    const addedEvidenceOnReplay =
      (await prisma.companyEvidence.count({ where: scope })) - evidenceCount;
    const addedModelCallsOnReplay = calls.length - firstCalls.length;

    const required = (name: string) => {
      const matching = entities.filter((row) => row.displayName === name);
      if (matching.length !== 1) throw new Error(`eval_ambiguous_or_missing_control:${name}`);
      return matching[0]!;
    };
    const avery = required("Avery Vale"),
      rowan = required("Rowan Flint"),
      copper = required("Copper Orchard");
    await store.edit({
      entityId: avery.id,
      kind: "person",
      displayName: "Avery Vale (owner correction)",
    });
    await store.confirm(rowan.id);
    await store.reject(copper.id, "Synthetic owner rejection");
    for (const item of corpus.filter(
      (item) => item.sourceItemId === "nw-doc-002" || item.sourceItemId === "nw-doc-003",
    )) {
      item.body += "\nArchive revision checked.";
      item.contentHash = createHash("sha256").update(item.body).digest("hex");
    }
    await run();
    const corrected = await store.list({ includeRejected: true });
    const correctionsRetained =
      Number(
        corrected.some(
          (row) => row.id === avery.id && row.displayName === "Avery Vale (owner correction)",
        ),
      ) +
      Number(corrected.some((row) => row.id === rowan.id && row.status === "confirmed")) +
      Number(corrected.some((row) => row.id === copper.id && row.status === "rejected"));

    const evidence = (sourceItemId: string, quote: string): CompanyEvidenceInput => {
      const item = initialCorpus.find((item) => item.sourceItemId === sourceItemId)!;
      return {
        stance: "supports",
        sourceKind: item.sourceKind,
        sourceItemId,
        sourceUrl: item.sourceUrl,
        contentHash: item.contentHash,
        quote,
        extractedAt: "2026-01-01T00:00:00.000Z",
        extractorRunId: firstRunId,
        extractorModel: { provider: "recorded", model: "company-fixture-v1" },
        confidence: 0.95,
      };
    };
    // Known identity supplied by the test owner, not an automatic resolution of the weak return mention.
    const strongSam = entities.filter(
      (row) =>
        row.kind === "person" &&
        (row.attrs as { workEmails?: string[] }).workEmails?.includes("sam.reed@northwind.example"),
    );
    if (strongSam.length !== 1) throw new Error("eval_ambiguous_or_missing_sam_identity");
    const sam = strongSam[0]!,
      company = required("Northwind Robotics");
    for (const periodId of ["nw-employment-3", "nw-employment-return"]) {
      const period = northwindGroundTruth.edges.find((edge) => edge.id === periodId)!;
      await store.importEdge({
        edge: { ...period.input, fromId: sam.id, toId: company.id },
        evidence: evidence(
          periodId === "nw-employment-3" ? "nw-doc-002" : "nw-doc-019",
          period.statement,
        ),
      });
    }
    const employment = (await store.listEdges({ entityId: sam.id, relation: "works_at" })).filter(
      (edge) => edge.toId === company.id,
    );
    const expectedPeriods = northwindGroundTruth.edges.filter((edge) =>
      ["nw-employment-3", "nw-employment-return"].includes(edge.id),
    );
    const repeatedEmploymentPeriods =
      employment.length === 2
        ? expectedPeriods.filter((expected) =>
            employment.some(
              (actual) =>
                actual.startsOn?.date === expected.input.startsOn?.date &&
                actual.startsOn?.precision === expected.input.startsOn?.precision &&
                (actual.endsOn?.date ?? null) === (expected.input.endsOn?.date ?? null) &&
                actual.role === expected.input.role,
            ),
          ).length
        : 0;

    const secondCorpus = createSecondCompanyFixture();
    const secondStore = companyForActor(prisma, other);
    for (const item of secondCorpus.filter((item) => item.sourceKind === "data_room"))
      await prisma.dataRoomItem.create({
        data: {
          id: item.sourceItemId,
          spaceId: other.spaceId,
          userId: other.userId,
          source: "upload",
          sha256: item.contentHash,
          name: item.title,
          mimeType: "text/plain",
          size: BigInt(Buffer.byteLength(item.body)),
          status: "ready",
        },
      });
    for (const truth of secondCompanyGroundTruth.entities) {
      const item = secondCorpus.find(
        (item) => item.sourceItemId === truth.sources[0]!.sourceItemId,
      )!;
      await secondStore.importEntity({
        entity: truth.input,
        evidence: {
          stance: "supports",
          sourceKind: item.sourceKind,
          sourceItemId: item.sourceItemId,
          contentHash: item.contentHash,
          quote: truth.statement,
          extractedAt: "2026-01-01T00:00:00.000Z",
          extractorModel: { provider: "recorded", model: "isolation-control" },
          confidence: 0.95,
        },
      });
    }
    let isolationRows = 0;
    for (const outsider of [peer, other]) {
      const outside = companyForActor(prisma, outsider);
      const visible = await outside.list();
      isolationRows += visible.filter((row) => entities.some((own) => own.id === row.id)).length;
      isolationRows += (await outside.listEdges({ entityId: sam.id })).length;
      isolationRows += (await outside.listEvents({ entityId: sam.id })).length;
      isolationRows += (await outside.evidence(sam.id)).length;
      isolationRows += (await outside.list({ text: "Northwind" })).length;
      isolationRows += Number((await outside.detail(sam.id)) !== null);
      isolationRows += await outside.countEdges({ entityId: sam.id });
      isolationRows += await outside.countEvents({ entityId: sam.id });
      isolationRows += Math.abs(
        (await outside.count()) - (outsider.spaceId === other.spaceId ? 2 : 0),
      );
    }
    const secondEntities = await secondStore.list();
    isolationRows += (await store.list()).filter((row) =>
      secondEntities.some((otherRow) => row.id === otherRow.id),
    ).length;
    if (secondEntities.length !== 2) throw new Error("eval_isolation_control_missing");
    const usage = await prisma.companyImportRun.findFirstOrThrow({
      where: { ...scope, id: firstRunId },
    });
    const injectionIds = new Set(
      northwindGroundTruth.injectionSources.map(
        (item) => `${item.sourceKind}:${item.sourceItemId}`,
      ),
    );
    const aliasIds = northwindGroundTruth.identityAliases[0]!.workEmails.map((email) => {
      const matching = entities.filter(
        (entity) =>
          entity.kind === "person" &&
          (entity.attrs as { workEmails?: string[] }).workEmails?.includes(email),
      );
      return matching.length === 1 ? matching[0]!.id : "";
    });
    const observations: CompanyEvalObservations = {
      injectionItemsChecked: [...injectionIds].filter((id) => readItems.has(id)).length,
      injectionFacts: facts.filter((fact) =>
        fact.evidence.some((row) => injectionIds.has(`${row.sourceKind}:${row.sourceItemId}`)),
      ).length,
      outOfAllowlistCalls,
      sourceWrites: Object.fromEntries(
        kinds.map((kind) => [
          kind,
          sourceCalls.filter(
            (call) => call.kind === kind && !["list", "read"].includes(call.method),
          ).length,
        ]),
      ),
      isolationRows,
      correctionsChecked: 3,
      correctionsRetained,
      addedFactsOnReplay,
      addedEvidenceOnReplay,
      addedModelCallsOnReplay,
      repeatedEmploymentPeriods,
      aliasEntityIds: aliasIds.map((id) =>
        id === sam.id ? "sam-reed" : id ? "unexpected-identity" : "",
      ),
      distinctSamIds: [sam.id, required("Sam Moss").id].map((id) =>
        id === sam.id ? "sam-reed" : "sam-moss",
      ),
      tokenCap: Number(usage.tokenCap),
      usedTokens: Number(usage.inputTokensUsed + usage.outputTokensUsed),
      reservedTokens: Number(usage.reservedTokens),
      inputTokens: Number(usage.inputTokensUsed),
      outputTokens: Number(usage.outputTokensUsed),
      relevanceCalls: firstCalls.filter((call) => call.stage === "relevance").length,
      extractionCalls: firstCalls.filter((call) => call.stage === "extraction").length,
      items: initialCorpus.length,
    };
    const expectedUsage = firstCalls.reduce(
      (total, call) =>
        total +
        companyRecordedUsage[call.stage].inputTokens +
        companyRecordedUsage[call.stage].outputTokens,
      0,
    );
    if (observations.usedTokens !== expectedUsage)
      throw new Error("eval_usage_accounting_mismatch");
    return measureCompanyEval({ entities, edges, events, corpus: initialCorpus, observations });
  } finally {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [actor.userId, peer.userId] } } });
  }
}
