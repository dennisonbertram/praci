import { argsShapeOf, classifyAction } from "@rakazo/core/node/action-classifier";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isSpaceOwner,
  lastToolUndo,
  listAutoApprovals,
  listPastDecisions,
  pruneApprovalDecisions,
  recordApprovalDecision,
  recordUndoneApproval,
} from "./approval-decisions.js";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("approval decisions (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const users = [`apd-user-a-${suffix}`, `apd-user-b-${suffix}`];
  const spaces = [`apd-space-a-${suffix}`, `apd-space-b-${suffix}`];
  const org = `apd-org-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const args = { pageId: "p1", text: "hello" };
  const scope = (i = 0, j = 0, botId = "bot-1") => ({
    spaceId: spaces[i]!,
    userId: users[j]!,
    botId,
  });
  const key = { tool: "page_edit", targetKey: "page_edit:t1" };
  const approve = (s = scope(), decision: "approved" | "denied" | "undone" = "approved") =>
    recordApprovalDecision(prisma, {
      ...s,
      ...key,
      decision,
      basis: "person",
      decidedByUserId: s.userId,
      cleanRun: true,
      tier: "reversible",
      argsShape: argsShapeOf(args),
      version: 1,
    });
  const classify = async (s = scope()) =>
    classifyAction({
      call: { toolName: "page_edit", args },
      rules: { decision: "allow", source: "action_type_default", matchingRules: [] },
      mandatory: false,
      consequential: true,
      untrustedContentSeen: false,
      autoReviewEnabled: true,
      history: await listPastDecisions(prisma, { ...s, ...key }),
      ownerUserId: (await isSpaceOwner(prisma, s)) ? s.userId : null,
      now: new Date(),
    }).decision;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of users) {
      await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    }
    await prisma.organization.create({
      data: { id: org, name: "Org", slug: org, createdAt: new Date() },
    });
    for (const id of spaces) {
      await prisma.space.create({ data: { id, organizationId: org, name: "S", isDefault: false } });
    }
    for (const [j, userId] of users.entries()) {
      await prisma.member.create({
        data: {
          id: `${userId}-m`,
          organizationId: org,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      for (const spaceId of spaces) {
        await prisma.spaceMember.create({
          data: {
            id: `${spaceId}-${userId}`,
            spaceId,
            organizationId: org,
            userId,
            role: j === 0 ? "owner" : "member",
            createdAt: new Date(),
          },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { id: { in: spaces } } });
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await close();
  });

  it("2 approvals ask, 3 approve, and a denial resets the target", async () => {
    await approve();
    await approve();
    expect(await classify()).toBe("ask");
    await approve();
    expect(await classify()).toBe("approve");
    await approve(scope(), "denied");
    expect(await classify()).toBe("ask");
  });

  it("a shared space's member never gets precedent, even after approving 3 times", async () => {
    const member = scope(0, 1);
    for (let i = 0; i < 3; i++) await approve(member);
    expect(await classify(member)).toBe("ask");
    await prisma.approvalDecision.deleteMany({ where: { userId: users[1]! } });
  });

  it("another user, space or agent never sees those decisions", async () => {
    expect(await listPastDecisions(prisma, { ...scope(0, 1), ...key })).toEqual([]);
    expect(await listPastDecisions(prisma, { ...scope(1, 0), ...key })).toEqual([]);
    expect(await listPastDecisions(prisma, { ...scope(0, 0, "bot-2"), ...key })).toEqual([]);
    expect(await listAutoApprovals(prisma, { spaceId: spaces[1]!, userId: users[0]! })).toEqual([]);
  });

  it("records who answered, and lists automatic approvals", async () => {
    await recordApprovalDecision(prisma, {
      ...scope(),
      ...key,
      decision: "auto_approved",
      basis: "precedent",
      decidedByUserId: null,
      cleanRun: true,
      tier: "reversible",
      argsShape: argsShapeOf(args),
      version: 1,
    });
    const history = await listPastDecisions(prisma, { ...scope(), ...key });
    expect(history.filter((row) => row.decidedByUserId === users[0])).toHaveLength(4);
    const auto = await listAutoApprovals(prisma, { spaceId: spaces[0]!, userId: users[0]! });
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ decidedByUserId: null, basis: "precedent" });
  });

  it("an Undo found by its effect resets the target and pauses the tool for 7 days", async () => {
    const s = scope(1, 0);
    const other = { tool: "page_edit", targetKey: "page_edit:t2" };
    for (let i = 0; i < 3; i++) await approve(s);
    await recordApprovalDecision(prisma, {
      ...s,
      ...other,
      effectId: "eff-undo-1",
      decision: "auto_approved",
      basis: "precedent",
      decidedByUserId: null,
      cleanRun: true,
      tier: "reversible",
      argsShape: argsShapeOf(args),
      version: 1,
    });
    expect(await lastToolUndo(prisma, { ...s, tool: "page_edit" })).toBeNull();
    expect(
      await recordUndoneApproval(prisma, {
        spaceId: s.spaceId,
        userId: users[1]!,
        effectId: "eff-undo-1",
      }),
    ).toBeNull();
    const undone = await recordUndoneApproval(prisma, {
      spaceId: s.spaceId,
      userId: s.userId,
      effectId: "eff-undo-1",
    });
    expect(undone).toMatchObject({
      decision: "undone",
      targetKey: other.targetKey,
      botId: "bot-1",
    });
    expect(await lastToolUndo(prisma, { ...s, tool: "page_edit" })).toEqual(undone!.createdAt);
    expect(await lastToolUndo(prisma, { ...s, tool: "mail_modify" })).toBeNull();
    await prisma.approvalDecision.deleteMany({ where: { spaceId: s.spaceId } });
  });

  it("prunes rows past retention and goes with the space", async () => {
    const old = await approve(scope(1, 0));
    await prisma.approvalDecision.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 200 * 86_400_000) },
    });
    expect(await pruneApprovalDecisions(prisma)).toBeGreaterThanOrEqual(1);
    await prisma.space.delete({ where: { id: spaces[0]! } });
    expect(await prisma.approvalDecision.count({ where: { spaceId: spaces[0]! } })).toBe(0);
  });
});
