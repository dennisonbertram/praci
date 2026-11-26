import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { beforeEach, expect, it, vi } from "vitest";

const requeueReady = vi.hoisted(() => vi.fn(async (..._args: unknown[]): Promise<string[]> => []));
const loggerError = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/logging", () => ({ getLogger: () => ({ error: loggerError, warn: vi.fn() }) }));
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  createDataRoomRepos: () => ({ requeueReady }),
  createDataRoomAutoSortRepos: () => ({}),
}));

import { createDataRoomService } from "./data-room.js";

const actor = { userId: "u", spaceId: "space-1" } as Actor;
beforeEach(() => {
  requeueReady.mockReset();
  requeueReady.mockResolvedValue([]);
  loggerError.mockClear();
});
function service(
  opts: {
    enqueue?: () => Promise<unknown>;
    allowed?: boolean;
    embeddingModel?: string | null;
    count?: number;
  } = {},
) {
  const upsert = vi.fn(async () => ({}));
  const enqueue = vi.fn(opts.enqueue ?? (async () => undefined));
  const updateMany = vi.fn(async () => ({ count: opts.count ?? 1 }));
  const svc = createDataRoomService({
    prisma: { aiDataConsent: { upsert }, spaceModelPreference: { updateMany } },
    jobs: { enqueue },
    resolveAi: async () => ({
      model: null,
      embedder: null,
      embeddingModel: opts.embeddingModel ?? null,
      recipients: [{ key: "chat-key", name: "Example", detail: "chat-1" }],
      consentKey: "data-room:k",
      allowed: opts.allowed ?? false,
    }),
  } as never);
  return { svc, upsert, enqueue, updateMany };
}
const grant = { key: "data-room:k", version: DATA_ROOM_DISCLOSURE_VERSION };

it("Documents alone records only the document key, never a model key", async () => {
  const { svc, upsert } = service();
  await svc.consentGrant(actor, { ...grant, spaceId: "space-1", documentsOnly: true });
  expect(
    upsert.mock.calls.map(
      (c) => (c[0] as never as { create: { recipientKey: string } }).create.recipientKey,
    ),
  ).toEqual(["data-room:k"]);
});

it("the combined grant still records the models it disclosed", async () => {
  const { svc, upsert } = service();
  await svc.consentGrant(actor, grant);
  expect(upsert).toHaveBeenCalledTimes(2);
});

it("refuses a stale key, a stale version, and another Space, writing nothing", async () => {
  const { svc, upsert } = service();
  for (const bad of [
    { ...grant, key: "data-room:old" },
    { ...grant, version: "old" },
    { ...grant, spaceId: "space-2" },
  ])
    await expect(svc.consentGrant(actor, { ...bad, documentsOnly: true })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  expect(upsert).not.toHaveBeenCalled();
});

it("consent grant still succeeds and runs every step when an enqueue fails", async () => {
  requeueReady.mockResolvedValue(["a"]);
  const { svc } = service({
    embeddingModel: "embed-b",
    enqueue: async () => {
      throw new Error("queue down");
    },
  });
  await expect(svc.consentGrant(actor, grant)).resolves.toMatchObject({ allowed: true });
  expect(requeueReady.mock.calls.map((c) => c[1])).toEqual(["ingest", "classify", "index"]);
  expect(loggerError).toHaveBeenCalled();
});

it("a new embedding model re-indexes ready items when AI is allowed", async () => {
  requeueReady.mockResolvedValue(["a", "b"]);
  const { svc, enqueue } = service({ allowed: true, embeddingModel: "embed-b" });
  await expect(svc.setEmbeddingModel(actor, { modelId: "embed-b" })).resolves.toEqual({
    modelId: "embed-b",
  });
  expect(requeueReady).toHaveBeenCalledWith(actor, "index", "embed-b", expect.anything());
  expect(enqueue).toHaveBeenCalledTimes(2);
});

it("does not re-index when not allowed, the model is cleared, or nothing was updated", async () => {
  await service({ allowed: false, embeddingModel: "embed-b" }).svc.setEmbeddingModel(actor, {
    modelId: "embed-b",
  });
  await service({ allowed: true, embeddingModel: "embed-b" }).svc.setEmbeddingModel(actor, {
    modelId: null,
  });
  await expect(
    service({ allowed: true, embeddingModel: "embed-b", count: 0 }).svc.setEmbeddingModel(actor, {
      modelId: "embed-b",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(requeueReady).not.toHaveBeenCalled();
});

it("still returns the model when re-indexing fails", async () => {
  requeueReady.mockResolvedValue(["a"]);
  const { svc } = service({
    allowed: true,
    embeddingModel: "embed-b",
    enqueue: async () => {
      throw new Error("queue down");
    },
  });
  await expect(svc.setEmbeddingModel(actor, { modelId: "embed-b" })).resolves.toEqual({
    modelId: "embed-b",
  });
  expect(loggerError).toHaveBeenCalled();
});
