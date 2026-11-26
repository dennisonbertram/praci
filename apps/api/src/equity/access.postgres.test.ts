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

describePostgres("equity access procedures (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `eqa-org-${suffix}`;
  const spaceId = `eqa-space-${suffix}`;
  const userId = `eqa-user-${suffix}`;
  const otherUserId = `eqa-other-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  const otherActor: Actor = { ...actor, userId: otherUserId, email: `${otherUserId}@example.test` };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const api = (who: Actor = actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }).equity as unknown as {
      savedViews: {
        list(
          input: Record<string, unknown>,
        ): Promise<{ total: number; items: Array<{ id: string; name: string }> }>;
        get(input: { id: string }): Promise<{ id: string; name: string }>;
        create(input: Record<string, unknown>): Promise<{ id: string; name: string }>;
        update(input: Record<string, unknown>): Promise<{ id: string; name: string }>;
      };
      accessGroups: {
        list(): Promise<Array<{ key: string; level: string }>>;
        set(input: { key: string; level: string }): Promise<{ key: string; level: string }>;
      };
      accessGrants: {
        list(input: Record<string, unknown>): Promise<{ total: number }>;
        set(input: Record<string, unknown>): Promise<{ id: string }>;
      };
      healthFindings: {
        create(input: Record<string, unknown>): Promise<{ id: string; status: string }>;
      };
    };
  const as = <T>(who: Actor, fn: () => Promise<T>) =>
    runAsTenant({ spaceId: who.spaceId, userId: who.userId }, fn);

  beforeAll(() =>
    runAsSystem("access api fixture", async () => {
      admin = createDb(ownerUrl as string);
      app = createDb(runtimeUrl as string);
      for (const id of [userId, otherUserId])
        await admin.prisma.user.create({
          data: { id, name: id, email: `${id}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
      for (const id of [userId, otherUserId])
        await admin.prisma.member.create({
          data: {
            id: `eqa-m-${id}`,
            organizationId: orgId,
            userId: id,
            role: "member",
            createdAt: new Date(),
          },
        });
    }),
  );
  afterAll(async () => {
    await runAsSystem("access api cleanup", async () => {
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });
    await app.prisma.$disconnect();
    await app.pool.end();
    await admin.prisma.$disconnect();
    await admin.pool.end();
  });

  it("saves, reads and updates a view, and refuses duplicates", async () => {
    const view = await as(actor, () =>
      api().savedViews.create({
        page: "stakeholders",
        name: "Example employees",
        params: "relationship=employee",
      }),
    );
    expect(view.name).toBe("Example employees");
    const page = await as(actor, () =>
      api().savedViews.list({ pageSize: 10, page: "stakeholders" }),
    );
    expect(page.items.map((row) => row.id)).toContain(view.id);
    const got = await as(actor, () => api().savedViews.get({ id: view.id }));
    expect(got.id).toBe(view.id);
    const updated = await as(actor, () => api().savedViews.update({ id: view.id, name: "Team" }));
    expect(updated.name).toBe("Team");
    await expect(
      as(actor, () =>
        api().savedViews.create({
          page: "stakeholders",
          name: "Team",
          params: "x=1",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("answers NOT_FOUND for another user's view and BAD_REQUEST for a bad grant reference", async () => {
    const view = await as(actor, () =>
      api().savedViews.create({ page: "overview", name: "Mine", params: "" }),
    );
    await expect(
      as(otherActor, () => api(otherActor).savedViews.get({ id: view.id })),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      as(actor, () => api().accessGrants.set({ stakeholderId: "missing-id", level: "basic" })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists the five default groups and records a health finding", async () => {
    const groups = await as(actor, () => api().accessGroups.list());
    expect(groups.map((group) => group.key)).toEqual([
      "founders",
      "investors",
      "employees",
      "former_employees",
      "other",
    ]);
    const set = await as(actor, () =>
      api().accessGroups.set({ key: "investors", level: "advanced" }),
    );
    expect(set).toMatchObject({ key: "investors", level: "advanced" });
    const grants = await as(actor, () => api().accessGrants.list({ page: 1, pageSize: 10 }));
    expect(grants.total).toBe(0);
    const finding = await as(actor, () =>
      api().healthFindings.create({
        check: "missing_share_class",
        tag: "share_classes",
        severity: "required",
        fingerprint: "api-fp",
      }),
    );
    expect(finding.status).toBe("open");
  });
});
