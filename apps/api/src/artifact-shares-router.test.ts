import { createHash } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function setup(owned: { id: string; rootArtifactId: string | null; mimeType: string } | null) {
  const create = vi.fn().mockResolvedValue({});
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    artifactShare: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create },
  };
  const artifactFindFirst = vi.fn().mockResolvedValue(owned);
  const prisma = {
    artifact: { findFirst: artifactFindFirst },
    artifactShare: {
      findFirst: vi.fn().mockImplementation(async () => ({
        artifactId: "art-1",
        expiresAt: new Date("2026-12-01T00:00:00.000Z"),
        artifact: { version: 2 },
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaClient;
  const deps = {
    prisma,
    env: { webOrigin: "http://127.0.0.1:5173" },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  const client = createRouterClient(createRouter(deps), { context: { actor } });
  return { client, create, artifactFindFirst, prisma };
}

describe("artifactShares router", () => {
  it("returns a fragment-only link whose token matches the stored hash", async () => {
    const { client, create } = setup({ id: "art-1", rootArtifactId: null, mimeType: "text/html" });
    const out = await client.artifactShares.create({ artifactId: "art-1" });
    expect(out.url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/s#[A-Za-z0-9_-]{43}$/);
    const token = out.url.split("#")[1] as string;
    expect(create.mock.calls[0]?.[0].data.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(out.share).toMatchObject({ artifactId: "art-1", version: 2 });
    expect(typeof out.share.expiresAt).toBe("string");
  });

  it("refuses a file type that cannot be shared and writes nothing", async () => {
    const { client, prisma } = setup({
      id: "art-1",
      rootArtifactId: null,
      mimeType: "application/zip",
    });
    await expect(client.artifactShares.create({ artifactId: "art-1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This file type cannot be shared by link.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("answers not found for another owner's artifact, scoped to the caller", async () => {
    const { client, artifactFindFirst } = setup(null);
    for (const call of [
      () => client.artifactShares.get({ artifactId: "art-9" }),
      () => client.artifactShares.create({ artifactId: "art-9" }),
      () => client.artifactShares.revoke({ artifactId: "art-9" }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(artifactFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-9", spaceId: "space-1", userId: "user-1" },
      }),
    );
  });
});
