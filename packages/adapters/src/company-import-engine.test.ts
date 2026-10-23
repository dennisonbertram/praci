import type {
  CompanyImportDiscoveryPage,
  CompanyImportFact,
  CompanyImportReadPage,
  CompanyImportWorker,
  JobPublisher,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import type { Actor, CompanyImportProgress } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, COMPANY_IMPORT_CURSOR_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  awaitCompanyImportConsent: vi.fn(async () => undefined),
  claimCompanyImportUnit: vi.fn(),
  completeCompanyImportUnit: vi.fn(async () => undefined),
  failCompanyImportUnit: vi.fn(async () => undefined),
  followRealtimeTopic: vi.fn(),
  getCompanyImportProgress: vi.fn(),
  getCompanyImportRunForScheduling: vi.fn(),
  listCompanyImportUnitsForScheduling: vi.fn(),
  reconcileCompanyImportRunIds: vi.fn(),
  grantCompanyImportConsent: vi.fn(async () => ({ allowed: true, resumed: false })),
  releaseCompanyImportCall: vi.fn(async () => true),
  reserveCompanyImportCall: vi.fn(async () => ({
    reservationId: "reservation-1",
    reservedInput: 10,
    reservedOutput: 5,
  })),
  settleCompanyImportCall: vi.fn(async () => true),
}));

vi.mock("@rakazo/db", () => ({
  awaitCompanyImportConsent: db.awaitCompanyImportConsent,
  CompanyImportError: class CompanyImportError extends Error {},
  claimCompanyImportUnit: db.claimCompanyImportUnit,
  completeCompanyImportUnit: db.completeCompanyImportUnit,
  failCompanyImportUnit: db.failCompanyImportUnit,
  followRealtimeTopic: db.followRealtimeTopic,
  grantCompanyImportConsent: db.grantCompanyImportConsent,
  getCompanyImportProgress: db.getCompanyImportProgress,
  getCompanyImportRunForScheduling: db.getCompanyImportRunForScheduling,
  listCompanyImportUnitsForScheduling: db.listCompanyImportUnitsForScheduling,
  reconcileCompanyImportRunIds: db.reconcileCompanyImportRunIds,
  releaseCompanyImportCall: db.releaseCompanyImportCall,
  reserveCompanyImportCall: db.reserveCompanyImportCall,
  settleCompanyImportCall: db.settleCompanyImportCall,
  startCompanyImportRun: vi.fn(),
  updateCompanyImportRun: vi.fn(),
}));

import { createCompanyImportEngine } from "./company-import-engine.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "owner@example.test",
  isDeploymentOwner: true,
};

const progress: CompanyImportProgress = {
  runId: "run-1",
  status: "running",
  tokenCap: 100,
  reservedTokens: 0,
  inputTokensUsed: 0,
  outputTokensUsed: 0,
  budgetWarning: false,
  counts: { waiting: 1 },
  sources: [],
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-02T03:04:05.000Z",
};

const fact: CompanyImportFact = {
  kind: "entity",
  input: {
    entity: {
      kind: "person",
      displayName: "Synthetic import person",
      attrs: {},
      confidence: 0.8,
    },
    evidence: {
      stance: "supports",
      sourceKind: "data_room",
      sourceItemId: "synthetic-item",
      quote: "Synthetic source quote.",
      contentHash: "synthetic-hash",
      extractedAt: "2026-01-02T03:04:05.000Z",
      extractorModel: null,
      confidence: 0.8,
    },
  },
};

const page: CompanyImportReadPage = {
  items: [
    {
      sourceItemId: "synthetic-item",
      contentHash: "synthetic-hash",
      content: "Synthetic source content.",
    },
  ],
  facts: [fact],
  nextCursor: null,
  done: true,
};

const source = {
  id: "source-1",
  runId: "run-1",
  sourceKind: "data_room",
  connectionId: null,
  scope: {},
  cursor: null,
  run: { status: "running", disclosureVersion: AI_DISCLOSURE_VERSION },
};

function createHarness(options?: {
  revokeConsentAfterReservation?: boolean;
  revokeConsentAfterCall?: boolean;
  changeModelAfterCall?: boolean;
  sourceScope?: Record<string, unknown>;
  ownedItemIds?: string[];
  runStatus?: string;
  runMode?: "sample" | "full";
  readPage?: CompanyImportReadPage;
}) {
  let consentGranted = true;
  let modelId = "synthetic-model";
  let grantedRecipientKey: string | undefined;
  if (options?.revokeConsentAfterReservation) {
    db.reserveCompanyImportCall.mockImplementationOnce(async () => {
      consentGranted = false;
      return { reservationId: "reservation-1", reservedInput: 10, reservedOutput: 5 };
    });
  }
  const invoke = vi.fn(async () => {
    if (options?.revokeConsentAfterCall) consentGranted = false;
    if (options?.changeModelAfterCall) modelId = "changed-model";
    return {
      value: "synthetic-result",
      provider: "synthetic",
      model: "synthetic-model",
      callId: "synthetic-call",
      usage: { inputTokens: 3, outputTokens: 2 },
    };
  });
  const secondInvoke = vi.fn();
  const readCursors: unknown[] = [];
  const worker: CompanyImportWorker = {
    discover: async (): Promise<CompanyImportDiscoveryPage> => ({
      units: [],
      nextCursor: null,
      done: true,
    }),
    read: async (input, context) => {
      readCursors.push(input.cursor);
      await context.executeModelCall({
        inputTokenBound: 10,
        maxOutputTokens: 5,
        invoke,
      });
      secondInvoke();
      return options?.readPage ?? page;
    },
  };
  const prisma = {
    spaceMember: { findUnique: vi.fn(async () => ({ userId: actor.userId })) },
    companySourceBlock: { findFirst: vi.fn(async () => null) },
    companyImportSource: {
      findFirst: vi.fn(async () => ({
        ...source,
        scope: options?.sourceScope ?? source.scope,
        run: { ...source.run, status: options?.runStatus ?? source.run.status },
      })),
    },
    companyImportRun: {
      findFirst: vi.fn(async () => ({ mode: options?.runMode ?? "full" })),
    },
    dataRoomItem: {
      count: vi.fn(async (input: { where: { id: { in: string[] } } }) => {
        const owned = new Set(options?.ownedItemIds ?? []);
        return [...new Set(input.where.id.in)].filter((id) => owned.has(id)).length;
      }),
    },
    aiDataConsent: {
      findUnique: vi.fn(
        async (input: { where: { userId_spaceId_recipientKey: { recipientKey: string } } }) => {
          const recipientKey = input.where.userId_spaceId_recipientKey.recipientKey;
          if (grantedRecipientKey === undefined) grantedRecipientKey = recipientKey;
          return consentGranted && recipientKey === grantedRecipientKey
            ? { version: AI_DISCLOSURE_VERSION }
            : null;
        },
      ),
    },
    companyImportUnit: { findFirst: vi.fn(async () => ({ id: "unit-1" })) },
  } as unknown as PrismaClient;
  const jobs = { enqueue: vi.fn(async () => undefined) } as unknown as JobPublisher;
  const realtime = { publish: vi.fn(async () => undefined) } as unknown as RealtimeFanout;
  const engine = createCompanyImportEngine({
    prisma,
    jobs,
    realtime,
    resolveModel: async () => ({ provider: "synthetic", id: modelId }),
    worker,
  });
  return { engine, invoke, jobs, realtime, secondInvoke, readCursors };
}

describe("company import engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.claimCompanyImportUnit.mockResolvedValue({
      id: "unit-1",
      unitKey: "read:synthetic",
      cursor: null,
      claimToken: "fence-1",
      source,
    });
    db.getCompanyImportProgress.mockResolvedValue(progress);
  });

  it("persists validated facts and their cursor through the fenced completion", async () => {
    const { engine, invoke, jobs, realtime, secondInvoke } = createHarness();

    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(secondInvoke).toHaveBeenCalledTimes(1);
    expect(db.completeCompanyImportUnit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
      expect.objectContaining({
        runId: "run-1",
        sourceId: "source-1",
        unitId: "unit-1",
        claimToken: "fence-1",
        nextCursor: null,
        done: true,
        facts: [fact],
      }),
    );
    expect(jobs.enqueue).toHaveBeenCalledTimes(2);
    expect(realtime.publish).toHaveBeenCalledTimes(1);
  });

  it("pauses nonempty sample reads and unwraps their saved cursor on continue", async () => {
    const savedCursor = { page: "next" };
    const samplePage = { ...page, nextCursor: savedCursor, done: false };
    const sample = createHarness({ runMode: "sample", readPage: samplePage });

    await sample.engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(db.completeCompanyImportUnit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        nextCursor: { companySampleResume: true, cursor: savedCursor },
        done: true,
      }),
    );

    vi.clearAllMocks();
    db.claimCompanyImportUnit.mockResolvedValue({
      id: "unit-1",
      unitKey: "read:synthetic",
      cursor: { companySampleResume: true, cursor: savedCursor },
      claimToken: "fence-2",
      source,
    });
    const full = createHarness({ readPage: page });
    await full.engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });
    expect(full.readCursors).toEqual([savedCursor]);
  });

  it("rejects missing sample continuations and oversized read cursors", async () => {
    const missing = createHarness({
      runMode: "sample",
      readPage: { ...page, nextCursor: null, done: false },
    });
    await missing.engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });
    expect(db.failCompanyImportUnit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ errorCode: "invalid_read_page" }),
    );

    vi.clearAllMocks();
    db.claimCompanyImportUnit.mockResolvedValue({
      id: "unit-1",
      unitKey: "read:synthetic",
      cursor: null,
      claimToken: "fence-1",
      source,
    });
    const undefinedContinuation = createHarness({
      runMode: "sample",
      readPage: { ...page, nextCursor: undefined, done: false },
    });
    await undefinedContinuation.engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });
    expect(db.failCompanyImportUnit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ errorCode: "invalid_read_page" }),
    );

    vi.clearAllMocks();
    db.claimCompanyImportUnit.mockResolvedValue({
      id: "unit-1",
      unitKey: "read:synthetic",
      cursor: null,
      claimToken: "fence-1",
      source,
    });
    const tooLarge = createHarness({
      readPage: {
        ...page,
        nextCursor: { value: "x".repeat(COMPANY_IMPORT_CURSOR_MAX_BYTES) },
        done: false,
      },
    });
    await tooLarge.engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });
    expect(db.failCompanyImportUnit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ errorCode: "cursor_too_large" }),
    );
  });

  it("accepts read cursors larger than the owner scope limit", async () => {
    const nextCursor = { value: "x".repeat(20_000) };
    const { engine } = createHarness({
      readPage: { ...page, nextCursor, done: false },
    });
    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });
    expect(db.completeCompanyImportUnit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ nextCursor, done: false }),
    );
  });

  it("schedules units at the later of their availability and source backoff", async () => {
    const { engine, jobs } = createHarness();
    const now = Date.now();
    const unitAvailableAt = new Date(now + 2_000);
    const sourceBackoffUntil = new Date(now + 5_000);
    const claimedUntil = new Date(now + 8_000);
    db.getCompanyImportRunForScheduling.mockResolvedValue({
      id: "run-1",
      status: "running",
      mode: "full",
    });
    db.listCompanyImportUnitsForScheduling.mockResolvedValue([
      {
        id: "unit-backoff",
        sourceId: "source-1",
        status: "waiting",
        availableAt: unitAvailableAt,
        claimExpiresAt: null,
        source: { backoffUntil: sourceBackoffUntil },
      },
      {
        id: "unit-lease",
        sourceId: "source-1",
        status: "claimed",
        availableAt: unitAvailableAt,
        claimExpiresAt: claimedUntil,
        source: { backoffUntil: sourceBackoffUntil },
      },
    ]);

    await engine.runJob({ spaceId: actor.spaceId, userId: actor.userId, runId: "run-1" });

    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "company.import.unit",
        payload: expect.objectContaining({ unitId: "unit-backoff" }),
        availableAt: sourceBackoffUntil,
      }),
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "company.import.unit",
        payload: expect.objectContaining({ unitId: "unit-lease" }),
        availableAt: claimedUntil,
      }),
    );
  });

  it("does not let a pending lease recovery delay a successful next page", async () => {
    const { engine, jobs } = createHarness();
    const now = new Date();
    const claimExpiresAt = new Date(now.getTime() + 120_000);
    const unit = {
      id: "unit-1",
      sourceId: "source-1",
      availableAt: now,
      source: { backoffUntil: null },
    };
    db.getCompanyImportRunForScheduling.mockResolvedValue({ status: "running" });
    db.listCompanyImportUnitsForScheduling.mockResolvedValue([
      { ...unit, status: "claimed", claimExpiresAt },
    ]);
    const payload = { spaceId: actor.spaceId, userId: actor.userId, runId: "run-1" };
    await engine.runJob(payload);
    db.listCompanyImportUnitsForScheduling.mockResolvedValue([
      { ...unit, status: "waiting", claimExpiresAt: null },
    ]);
    await engine.runJob(payload);
    const [recovery, nextPage] = vi.mocked(jobs.enqueue).mock.calls.map(([job]) => job);
    expect(recovery?.availableAt).toEqual(claimExpiresAt);
    expect(nextPage?.availableAt).toEqual(now);
    expect(nextPage?.replaceKey).not.toEqual(recovery?.replaceKey);
    expect(nextPage?.keepExisting).toBe(true);
  });

  it.each([
    ["consent is revoked", { revokeConsentAfterCall: true }],
    ["the model recipient changes", { changeModelAfterCall: true }],
  ])("blocks another model call when %s", async (_reason, options) => {
    const { engine, invoke, secondInvoke } = createHarness(options);

    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(secondInvoke).not.toHaveBeenCalled();
    expect(db.settleCompanyImportCall).toHaveBeenCalledTimes(1);
    expect(db.completeCompanyImportUnit).not.toHaveBeenCalled();
    expect(db.awaitCompanyImportConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
      expect.objectContaining({
        runId: "run-1",
        sourceId: "source-1",
        unitId: "unit-1",
        claimToken: "fence-1",
      }),
    );
  });

  it("releases a reservation when consent is revoked before invocation", async () => {
    const { engine, invoke } = createHarness({ revokeConsentAfterReservation: true });

    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(db.releaseCompanyImportCall).toHaveBeenCalledTimes(1);
    expect(db.releaseCompanyImportCall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
      expect.objectContaining({
        runId: "run-1",
        sourceId: "source-1",
        unitId: "unit-1",
        claimToken: "fence-1",
        reservationId: "reservation-1",
      }),
    );
    expect(db.settleCompanyImportCall).not.toHaveBeenCalled();
  });

  it("does not start work after the run has been cancelled", async () => {
    const { engine, invoke, secondInvoke } = createHarness({ runStatus: "cancelled" });

    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(secondInvoke).not.toHaveBeenCalled();
    expect(db.reserveCompanyImportCall).not.toHaveBeenCalled();
    expect(db.completeCompanyImportUnit).not.toHaveBeenCalled();
    expect(db.failCompanyImportUnit).toHaveBeenCalledTimes(1);
  });

  it("accepts repeated IDs when every unique data-room item is owned", async () => {
    const { engine, invoke } = createHarness({
      sourceScope: { itemIds: ["owned-item", "owned-item"] },
      ownedItemIds: ["owned-item"],
    });

    await engine.unitJob({
      spaceId: actor.spaceId,
      userId: actor.userId,
      runId: "run-1",
      unitId: "unit-1",
    });

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each(["missing-item", "foreign-item"])(
    "denies a data-room scope containing %s",
    async (itemId) => {
      const { engine, invoke } = createHarness({
        sourceScope: { itemIds: ["owned-item", itemId] },
        ownedItemIds: ["owned-item"],
      });

      await engine.unitJob({
        spaceId: actor.spaceId,
        userId: actor.userId,
        runId: "run-1",
        unitId: "unit-1",
      });

      expect(invoke).not.toHaveBeenCalled();
      expect(db.awaitCompanyImportConsent).toHaveBeenCalledTimes(1);
    },
  );
});
