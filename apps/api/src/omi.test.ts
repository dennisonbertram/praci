import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { mountOmiRoutes } from "./omi.js";

const actor = { spaceId: "space-1", userId: "user-1" };

function setup(createError: unknown) {
  const calls: string[] = [];
  const enqueue = vi.fn(async () => {
    calls.push("enqueue");
  });
  const remove = vi.fn(async () => {
    calls.push("remove");
    throw new Error("storage down");
  });
  const prisma = {
    connection: { findFirst: vi.fn(async () => ({ id: "conn-1" })) },
    omiUpload: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => {
        throw createError;
      }),
    },
  };
  const app = new Hono();
  mountOmiRoutes(
    app,
    {
      prisma: prisma as never,
      jobs: { enqueue } as never,
      artifacts: { put: vi.fn(async () => ({ id: "blob-1" })), remove } as never,
    },
    async () => actor as never,
  );
  const upload = () =>
    app.request("/api/omi/records?connectionId=conn-1&firstSeq=0&codec=20&rtcValid=true", {
      method: "POST",
      body: new Uint8Array(444),
    });
  return { upload, enqueue, calls };
}

describe("omi upload cleanup", () => {
  it("queues the blob delete before the best-effort remove when a retry wins the insert", async () => {
    const { upload, enqueue, calls } = setup({ code: "P2002" });
    const response = await upload();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: 1 });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "dataroom.blob.delete",
        payload: { spaceId: actor.spaceId, storageKey: "blob-1" },
      }),
    );
    expect(calls).toEqual(["enqueue", "remove"]);
  });

  it("queues the blob delete and rethrows other insert failures", async () => {
    const { upload, enqueue } = setup(new Error("db down"));
    const response = await upload();
    expect(response.status).toBe(500);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
