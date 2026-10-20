import { readFileSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AgentHomeStore,
  AgentRuntime,
  JobPublisher,
  MessagingSurface,
  SandboxProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { createLogger, createTestSink, installLogger } from "@rakazo/logging";
import { describe, expect, it, vi } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { createBackgroundJobHandlers } from "./background-job-handlers.js";
import { syncExchanges } from "./exchange-sync.js";
import { createRunExecutor } from "./executor.js";
import { syncFinanceForUser } from "./finance-sync.js";
import { compactHistory } from "./history-compaction.js";
import { runInboxTriage } from "./inbox-triage.js";
import { deliverMessagingOutbound, mirrorMessagingOutbound } from "./messaging-delivery.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";
import type { EncryptedSecretStore } from "./secrets.js";

vi.mock("./history-compaction.js", () => ({ compactHistory: vi.fn(async () => undefined) }));
vi.mock("./rpc-crypto-sync.js", () => ({
  syncCryptoHoldings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("./exchange-sync.js", () => ({ syncExchanges: vi.fn(async () => []) }));
vi.mock("./finance-sync.js", () => ({ syncFinanceForUser: vi.fn(async () => ({})) }));
vi.mock("./inbox-triage.js", () => ({ runInboxTriage: vi.fn(async () => undefined) }));
vi.mock("./messaging-delivery.js", () => ({
  deliverMessagingOutbound: vi.fn(async () => undefined),
  mirrorMessagingOutbound: vi.fn(async () => undefined),
}));

describe("createBackgroundJobHandlers", () => {
  it("runs the finance sync for the user and space in the job, and refuses without a tool caller", async () => {
    const base = {
      executor: {} as unknown as ReturnType<typeof createRunExecutor>,
      prisma: {} as unknown as PrismaClient,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs: {} as unknown as JobPublisher,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime: {} as unknown as AgentRuntime,
      secretStore: {} as unknown as EncryptedSecretStore,
      memoryProviders: { resolve: vi.fn(async () => null) },
    };
    const payload = { userId: "user-1", spaceId: "space-1" };
    await expect(createBackgroundJobHandlers(base)["finance.sync"](payload)).rejects.toThrow(
      "not configured",
    );
    const financeCallToolFor = vi.fn();
    await createBackgroundJobHandlers({ ...base, financeCallToolFor })["finance.sync"](payload);
    expect(syncFinanceForUser).toHaveBeenCalledWith(
      { prisma: base.prisma, callToolFor: financeCallToolFor },
      { spaceId: "space-1", userId: "user-1" },
    );
    expect(syncCryptoHoldings).toHaveBeenCalledWith(
      { prisma: base.prisma, secrets: base.secretStore },
      { spaceId: "space-1", userId: "user-1" },
    );
    expect(syncExchanges).toHaveBeenCalledWith(
      { prisma: base.prisma, secrets: base.secretStore },
      { spaceId: "space-1", userId: "user-1" },
    );
  });

  it("delivers directly when shutdown rejects a completed run's mirror job", async () => {
    const enqueueError = new Error("Background job publisher is closing");
    const jobs = {
      enqueue: vi.fn(async () => {
        throw enqueueError;
      }),
    } as unknown as JobPublisher;
    const sink = createTestSink();
    installLogger(createLogger({ service: "rakazo-worker", sinks: [sink] }));
    const handlers = createBackgroundJobHandlers({
      executor: {
        continueRun: vi.fn(async () => undefined),
      } as unknown as ReturnType<typeof createRunExecutor>,
      prisma: {} as unknown as PrismaClient,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime: {} as unknown as AgentRuntime,
      secretStore: {} as unknown as EncryptedSecretStore,
      memoryProviders: { resolve: vi.fn(async () => null) },
      messaging: {} as unknown as MessagingSurface,
    });

    await handlers["run.continue"]({ runId: "run-1" });

    expect(mirrorMessagingOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ prisma: expect.anything(), messaging: expect.anything(), jobs }),
      "run-1",
    );
    expect(deliverMessagingOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ prisma: expect.anything(), messaging: expect.anything(), jobs }),
      { runId: undefined },
      expect.objectContaining({ operationId: "messaging.deliver:drain" }),
    );
    expect(sink.events.some((event) => event.message === "messaging.deliver enqueue error")).toBe(
      true,
    );
    installLogger(createLogger({ service: "rakazo-worker", level: "off", sinks: [] }));
  });

  it("compacts the requested thread with the runtime, job publisher, and model key it was given", async () => {
    const prisma = {} as unknown as PrismaClient;
    const runtime = {} as unknown as AgentRuntime;
    const jobs = {} as unknown as JobPublisher;
    const secretStore = {} as unknown as EncryptedSecretStore;
    const memoryProviders = { resolve: vi.fn(async () => null) };
    const resolveModel = vi.fn();
    const handlers = createBackgroundJobHandlers({
      executor: { resolveModel, contextStrategy: "current" } as unknown as ReturnType<
        typeof createRunExecutor
      >,
      prisma,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime,
      secretStore,
      memoryProviders,
      deploymentModelKey: "openrouter-key",
      deploymentModelConfigured: true,
    });

    await handlers["history.compact"]({ threadId: "thread-1" });

    expect(compactHistory).toHaveBeenCalledWith(
      {
        prisma,
        runtime,
        jobs,
        memoryProviders,
        deploymentModelKey: "openrouter-key",
        deploymentModelConfigured: true,
        resolveModel,
      },
      "thread-1",
    );
  });

  it.each([undefined, "retrieval", "snapshots", "cache-aware"] as const)(
    "does not spend on a queued legacy compaction after switching to %s",
    async (contextStrategy) => {
      vi.mocked(compactHistory).mockClear();
      const runtime = { run: vi.fn() } as unknown as AgentRuntime;
      const handlers = createBackgroundJobHandlers({
        executor:
          contextStrategy === undefined
            ? createRunExecutor({ prisma: {} as PrismaClient } as Parameters<
                typeof createRunExecutor
              >[0])
            : ({ contextStrategy } as ReturnType<typeof createRunExecutor>),
        prisma: {} as unknown as PrismaClient,
        sandbox: {} as unknown as SandboxProvider,
        home: {} as unknown as AgentHomeStore,
        jobs: {} as unknown as JobPublisher,
        events: {} as unknown as ThreadEvents,
        workerId: "worker-fixture",
        runtime,
        secretStore: {} as unknown as EncryptedSecretStore,
        memoryProviders: { resolve: vi.fn(async () => null) },
      });

      await handlers["history.compact"]({ threadId: "thread-fixture" });

      expect(compactHistory).not.toHaveBeenCalled();
      expect(runtime.run).not.toHaveBeenCalled();
    },
  );

  it("resolves the deployment model when no user credential is configured", async () => {
    const prisma = {
      spaceModelPreference: { findFirst: vi.fn(async () => null) },
      userModelCredential: { findFirst: vi.fn(async () => null) },
      deploymentSettings: { findUnique: vi.fn(async () => null) },
    } as unknown as PrismaClient;
    const executor = createRunExecutor({
      prisma,
      deploymentModelKey: "deployment-key",
      deploymentModelConfigured: true,
    } as Parameters<typeof createRunExecutor>[0]);

    await expect(
      executor.resolveModel({ userId: "user-1", spaceId: "workspace-1" }),
    ).resolves.toEqual({
      provider: "openrouter",
      id: "openai/gpt-6-luna",
      apiKey: "deployment-key",
      baseUrl: undefined,
      thinkingLevel: null,
      oauth: undefined,
    });
  });

  it("preserves a configured local model when resolving background compaction", async () => {
    const prisma = {
      spaceModelPreference: { findFirst: vi.fn(async () => null) },
      userModelCredential: { findFirst: vi.fn(async () => null) },
      deploymentSettings: {
        findUnique: vi.fn(async () => ({
          defaultModelProvider: "local",
          defaultModelId: "qwen3:4b",
        })),
      },
    } as unknown as PrismaClient;
    const executor = createRunExecutor({
      prisma,
    } as Parameters<typeof createRunExecutor>[0]);

    await expect(
      executor.resolveModel({ userId: "user-1", spaceId: "workspace-1" }),
    ).resolves.toEqual({
      provider: "local",
      id: "qwen3:4b",
      apiKey: undefined,
      baseUrl: undefined,
      thinkingLevel: null,
      oauth: undefined,
    });
  });

  it("runs triage for the payload's user and space with the executor's model resolver", async () => {
    const resolveModel = vi.fn();
    const jobs = {} as unknown as JobPublisher;
    const runtime = {} as unknown as AgentRuntime;
    const prisma = {} as unknown as PrismaClient;
    const handlers = createBackgroundJobHandlers({
      executor: { resolveModel } as unknown as ReturnType<typeof createRunExecutor>,
      prisma,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime,
      secretStore: {} as unknown as EncryptedSecretStore,
      memoryProviders: { resolve: vi.fn(async () => null) },
    });

    await handlers["inbox.triage"]({ userId: "user-1", spaceId: "space-1" });

    expect(runInboxTriage).toHaveBeenCalledExactlyOnceWith(
      { prisma, runtime, jobs, resolveModel, classifier: null },
      { userId: "user-1", spaceId: "space-1" },
    );
  });

  it("gives triage the TypeSafe classifier only when the deployment selects it", async () => {
    vi.stubEnv("RAKAZO_INBOX_CLASSIFIER_PROVIDER", "typesafe");
    vi.stubEnv("TYPESAFE_API_KEY", "ts-key");
    try {
      const handlers = createBackgroundJobHandlers({
        executor: { resolveModel: vi.fn() } as unknown as ReturnType<typeof createRunExecutor>,
        prisma: {} as unknown as PrismaClient,
        sandbox: {} as unknown as SandboxProvider,
        home: {} as unknown as AgentHomeStore,
        jobs: {} as unknown as JobPublisher,
        events: {} as unknown as ThreadEvents,
        workerId: "worker-1",
        runtime: {} as unknown as AgentRuntime,
        secretStore: {} as unknown as EncryptedSecretStore,
        memoryProviders: { resolve: vi.fn(async () => null) },
      });

      await handlers["inbox.triage"]({ userId: "user-1", spaceId: "space-1" });

      const [deps] = vi.mocked(runInboxTriage).mock.lastCall ?? [];
      expect(deps?.classifier?.describe().id).toBe("typesafe");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("dataroom.blob.delete", () => {
  it("removes the blob in the job's space and treats a missing blob as success", async () => {
    let rowExists = true;
    const root = await mkdtemp(path.join(tmpdir(), "dr-blob-"));
    const artifacts = new LocalArtifactStore(root);
    const stored = await artifacts.put(
      { name: "a.txt", mimeType: "text/plain", bytes: new Uint8Array([1]) },
      {
        operationId: "t",
        traceId: "t",
        spaceId: "space-1",
        userId: "u",
        signal: new AbortController().signal,
      },
    );
    const base = {
      executor: {},
      prisma: { dataRoomItem: { findFirst: async () => (rowExists ? { id: "i" } : null) } },
      sandbox: {},
      home: {},
      jobs: {},
      events: {},
      workerId: "w",
      runtime: {},
      secretStore: {},
      memoryProviders: { resolve: vi.fn(async () => null) },
    } as unknown as Parameters<typeof createBackgroundJobHandlers>[0];
    const handlers = createBackgroundJobHandlers({ ...base, artifacts });
    const payload = { spaceId: "space-1", storageKey: stored.id };
    // The row is still there: fail so the queue retries, and keep the blob.
    await expect(handlers["dataroom.blob.delete"](payload)).rejects.toThrow(
      "Data room item still references this blob",
    );
    expect(await readdir(path.join(root, "artifacts", "space-1"))).toHaveLength(1);
    rowExists = false;
    await handlers["dataroom.blob.delete"](payload);
    expect(await readdir(path.join(root, "artifacts", "space-1"))).toEqual([]);
    await expect(handlers["dataroom.blob.delete"](payload)).resolves.toBeUndefined();
    await expect(
      createBackgroundJobHandlers(base)["dataroom.blob.delete"](payload),
    ).rejects.toThrow("not configured");
    await rm(root, { recursive: true, force: true });
  });
});

describe("zip unpack wiring", () => {
  it("the unpack job fails clearly without an artifact store, and runs with one", async () => {
    const base = {
      executor: {} as unknown as ReturnType<typeof createRunExecutor>,
      prisma: {} as unknown as PrismaClient,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs: {} as unknown as JobPublisher,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime: {} as unknown as AgentRuntime,
      secretStore: {} as unknown as EncryptedSecretStore,
      memoryProviders: { resolve: vi.fn(async () => null) },
    };
    const payload = {
      spaceId: "s",
      userId: "u",
      storageKey: "k",
      size: 1,
      entries: 1,
      importId: "i",
      name: "a.zip",
      source: "upload" as const,
      folderId: null,
    };
    await expect(createBackgroundJobHandlers(base)["dataroom.zip.unpack"](payload)).rejects.toThrow(
      "Zip import is not configured",
    );
    // Every process that runs jobs passes the store: a missing one would fail queued unpacks.
    for (const entry of ["../../../apps/api/src/app.ts", "../../../apps/worker/src/index.ts"]) {
      const source = readFileSync(new URL(entry, import.meta.url), "utf8");
      expect(source, entry).toMatch(/createBackgroundJobHandlers\([\s\S]*?artifacts/);
    }
  });
});

describe("Box import wiring", () => {
  it("the Box file job needs the Box token reader, and the worker and API both pass it", async () => {
    const base = {
      executor: {} as unknown as ReturnType<typeof createRunExecutor>,
      prisma: {} as unknown as PrismaClient,
      sandbox: {} as unknown as SandboxProvider,
      home: {} as unknown as AgentHomeStore,
      jobs: {} as unknown as JobPublisher,
      events: {} as unknown as ThreadEvents,
      workerId: "worker-1",
      runtime: {} as unknown as AgentRuntime,
      secretStore: {} as unknown as EncryptedSecretStore,
      memoryProviders: { resolve: vi.fn(async () => null) },
      artifacts: {} as never,
    };
    const payload = {
      spaceId: "s",
      userId: "u",
      connectionId: "c",
      externalId: "1",
      folderId: null,
    };
    await expect(createBackgroundJobHandlers(base)["dataroom.box.file"](payload)).rejects.toThrow(
      "Box import is not configured",
    );
    // Every process that runs jobs builds its own handlers: a missing argument fails queued files.
    for (const entry of ["../../../apps/api/src/app.ts", "../../../apps/worker/src/index.ts"]) {
      const source = readFileSync(new URL(entry, import.meta.url), "utf8");
      expect(source, entry).toMatch(/createBackgroundJobHandlers\([\s\S]*?boxAccessToken\(/);
    }
  });
});
