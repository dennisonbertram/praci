import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("equity securities API (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `eqsec-org-${suffix}`;
  const spaceId = `eqsec-space-${suffix}`;
  const userId = `eqsec-user-${suffix}`;
  const otherId = `eqsec-other-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  const otherActor: Actor = {
    userId: otherId,
    spaceId: `eqsec-space-b-${suffix}`,
    email: `${otherId}@example.test`,
    isDeploymentOwner: false,
  };
  let owner: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const as = <T>(who: Actor, fn: () => Promise<T>) =>
    runAsTenant({ spaceId: who.spaceId, userId: who.userId }, fn);
  const api = (who: Actor = actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }).equity as unknown as {
      stakeholders: {
        create(input: { type: "individual"; name: string }): Promise<{ id: string }>;
      };
      certificates: {
        create(input: Record<string, unknown>): Promise<{ id: string; label: string }>;
        get(input: { id: string }): Promise<{ id: string }>;
        list(input: Record<string, unknown>): Promise<{ total: number }>;
      };
    };

  beforeAll(async () => {
    owner = createDb(ownerUrl!);
    app = createDb(runtimeUrl!);
    await owner.prisma.user.createMany({
      data: [userId, otherId].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await owner.prisma.organization.create({
      data: { id: orgId, name: "Securities Org", slug: orgId, createdAt: new Date() },
    });
    await owner.prisma.space.createMany({
      data: [actor.spaceId, otherActor.spaceId].map((id) => ({
        id,
        organizationId: orgId,
        name: id,
      })),
    });
  });
  afterAll(async () => {
    await owner.prisma.organization.deleteMany({ where: { id: orgId } });
    await owner.prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await owner.prisma.$disconnect();
    await app.prisma.$disconnect();
  });

  it("creates and reads a certificate, and answers its refusals", async () => {
    const mine = api();
    const stakeholder = await as(actor, () =>
      mine.stakeholders.create({ type: "individual", name: "Ada Example" }),
    );
    const shareClass = await runAsSystem("test fixture", () =>
      owner.prisma.equityShareClass.create({
        data: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          name: "Common",
          prefix: "CS",
          classType: "common",
        },
      }),
    );
    await runAsSystem("test fixture", () =>
      owner.prisma.equityShareClassVersion.create({
        data: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          shareClassId: shareClass.id,
          documentDate: new Date("2024-01-01T00:00:00.000Z"),
          authorizedShares: 1000n,
        },
      }),
    );
    const input = {
      stakeholderId: stakeholder.id,
      shareClassId: shareClass.id,
      quantity: "100",
      issueDate: "2024-01-15",
    };
    const created = await as(actor, () => mine.certificates.create(input));
    expect(created.label).toBe("CS-1");
    expect(await as(actor, () => mine.certificates.get({ id: created.id }))).toMatchObject({
      id: created.id,
    });
    const list = await as(actor, () => mine.certificates.list({}));
    expect(list.total).toBe(1);

    await expect(
      as(otherActor, () => api(otherActor).certificates.get({ id: created.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(actor, () => mine.certificates.create({ ...input, stakeholderId: "missing" })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as(actor, () => mine.certificates.create({ ...input, label: "CS-1" })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
