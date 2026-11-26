import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approvalTable,
  clearApprovalRule,
  listApprovalRules,
  setActionTypeChoice,
  setApprovalRule,
} from "./approval-rules.js";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("approval rules (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    user: `apr-user-${suffix}`,
    org: `apr-org-${suffix}`,
    space: `apr-space-${suffix}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botA: string;
  let botB: string;
  const scope = () => ({ spaceId: ids.space, userId: ids.user });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: ids.user, name: ids.user, email: `${ids.user}@example.test` },
    });
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: ids.space, organizationId: ids.org, name: "S", isDefault: true },
    });
    const bots = [];
    for (const name of ["a", "b"]) {
      bots.push(
        await prisma.bot.create({
          data: { spaceId: ids.space, userId: ids.user, name, color: "blue" },
        }),
      );
    }
    botA = bots[0]!.id;
    botB = bots[1]!.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await close();
  });

  it("replaces the rule for a target whatever its effect", async () => {
    const target = { ...scope(), matchKind: "tool" as const, matchValue: "write_file" };
    await setApprovalRule(prisma, { ...target, effect: "always_allow" });
    await setApprovalRule(prisma, { ...target, matchValue: "WRITE_FILE", effect: "block" });
    const rows = await listApprovalRules(prisma, scope());
    expect(rows.map((row) => row.effect)).toEqual(["block"]);
    await clearApprovalRule(prisma, target);
    expect(await listApprovalRules(prisma, scope())).toEqual([]);
  });

  it("keeps bot rules separate from space rules and from other bots", async () => {
    const base = { ...scope(), matchKind: "category" as const, matchValue: "delete_data" };
    await setApprovalRule(prisma, { ...base, effect: "require_approval" });
    await setApprovalRule(prisma, { ...base, botId: botA, effect: "block" });
    await setApprovalRule(prisma, { ...base, botId: botB, effect: "always_allow" });
    expect((await listApprovalRules(prisma, scope())).map((row) => row.botId)).toEqual([null]);
    const forA = await listApprovalRules(prisma, { ...scope(), botId: botA });
    expect(forA.map((row) => row.effect).sort()).toEqual(["block", "require_approval"]);
    const row = (await approvalTable(prisma, { ...scope(), botId: botA })).find(
      (entry) => entry.actionType === "delete_data",
    );
    expect(row).toMatchObject({ spaceEffect: "ask", botEffect: "block", effect: "block" });
  });

  it("sets a table row, replacing a legacy alias, and null clears the override", async () => {
    await prisma.actionApprovalRule.create({
      data: {
        spaceId: ids.space,
        createdByUserId: ids.user,
        effect: "require_approval",
        matchKind: "category",
        matchValue: "email",
      },
    });
    await setActionTypeChoice(prisma, { ...scope(), actionType: "send_email", choice: "block" });
    const emailRows = (await listApprovalRules(prisma, scope())).filter(
      (rule) => rule.matchValue === "email" || rule.matchValue === "send_email",
    );
    expect(emailRows.map((rule) => [rule.matchValue, rule.effect])).toEqual([
      ["send_email", "block"],
    ]);
    await setActionTypeChoice(prisma, {
      ...scope(),
      botId: botA,
      actionType: "send_email",
      choice: "allow",
    });
    await setActionTypeChoice(prisma, {
      ...scope(),
      botId: botA,
      actionType: "send_email",
      choice: null,
    });
    const row = (await approvalTable(prisma, { ...scope(), botId: botA })).find(
      (entry) => entry.actionType === "send_email",
    );
    expect(row).toMatchObject({ spaceEffect: "block", botEffect: null });
  });

  it("the unique index refuses two rules for one target", async () => {
    const data = {
      spaceId: ids.space,
      createdByUserId: ids.user,
      matchKind: "tool",
      matchValue: "dup_tool",
    };
    await prisma.actionApprovalRule.create({ data: { ...data, effect: "always_allow" } });
    await expect(
      prisma.actionApprovalRule.create({ data: { ...data, effect: "block" } }),
    ).rejects.toThrow();
  });
});
