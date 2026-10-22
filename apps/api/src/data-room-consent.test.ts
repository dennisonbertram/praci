import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { expect, it, vi } from "vitest";

vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  createDataRoomRepos: () => ({ requeueReady: async () => [] }),
  createDataRoomAutoSortRepos: () => ({}),
}));

import { createDataRoomService } from "./data-room.js";

const actor = { userId: "u", spaceId: "space-1" } as Actor;
function service() {
  const upsert = vi.fn(async () => ({}));
  const svc = createDataRoomService({
    prisma: { aiDataConsent: { upsert } },
    jobs: { enqueue: async () => undefined },
    resolveAi: async () => ({
      model: null,
      embedder: null,
      embeddingModel: null,
      recipients: [{ key: "chat-key", name: "Example", detail: "chat-1" }],
      consentKey: "data-room:k",
      allowed: false,
    }),
  } as never);
  return { svc, upsert };
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
