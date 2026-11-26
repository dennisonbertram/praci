import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRunExecutor,
  FakeSandboxProvider,
  LocalAgentHomeStore,
  ScriptedAgentRuntime,
} from "@rakazo/adapters";
import type { Actor, MessageBlock } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos, createThreadEvents } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

/**
 * The classifier end to end: the real executor and scripted runtime over Postgres, with cards
 * answered through answerRunInput as the owner's Allow / Deny buttons do.
 */
describePostgres("automatic approval from precedent (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `aa-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const owner = id("owner");
  const actor: Actor = {
    userId: owner,
    spaceId,
    email: `${owner}@rakazo.test`,
    isDeploymentOwner: false,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let executor: ReturnType<typeof createRunExecutor>;
  let bot: { id: string; threadId: string };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    await prisma.member.create({
      data: {
        id: id("member"),
        organizationId: orgId,
        userId: owner,
        role: "owner",
        createdAt: new Date(),
      },
    });
    // Adding the org member adds the space membership; precedent belongs to the space owner.
    await prisma.spaceMember.updateMany({
      where: { spaceId, userId: owner },
      data: { role: "owner" },
    });
    // Precedent needs Auto Review on; with no checker connected nothing is judged.
    await prisma.actionAutoReviewPreference.create({
      data: { spaceId, userId: owner, enabled: true },
    });
    const created = await createRepos(prisma).createBot(actor, {
      name: "Helper",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    const thread = await prisma.thread.findUniqueOrThrow({ where: { botId: created.id } });
    bot = { id: created.id, threadId: thread.id };
    const executorPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === "deploymentSettings") {
          return {
            ...target.deploymentSettings,
            findUnique: async () => ({
              defaultModelProvider: "scripted",
              defaultModelId: "scripted",
            }),
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    executor = createRunExecutor({
      prisma: executorPrisma,
      runtime: new ScriptedAgentRuntime(),
      connector: { discoverTools: async () => [], close: async () => undefined },
      events: createThreadEvents(prisma),
      jobs: { enqueue: async () => undefined },
      sandbox: new FakeSandboxProvider(),
      home: new LocalAgentHomeStore(mkdtempSync(join(tmpdir(), "auto-approval-"))),
      memory: { read: async () => ({ documents: [] }) },
      memoryProviders: { resolve: async () => null },
      secrets: [],
    } as unknown as Parameters<typeof createRunExecutor>[0]);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.approvalDecision.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: owner } });
    await close();
  });

  /** Starts a run of the owner's prompt and drives it until it finishes or shows a card. */
  const start = async (prompt: string, options: { readOutsideContent?: boolean } = {}) => {
    const task = await prisma.task.create({
      data: {
        spaceId,
        botId: bot.id,
        threadId: bot.threadId,
        userId: owner,
        prompt,
        status: "queued",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId,
        botId: bot.id,
        threadId: bot.threadId,
        taskId: task.id,
        userId: owner,
        status: "queued",
        trigger: "user",
        // An attended chat: the owner is there to answer.
        unattended: false,
        ...(options.readOutsideContent ? { readOutsideContent: true } : {}),
      },
    });
    await executor.continueRun(run.id, "synthetic-worker");
    return run.id;
  };
  const pendingCard = async (runId: string) => {
    for (const message of await prisma.message.findMany({
      where: { threadId: bot.threadId, runId },
    })) {
      const block = (message.blocks as unknown as MessageBlock[]).find(
        (candidate) => candidate.kind === "ask" && candidate.status === "pending",
      );
      if (block) return { messageId: message.id, block };
    }
    return null;
  };
  const answer = async (runId: string, reply: "allow" | "deny") => {
    const card = await pendingCard(runId);
    expect(card).not.toBeNull();
    expect(
      await createThreadEvents(prisma).answerRunInput({
        spaceId,
        threadId: bot.threadId,
        runId,
        messageId: card!.messageId,
        answeredByUserId: owner,
        answer: reply,
      }),
    ).toBe(true);
    await executor.continueRun(runId, "synthetic-worker");
  };
  const status = async (runId: string) =>
    (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).status;
  const decisions = (runId: string) =>
    prisma.approvalDecision.findMany({ where: { runId }, orderBy: { createdAt: "asc" } });

  const archive = "delete the child bot named Scout";

  /** One call that shows a card, answered by the owner. */
  const askedAndAnswered = async (reply: "allow" | "deny") => {
    const runId = await start(archive);
    expect(await status(runId)).toBe("waiting_input");
    await answer(runId, reply);
    expect(await status(runId)).toBe("completed");
    expect((await decisions(runId)).map((row) => row.decision)).toEqual([
      "auto_asked",
      reply === "allow" ? "approved" : "denied",
    ]);
  };

  it("asks until the owner approved 3 times since a denial, then approves automatically", async () => {
    await askedAndAnswered("allow");
    await askedAndAnswered("allow");
    // A denial resets the count: three more approvals are needed.
    await askedAndAnswered("deny");
    await askedAndAnswered("allow");
    await askedAndAnswered("allow");
    await askedAndAnswered("allow");
    const automatic = await start(archive);
    expect(await status(automatic)).toBe("completed");
    expect(await pendingCard(automatic)).toBeNull();
    expect(await decisions(automatic)).toMatchObject([
      {
        decision: "auto_approved",
        basis: "precedent",
        tool: "archive_bot",
        decidedByUserId: null,
        cleanRun: true,
      },
    ]);
    expect(
      await prisma.externalEffect.count({ where: { runId: automatic, kind: "archive_bot" } }),
    ).toBe(1);
  });

  it("still asks in a run that read outside content", async () => {
    const runId = await start(archive, { readOutsideContent: true });
    expect(await status(runId)).toBe("waiting_input");
    expect((await decisions(runId)).map((row) => [row.decision, row.cleanRun])).toEqual([
      ["auto_asked", false],
    ]);
    await answer(runId, "deny");
  });

  it("never approves a hard-line tool automatically", async () => {
    for (let round = 0; round < 4; round += 1) {
      const runId = await start(`create a space named Precedent ${round}`);
      expect(await status(runId)).toBe("waiting_input");
      expect((await decisions(runId)).some((row) => row.decision === "auto_approved")).toBe(false);
      if (round < 3) await answer(runId, "allow");
    }
  });
});
