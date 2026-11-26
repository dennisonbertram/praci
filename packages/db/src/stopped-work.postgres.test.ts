import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { provisionMessagingIdentity } from "./messaging.js";
import { asSystem, runAsSystem } from "./row-security.js";
import { loadStoppedRunWork } from "./stopped-work.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("work kept from stopped runs (PostgreSQL)", () => {
  let prisma: PrismaClient;
  let system: PrismaClient;
  let close: () => Promise<void>;
  let provisioned = false;
  let userId: string;
  let spaceId: string;
  let botId: string;
  let threadId: string;
  const address = `+1555${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`;
  let clock = Date.parse("2026-11-05T10:00:00Z");

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    system = asSystem(prisma);
    close = async () => {
      try {
        await db.prisma.$disconnect();
      } finally {
        await db.pool.end();
      }
    };
    ({ userId, spaceId, botId, threadId } = await runAsSystem("test fixture", () =>
      provisionMessagingIdentity(
        prisma,
        { provider: "sendblue", address },
        { signupsEnabled: undefined, signupAllowlist: undefined },
      ),
    ));
    provisioned = true;
  });

  afterAll(async () => {
    try {
      if (prisma && provisioned) {
        await system.messagingIdentity.deleteMany({ where: { provider: "sendblue", address } });
        await system.organization.deleteMany({ where: { id: spaceId } });
        await system.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await close?.();
    }
  });

  async function makeRun(status: string, extra: Record<string, unknown> = {}) {
    clock += 1_000;
    const task = await system.task.create({
      data: { spaceId, botId, threadId, userId, prompt: "look it up", status },
    });
    return system.run.create({
      data: {
        spaceId,
        botId,
        threadId,
        taskId: task.id,
        userId,
        status,
        trigger: "user",
        createdAt: new Date(clock),
        ...extra,
      },
    });
  }
  const log = (tool: string) => [{ id: "t1", tool, args: "{}", ok: true, result: `${tool} ok` }];

  it("returns a stopped run's results and its stored markers to the run that continues", async () => {
    await makeRun("completed", { goalEvidence: log("before_last_answer") });
    await makeRun("cancelled", {
      goalEvidence: log("web_search"),
      readOutsideContent: true,
      readDesktop: true,
    });
    await makeRun("cancelled", { goalEvidence: log("read_file") });
    const next = await makeRun("running");

    const work = await loadStoppedRunWork(system, {
      spaceId,
      threadId,
      botId,
      userId,
      runId: next.id,
      before: next.createdAt,
    });

    expect(work.runs.map((entries) => entries[0]?.tool)).toEqual(["web_search", "read_file"]);
    expect(work).toMatchObject({ readOutsideContent: true, readDesktop: true, restricted: false });
  });

  it("reports a run-level restriction", async () => {
    await makeRun("completed");
    await makeRun("cancelled", { goalEvidence: log("fetch_page"), externalTaint: true });
    const next = await makeRun("running");
    const work = await loadStoppedRunWork(system, {
      spaceId,
      threadId,
      botId,
      userId,
      runId: next.id,
      before: next.createdAt,
    });
    expect(work.restricted).toBe(true);
    expect(work.runs.flat().map((entry) => entry.tool)).toEqual(["fetch_page"]);
  });
});
