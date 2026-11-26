import { createHmac } from "node:crypto";
import { checkFetchUrl, PrivateFragments } from "@rakazo/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { appendRunFragments, loadRunFragments } from "./run-fragments.js";
import { clearEndedRunState } from "./run-secrets.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const hash = (value: string) =>
  createHmac("sha256", "test-key").update(value).digest().subarray(0, 16).toString("hex");

describePostgres("run fragments (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `rf-user-${suffix}`, org: `rf-org-${suffix}`, space: `rf-space-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
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

  async function runningRun() {
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
        status: "running",
        trigger: "user",
        leaseOwner: "worker-a",
        leaseFence: 1,
        fragmentRecord: true,
      },
    });
  }

  it("keeps what a run read across a lease bump, fences old writers, and cleans up", async () => {
    const run = await runningRun();
    const first = new PrivateFragments(hash);
    first.addPrivate("Priya Shah <priya@halcyon.example> will wire $1,250,000 on Friday.");
    const delta = first.takeDelta()!;
    await appendRunFragments(prisma, run, "worker-a", 1, "key1", delta);

    // The run is claimed again under the next fence, as an answered card does.
    await prisma.run.update({
      where: { id: run.id },
      data: { leaseOwner: "worker-b", leaseFence: 2 },
    });
    await expect(appendRunFragments(prisma, run, "worker-a", 1, "key1", delta)).rejects.toThrow(
      "lease expired",
    );

    const rows = await loadRunFragments(prisma, run);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keyId).toBe("key1");
    const next = new PrivateFragments(hash);
    next.restore(rows);
    expect(checkFetchUrl("https://x.test/c?q=1250000", next).verdict).toBe("fragment");
    const encoded = Buffer.from("priya@halcyon.example").toString("base64url");
    expect(checkFetchUrl(`https://x.test/c?d=${encoded}`, next).verdict).toBe("fragment");
    expect(checkFetchUrl("https://docs.python.org/3/library/csv.html", next)).toEqual({
      verdict: "clean",
    });

    // No readable private text in the stored bytes.
    const stored = await prisma.runFragment.findFirstOrThrow({ where: { runId: run.id } });
    const text = Buffer.from(stored.entries).toString("latin1");
    expect(text).not.toContain("1250000");
    expect(text).not.toContain("priya");
    expect(stored.publicWords).toBeNull();

    await clearEndedRunState(prisma, [run.id]);
    expect(await prisma.runFragment.count({ where: { runId: run.id } })).toBe(0);
  });

  it("removes the rows when the run is deleted", async () => {
    const run = await runningRun();
    const f = new PrivateFragments(hash);
    f.addPublic("A public page about the weather today in a small town near the sea");
    await appendRunFragments(prisma, run, "worker-a", 1, "key1", f.takeDelta()!);
    expect(await prisma.runFragment.count({ where: { runId: run.id } })).toBe(1);
    await prisma.run.delete({ where: { id: run.id } });
    expect(await prisma.runFragment.count({ where: { runId: run.id } })).toBe(0);
  });
});
