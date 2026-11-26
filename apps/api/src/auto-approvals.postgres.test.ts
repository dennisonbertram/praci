import type { PrismaClient } from "@rakazo/db";
import { createDb, listPastDecisions, recordApprovalDecision } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { listAutoApprovalRows, undoAutoApproval } from "./auto-approvals.js";
import type { Actor } from "./rpc-context.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("Approved automatically (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const org = `aal-org-${suffix}`;
  const users = [`aal-a-${suffix}`, `aal-b-${suffix}`];
  const spaces = [`aal-s1-${suffix}`, `aal-s2-${suffix}`];
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const actor = (space = 0, user = 0) =>
    ({ spaceId: spaces[space]!, userId: users[user]! }) as Actor;

  /** One run in a space that archived `target` and was approved automatically. */
  async function autoArchive(space: number, user: number, target: string) {
    const scope = { spaceId: spaces[space]!, userId: users[user]! };
    const bot = await prisma.bot.create({ data: { ...scope, name: "Mercury", color: "blue" } });
    const thread = await prisma.thread.create({ data: { ...scope, botId: bot.id } });
    const task = await prisma.task.create({
      data: { ...scope, botId: bot.id, threadId: thread.id, prompt: "p", status: "done" },
    });
    const run = await prisma.run.create({
      data: {
        ...scope,
        botId: bot.id,
        threadId: thread.id,
        taskId: task.id,
        status: "succeeded",
        trigger: "user",
      },
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: scope.spaceId,
        runId: run.id,
        kind: "archive_bot",
        idempotencyKey: `aal-${run.id}`,
        status: "applied",
        request: { botId: target },
      },
    });
    const decision = await recordApprovalDecision(prisma, {
      ...scope,
      botId: bot.id,
      runId: run.id,
      effectId: effect.id,
      tool: "archive_bot",
      targetKey: `archive_bot:${target}`,
      decision: "auto_approved",
      basis: "precedent",
      decidedByUserId: null,
      cleanRun: true,
      tier: "reversible",
      argsShape: { keys: ["botId"], size: 1 },
      version: 1,
    });
    return { bot, decision };
  }

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_MIGRATION_URL || databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of users)
      await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    await prisma.organization.create({
      data: { id: org, name: "Org", slug: org, createdAt: new Date() },
    });
    for (const id of spaces)
      await prisma.space.create({ data: { id, organizationId: org, name: "S", isDefault: false } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await close();
  });

  it("lists only the caller's rows in the caller's space, and Undo resets precedent", async () => {
    const scope = { spaceId: spaces[0]!, userId: users[0]! };
    const archived = await prisma.bot.create({
      data: { ...scope, name: "Old helper", color: "blue", archivedAt: new Date() },
    });
    const mine = await autoArchive(0, 0, archived.id);
    const otherUser = await autoArchive(0, 1, archived.id);
    const otherSpace = await autoArchive(1, 0, archived.id);

    const rows = await listAutoApprovalRows(prisma, actor());
    expect(rows).toEqual([
      expect.objectContaining({
        id: mine.decision.id,
        tool: "archive_bot",
        botName: "Mercury",
        target: "Old helper",
        undoable: true,
        undone: false,
      }),
    ]);

    const deps = {
      prisma,
      undoMail: vi.fn(),
      restoreBot: async (_actor: Actor, botId: string) => {
        await prisma.bot.update({ where: { id: botId }, data: { archivedAt: null } });
      },
    };
    // Another user's or another space's row cannot be undone by id.
    for (const id of [otherUser.decision.id, otherSpace.decision.id])
      await expect(undoAutoApproval(deps, actor(), id)).rejects.toThrow("Approval not found");

    await undoAutoApproval(deps, actor(), mine.decision.id);
    expect((await prisma.bot.findUnique({ where: { id: archived.id } }))?.archivedAt).toBeNull();
    const [row] = await listAutoApprovalRows(prisma, actor());
    expect(row).toMatchObject({ undone: true, undoable: false });
    const history = await listPastDecisions(prisma, {
      ...scope,
      botId: mine.bot.id,
      tool: "archive_bot",
      targetKey: `archive_bot:${archived.id}`,
    });
    expect(history[0]?.decision).toBe("undone");
  });

  it("deletes a user's decisions with their account", async () => {
    expect(await prisma.approvalDecision.count({ where: { userId: users[1]! } })).toBeGreaterThan(
      0,
    );
    await prisma.user.delete({ where: { id: users[1]! } });
    expect(await prisma.approvalDecision.count({ where: { userId: users[1]! } })).toBe(0);
  });
});
