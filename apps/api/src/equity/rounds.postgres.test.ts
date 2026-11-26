import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

type Round = { id: string; name: string; cashRaisedCents: string };
type DraftSet = { id: string; name: string; status: string };
type Page<T> = { items: T[]; total: number };

describePostgres("equity funding rounds and draft sets API (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `rnd-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const otherUserId = id("other");
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  const other: Actor = { ...actor, userId: otherUserId, email: `${otherUserId}@example.test` };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;

  const api = (who: Actor = actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }).equity as unknown as {
      fundingRounds: {
        list(input?: Record<string, unknown>): Promise<Page<Round>>;
        get(input: { id: string }): Promise<Round>;
        create(input: Record<string, unknown>): Promise<Round>;
        update(input: Record<string, unknown>): Promise<Round>;
      };
      draftSets: {
        list(input?: Record<string, unknown>): Promise<Page<DraftSet>>;
        get(input: { id: string }): Promise<DraftSet>;
        create(input: Record<string, unknown>): Promise<DraftSet>;
        update(input: Record<string, unknown>): Promise<DraftSet>;
      };
    };

  beforeAll(async () => {
    admin = createDb(ownerUrl as string);
    app = createDb(runtimeUrl as string);
    await runAsSystem("rounds fixture", async () => {
      for (const user of [userId, otherUserId])
        await admin.prisma.user.create({
          data: { id: user, name: user, email: `${user}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
    });
  });

  afterAll(async () => {
    await runAsSystem("rounds cleanup", async () => {
      await admin.prisma.equityLedger.deleteMany({ where: { spaceId } });
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });
    await app.prisma.$disconnect();
    await app.pool.end();
    await admin.prisma.$disconnect();
    await admin.pool.end();
  });

  it("creates, updates, lists and scopes funding rounds", async () => {
    const round = await api().fundingRounds.create({
      name: "Seed",
      startDate: "2021-01-01",
      closingDate: "2021-07-15",
    });
    expect(round.cashRaisedCents).toBe("0");
    const updated = await api().fundingRounds.update({ id: round.id, name: "Seed II" });
    expect(updated.name).toBe("Seed II");
    const page = await api().fundingRounds.list({ search: "seed" });
    expect(page.total).toBe(1);
    expect(await api().fundingRounds.get({ id: round.id })).toMatchObject({ name: "Seed II" });

    await expect(api().fundingRounds.get({ id: round.id })).resolves.toBeTruthy();
    await expect(api(other).fundingRounds.get({ id: round.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await api(other).fundingRounds.list({})).total).toBe(0);
  });

  it("answers CONFLICT for a duplicate name and BAD_REQUEST for a bad date", async () => {
    await api().fundingRounds.create({ name: "Bridge", startDate: "2022-01-01" });
    await expect(
      api().fundingRounds.create({ name: "Bridge", startDate: "2022-02-01" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      api().fundingRounds.create({
        name: "Backwards",
        startDate: "2022-05-01",
        endDate: "2022-04-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates and updates draft sets and refuses bad items", async () => {
    const set = await api().draftSets.create({ name: "Batch", securityKind: "convertible" });
    expect(set.status).toBe("draft");
    const renamed = await api().draftSets.update({
      id: set.id,
      expectedRevision: set.revision,
      name: "Batch 2",
    });
    expect(renamed.name).toBe("Batch 2");
    const page = await api().draftSets.list({ status: ["draft"], securityKind: "convertible" });
    expect(page.total).toBe(1);
    await expect(
      api().draftSets.create({
        name: "Broken",
        securityKind: "convertible",
        items: [{ label: "" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api(other).draftSets.get({ id: set.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const discarded = await api().draftSets.update({
      id: set.id,
      expectedRevision: renamed.revision,
      status: "discarded",
    });
    expect(discarded.status).toBe("discarded");
    await expect(
      api().draftSets.update({ id: set.id, expectedRevision: discarded.revision, name: "Nope" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
