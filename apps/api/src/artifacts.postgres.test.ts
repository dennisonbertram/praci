import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, IsolationError } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArtifactListCursorError, createOwnedArtifact, listSpaceArtifacts } from "./artifacts.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("artifact upload nonce (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `artifact-nonce-user-${suffix}`;
  const organizationId = `artifact-nonce-org-${suffix}`;
  const spaceId = `artifact-nonce-space-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  };
  const stored = new Set<string>();
  let puts = 0;
  const artifacts = {
    async put() {
      puts += 1;
      const id = `blob-${puts}`;
      stored.add(id);
      return { id };
    },
    async remove(id: string) {
      stored.delete(id);
    },
  } as unknown as ArtifactStore;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let otherBotId: string;
  const upload = (clientNonce: string | undefined, target: { botId: string; groupId?: string }) =>
    createOwnedArtifact({ prisma, artifacts }, actor, {
      ...target,
      name: "notes.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("hello").toString("base64"),
      clientNonce,
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Nonce Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "Chief", color: "blue" } }))
      .id;
    otherBotId = (
      await prisma.bot.create({ data: { spaceId, userId, name: "Scout", color: "green" } })
    ).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("returns the artifact a retried upload already created", async () => {
    const first = await upload("send-1:0", { botId });
    const retry = await upload("send-1:0", { botId });
    expect(retry).toEqual(first);
    expect(await prisma.artifact.count({ where: { spaceId, clientNonce: "send-1:0" } })).toBe(1);
    expect(stored.size).toBe(1);
  });

  it("creates one artifact when two retries of an upload race", async () => {
    const [a, b] = await Promise.all([
      upload("send-2:0", { botId }),
      upload("send-2:0", { botId }),
    ]);
    expect(a.id).toBe(b.id);
    expect(await prisma.artifact.count({ where: { spaceId, clientNonce: "send-2:0" } })).toBe(1);
    expect(stored.size).toBe(2);
  });

  it("replays one artifact when retries of a group upload race under different member bots", async () => {
    const group = await prisma.chatGroup.create({ data: { spaceId, userId, name: "Race" } });
    const uploads = await Promise.all(
      [botId, otherBotId, botId, otherBotId].map((member) =>
        upload("send-5:0", { botId: member, groupId: group.id }),
      ),
    );
    expect(new Set(uploads.map((artifact) => artifact.id)).size).toBe(1);
    expect(await prisma.artifact.count({ where: { spaceId, clientNonce: "send-5:0" } })).toBe(1);
  });

  it("refuses a nonce reused for another chat", async () => {
    await upload("send-3:0", { botId });
    await expect(upload("send-3:0", { botId: otherBotId })).rejects.toBeInstanceOf(IsolationError);
  });
});

describePostgres("artifact search (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `artifact-search-user-${suffix}`;
  const organizationId = `artifact-search-org-${suffix}`;
  const spaceId = `artifact-search-space-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let made = 0;
  const add = (name: string, createdAt: Date, description: string | null = null) => {
    made += 1;
    return prisma.artifact.create({
      data: {
        spaceId,
        userId,
        name,
        description,
        mimeType: "text/markdown",
        size: 1,
        hash: `hash-${suffix}-${made}`,
        storageKey: `key-${suffix}-${made}`,
        createdAt,
      },
    });
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Search Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("listSpace q finds an artifact older than the newest 60 and treats % and _ literally", async () => {
    const now = Date.now();
    const minute = 60_000;
    // Older than the newest sixty, so a page of the newest sixty never shows it.
    await add("Pricing 100% final", new Date(now - 400 * minute), "Older deck");
    await add("Plan A_B", new Date(now - 401 * minute));
    await add("Plan AXB", new Date(now - 402 * minute));
    for (let index = 0; index < 61; index += 1)
      await add(`note-${index}`, new Date(now - index * minute));
    const deps = {
      prisma: prisma as unknown as Pick<PrismaClient, "artifact" | "$queryRaw">,
    };

    const newest = await listSpaceArtifacts(deps, actor, { limit: 60 });
    expect(newest.items).toHaveLength(60);
    expect(newest.items.map((item) => item.name)).not.toContain("Pricing 100% final");

    const percent = await listSpaceArtifacts(deps, actor, { q: "100%", limit: 6 });
    expect(percent.items.map((item) => item.name)).toEqual(["Pricing 100% final"]);
    const underscore = await listSpaceArtifacts(deps, actor, { q: "A_B", limit: 6 });
    expect(underscore.items.map((item) => item.name)).toEqual(["Plan A_B"]);
    // A description hit counts too.
    const described = await listSpaceArtifacts(deps, actor, { q: "older deck", limit: 6 });
    expect(described.items.map((item) => item.name)).toEqual(["Pricing 100% final"]);
    // Another space cannot reach it, and a cursor minted for one query is refused for another.
    const page = await listSpaceArtifacts(deps, actor, { q: "note", limit: 2 });
    expect(page.nextCursor).not.toBeNull();
    await expect(
      listSpaceArtifacts(deps, actor, { q: "plan", cursor: page.nextCursor ?? undefined }),
    ).rejects.toBeInstanceOf(ArtifactListCursorError);
  });
});
