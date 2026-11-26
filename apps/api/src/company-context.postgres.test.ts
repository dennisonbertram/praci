import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { COMPANY_SECTION_MAX_BYTES, COMPANY_SECTION_MAX_COUNT } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { MarkdownMemoryStore } from "@rakazo/memory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company context (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `cc-org-${suffix}`;
  const spaceA = `cc-space-a-${suffix}`;
  const spaceB = `cc-space-b-${suffix}`;
  const alice: Actor = {
    spaceId: spaceA,
    userId: `cc-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `cc-bob-${suffix}`, email: "b@example.test" };
  const aliceInB: Actor = { ...alice, spaceId: spaceB };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const clientFor = (actor: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        memory: new MarkdownMemoryStore(prisma),
        env: { mailWritesDisabled: false },
      } as unknown as RouterDeps),
      { context: { actor } },
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "CC Org", slug: organizationId, createdAt: new Date() },
    });
    for (const id of [spaceA, spaceB]) {
      await prisma.space.create({ data: { id, organizationId, name: id } });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    } finally {
      await close();
    }
  });

  it("starts empty and keeps each user and space apart", async () => {
    const mine = clientFor(alice).companyContext;
    expect(await mine.list()).toEqual([]);
    const saved = await mine.save({ title: "Acme Widget", text: "Makes widgets. More text." });
    expect(saved).toMatchObject({
      slug: "acme-widget",
      title: "Acme Widget",
      summary: "Makes widgets.",
      revision: 1,
    });
    expect(await mine.list()).toHaveLength(1);
    expect(await clientFor(bob).companyContext.list()).toEqual([]);
    expect(await clientFor(aliceInB).companyContext.list()).toEqual([]);
    // Another user or space cannot edit, read the history of, restore or delete it by id.
    for (const other of [clientFor(bob), clientFor(aliceInB)]) {
      await expect(
        other.companyContext.save({ id: saved.id, title: "Acme Widget", text: "Changed." }),
      ).rejects.toThrow();
      await expect(other.companyContext.history({ id: saved.id })).rejects.toThrow();
      await expect(
        other.companyContext.restore({ id: saved.id, revision: 1, expectedRevision: 1 }),
      ).rejects.toThrow();
      await expect(other.companyContext.remove({ id: saved.id, revision: 1 })).rejects.toThrow();
    }
    expect((await mine.list())[0]?.text).toBe("Makes widgets. More text.");
    // Both users may use the same name.
    await clientFor(bob).companyContext.save({ title: "Acme Widget", text: "Bob's own." });
  });

  it("keeps sections out of the memory procedures and refuses to change them there", async () => {
    const client = clientFor(alice);
    const [section] = await client.companyContext.list();
    expect(await client.memory.list({})).toEqual([]);
    expect(await client.memory.list({ scope: "user" })).toEqual([]);
    await expect(
      client.memory.update({ documentId: section!.id, content: "overwritten" }),
    ).rejects.toThrow();
    await expect(
      client.memory.remove({ documentId: section!.id, revision: section!.revision }),
    ).rejects.toThrow();
    expect((await client.companyContext.list())[0]?.text).toBe("Makes widgets. More text.");
  });

  it("is not returned by a memory search over all scopes", async () => {
    const store = new MarkdownMemoryStore(prisma);
    const context = {
      operationId: "t",
      traceId: "t",
      spaceId: alice.spaceId,
      userId: alice.userId,
      signal: new AbortController().signal,
    };
    expect(await store.search({ query: "widgets", scope: "all" }, context)).toEqual([]);
    expect(await store.search({ query: "widgets", scope: "company" }, context)).toHaveLength(1);
  });

  it("records revisions, restores one as a new revision, and refuses a stale save", async () => {
    const client = clientFor(alice).companyContext;
    const [first] = await client.list();
    const second = await client.save({
      id: first!.id,
      title: "Acme Widget",
      text: "Now it makes gadgets.",
      expectedRevision: 1,
    });
    expect(second.revision).toBe(2);
    await expect(
      client.save({ id: first!.id, title: "Acme Widget", text: "Late.", expectedRevision: 1 }),
    ).rejects.toThrow(/changed/);
    const history = await client.history({ id: first!.id });
    expect(history.map((row) => [row.revision, row.text])).toEqual([
      [2, "Now it makes gadgets."],
      [1, "Makes widgets. More text."],
    ]);
    const restored = await client.restore({ id: first!.id, revision: 1, expectedRevision: 2 });
    expect(restored).toMatchObject({ revision: 3, text: "Makes widgets. More text." });
    expect(await client.history({ id: first!.id })).toHaveLength(3);
  });

  it("refuses a taken name, an empty section, and text over the limit", async () => {
    const client = clientFor(alice).companyContext;
    await expect(client.save({ title: "acme widget", text: "Again." })).rejects.toThrow(/taken/);
    await expect(client.save({ title: "Empty", text: "  " })).rejects.toThrow();
    await expect(
      client.save({ title: "Big", text: "x".repeat(COMPANY_SECTION_MAX_BYTES) }),
    ).rejects.toThrow(/long/);
    expect(await client.list()).toHaveLength(1);
  });

  it("holds at most the section count", async () => {
    const client = clientFor(aliceInB).companyContext;
    for (let i = 0; i < COMPANY_SECTION_MAX_COUNT; i += 1) {
      await client.save({ title: `Topic ${i}`, text: "Text." });
    }
    await expect(client.save({ title: "One more", text: "Text." })).rejects.toThrow(/full/);
  });

  it("lets only one of two concurrent creates take the last place", async () => {
    const client = clientFor(bob).companyContext;
    const existing = (await client.list()).length;
    for (let i = existing; i < COMPANY_SECTION_MAX_COUNT - 1; i += 1) {
      await client.save({ title: `Filler ${i}`, text: "Text." });
    }
    const results = await Promise.allSettled([
      client.save({ title: "Race one", text: "Text." }),
      client.save({ title: "Race two", text: "Text." }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await client.list()).toHaveLength(COMPANY_SECTION_MAX_COUNT);
  });

  it("refuses an update that does not say which revision it started from", async () => {
    const client = clientFor(alice).companyContext;
    const [first] = await client.list();
    await expect(
      client.save({ id: first!.id, title: first!.title, text: "Blind overwrite." }),
    ).rejects.toThrow(/Reload/);
  });

  it("creates a section on a one-connection pool", async () => {
    const small = createDb(databaseUrl!, { poolMax: 1 });
    try {
      const dave: Actor = { ...alice, userId: `cc-dave-${suffix}` };
      const client = createRouterClient(
        createRouter({
          prisma: small.prisma,
          memory: new MarkdownMemoryStore(small.prisma),
          env: { mailWritesDisabled: false },
        } as unknown as RouterDeps),
        { context: { actor: dave } },
      ).companyContext;
      const saved = await client.save({ title: "Pool", text: "One connection." });
      expect(saved).toMatchObject({ slug: "pool", revision: 1 });
      expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);
      expect(await client.history({ id: saved.id })).toHaveLength(1);
    } finally {
      await small.prisma.$disconnect();
      await small.pool.end();
    }
  });

  it("follows current titles when checking names", async () => {
    const client = clientFor({ ...alice, userId: `cc-carol-${suffix}` }).companyContext;
    const acme = await client.save({ title: "Acme", text: "First." });
    await client.save({
      id: acme.id,
      title: "Acme Corp",
      text: "First.",
      expectedRevision: 1,
    });
    const again = await client.save({ title: "Acme", text: "Second." });
    expect(again.slug).toBe("acme-2");
    await expect(client.save({ title: "ACME", text: "Third." })).rejects.toThrow(/taken/);

    const alpha = await client.save({ title: "Alpha", text: "A." });
    const beta = await client.save({ title: "Beta", text: "B." });
    await expect(
      client.save({ id: beta.id, title: "ALPHA", text: "B.", expectedRevision: 1 }),
    ).rejects.toThrow(/taken/);
    // A case-only rename of the section itself is fine.
    expect(
      await client.save({ id: alpha.id, title: "ALPHA", text: "A.", expectedRevision: 1 }),
    ).toMatchObject({ title: "ALPHA", revision: 2 });

    const gamma = await client.save({ title: "Gamma", text: "G." });
    await client.save({ id: gamma.id, title: "Gamma Two", text: "G.", expectedRevision: 1 });
    expect(await client.save({ title: "Gamma", text: "New." })).toMatchObject({
      slug: "gamma-2",
    });
    await expect(
      client.restore({ id: gamma.id, revision: 1, expectedRevision: 2 }),
    ).rejects.toThrow(/taken/);
  });

  it("keeps a suffixed slug within the length limit", async () => {
    const client = clientFor({ ...alice, userId: `cc-frank-${suffix}` }).companyContext;
    const long = "a".repeat(60);
    const first = await client.save({ title: long, text: "One." });
    await client.save({ id: first.id, title: "Renamed", text: "One.", expectedRevision: 1 });
    const second = await client.save({ title: long, text: "Two." });
    expect(second.slug).toHaveLength(60);
    expect(second.slug.endsWith("-2")).toBe(true);
  });

  it("lists at most the newest 50 revisions", async () => {
    const client = clientFor({ ...alice, userId: `cc-erin-${suffix}` }).companyContext;
    const saved = await client.save({ title: "Busy", text: "v1." });
    for (let revision = 1; revision < 52; revision += 1) {
      await client.save({
        id: saved.id,
        title: "Busy",
        text: `v${revision + 1}.`,
        expectedRevision: revision,
      });
    }
    const history = await client.history({ id: saved.id });
    expect(history).toHaveLength(50);
    expect(history[0]?.revision).toBe(52);
    expect(history[49]?.revision).toBe(3);
  });

  it("makes a deleted section disappear, with its history", async () => {
    const client = clientFor(alice).companyContext;
    const [section] = await client.list();
    await expect(client.remove({ id: section!.id, revision: 1 })).rejects.toThrow(/changed/);
    await client.remove({ id: section!.id, revision: section!.revision });
    expect(await client.list()).toEqual([]);
    expect(await prisma.memoryRevision.count({ where: { documentId: section!.id } })).toBe(0);
  });
});
