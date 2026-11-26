import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimRunLease, RUN_LEASE_MS } from "./executor.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("run lease claim (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `rl-user-${suffix}`, org: `rl-org-${suffix}`, space: `rl-sp-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_MIGRATION_URL || databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: ids.user, name: "Tester", email: `${ids.user}@example.test` },
    });
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: ids.space, organizationId: ids.org, name: "General", isDefault: true },
    });
    botId = (
      await prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.user, name: "Bot", color: "blue" },
      })
    ).id;
    threadId = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.user, botId } })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.delete({ where: { id: ids.user } });
    await close();
  });

  async function makeRun(data: { status: "queued" | "running"; leaseExpiresAt?: Date }) {
    const task = await prisma.task.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        userId: ids.user,
        prompt: "p",
        status: "running",
      },
    });
    return prisma.run.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        taskId: task.id,
        userId: ids.user,
        status: data.status,
        trigger: "user",
        leaseOwner: data.status === "running" ? "worker-a" : null,
        leaseFence: data.status === "running" ? 1 : 0,
        leaseExpiresAt: data.leaseExpiresAt ?? null,
      },
    });
  }

  it("does not let a second worker take a run whose lease is live", async () => {
    const run = await makeRun({ status: "running", leaseExpiresAt: new Date(Date.now() + 30_000) });
    expect(await claimRunLease(prisma, run, "worker-b", 2)).toBe(false);
    const after = await prisma.run.findUniqueOrThrow({ where: { id: run.id } });
    expect(after).toMatchObject({ status: "running", leaseOwner: "worker-a", leaseFence: 1 });
  });

  it("takes a lapsed lease with a higher fence, and only one of two racing workers wins", async () => {
    const run = await makeRun({ status: "running", leaseExpiresAt: new Date(Date.now() - 1_000) });
    const results = await Promise.all([
      claimRunLease(prisma, run, "worker-b", 2),
      claimRunLease(prisma, run, "worker-c", 2),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const after = await prisma.run.findUniqueOrThrow({ where: { id: run.id } });
    expect(after.status).toBe("leased");
    expect(after.leaseFence).toBe(2);
    expect(after.leaseExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + RUN_LEASE_MS);
  });

  it("claims a queued run", async () => {
    const run = await makeRun({ status: "queued" });
    expect(await claimRunLease(prisma, run, "worker-b", 1)).toBe(true);
  });
});
