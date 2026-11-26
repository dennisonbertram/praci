import { createRouterClient } from "@orpc/server";
import { listPiCatalog } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("connecting a model provider (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `mcd-${name}-${suffix}`;
  const orgId = id("org");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const userId = id("user");
  const inSpace = (spaceId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const secretText = new Map<string, string>();
  let n = 0;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const client = (spaceId: string) =>
    createRouterClient(
      createRouter({
        prisma,
        env: {},
        secrets: {
          put: async (plaintext: string) => {
            const secretId = id(`secret-${n++}`);
            secretText.set(secretId, plaintext);
            return { id: secretId, ciphertext: secretId };
          },
          load: async (ciphertext: string) => secretText.get(ciphertext) ?? "",
        },
      } as unknown as RouterDeps),
      { context: { actor: inSpace(spaceId) } as never },
    );
  const defaultsIn = async (spaceId: string) =>
    (
      await prisma.spaceModelPreference.findMany({
        where: { spaceId, userId, isDefault: true },
        include: { credential: true },
      })
    ).map((row) => row.credential.provider);
  const openRouterModels = listPiCatalog()
    .filter((entry) => entry.provider === "openrouter")
    .map((entry) => entry.id);

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.member.create({
      data: {
        id: id("member"),
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    for (const spaceId of [spaceA, spaceB]) {
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: "General",
          isDefault: spaceId === spaceA,
        },
      });
    }
    // Joining the organization may already have added a row in the default space.
    await prisma.spaceMember.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    for (const spaceId of [spaceA, spaceB]) {
      await prisma.spaceMember.create({
        data: {
          id: id(`sm-${spaceId}`),
          spaceId,
          organizationId: orgId,
          userId,
          role: "owner",
          createdAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("keeps the existing default when another provider connects or saves", async () => {
    const api = client(spaceA);
    const first = await api.models.connect({ provider: "google", apiKey: "fake-key-a" });
    expect(first.isDefault).toBe(true);

    const second = await api.models.connect({ provider: "mistral", apiKey: "fake-key-b" });
    expect(second.isDefault).toBe(false);
    expect(await defaultsIn(spaceA)).toEqual(["google"]);

    const replaced = await api.models.connect({ provider: "mistral", apiKey: "fake-key-b2" });
    expect(replaced.isDefault).toBe(false);
    expect(await defaultsIn(spaceA)).toEqual(["google"]);

    const limits = await api.models.connect({
      provider: "mistral",
      modelId: second.modelId ?? undefined,
      maxTokens: 1000,
    });
    expect(limits.isDefault).toBe(false);
    expect(await defaultsIn(spaceA)).toEqual(["google"]);

    const again = await api.models.connect({ provider: "google", apiKey: "fake-key-a2" });
    expect(again.isDefault).toBe(true);
    expect(await defaultsIn(spaceA)).toEqual(["google"]);
  });

  it("makes the first connection in another space its default", async () => {
    const connected = await client(spaceB).models.connect({
      provider: "mistral",
      apiKey: "fake-key-b3",
    });
    expect(connected.isDefault).toBe(true);
    expect(await defaultsIn(spaceB)).toEqual(["mistral"]);
    expect(await defaultsIn(spaceA)).toEqual(["google"]);
  });

  it("keeps a provider's chosen model when it signs in again without one", async () => {
    const api = client(spaceA);
    const chosen = openRouterModels[openRouterModels.length - 1]!;
    const connected = await api.models.connect({
      provider: "openrouter",
      apiKey: "fake-key-c",
      modelId: chosen,
    });
    expect(connected.modelId).toBe(chosen);
    const again = await api.models.connect({ provider: "openrouter", apiKey: "fake-key-c2" });
    expect(again.modelId).toBe(chosen);
    expect(again.isDefault).toBe(false);
  });
});
