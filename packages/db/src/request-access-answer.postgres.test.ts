import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createThreadEvents } from "./events.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("answering a request_access card (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    owner: `ra-owner-${suffix}`,
    mate: `ra-mate-${suffix}`,
    org: `ra-org-${suffix}`,
    space: `ra-space-${suffix}`,
    otherSpace: `ra-other-${suffix}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const events = () => createThreadEvents(prisma);

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const createdAt = new Date();
    for (const id of [ids.owner, ids.mate]) {
      await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    }
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt },
    });
    for (const space of [ids.space, ids.otherSpace]) {
      await prisma.space.create({
        data: { id: space, organizationId: ids.org, name: space, isDefault: space === ids.space },
      });
    }
    for (const userId of [ids.owner, ids.mate]) {
      await prisma.member.create({
        data: { id: `m-${userId}`, organizationId: ids.org, userId, role: "member", createdAt },
      });
      // Joining the organization may already add the member to its spaces.
      await prisma.spaceMember.createMany({
        data: [
          {
            id: `sm-${userId}`,
            spaceId: ids.space,
            organizationId: ids.org,
            userId,
            role: "member",
            createdAt,
          },
        ],
        skipDuplicates: true,
      });
    }
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.mate] } } });
    await close();
  });

  async function waiting(
    opts: { firewall?: boolean; disabled?: string[]; actions?: string[] } = {},
  ) {
    const seq = n++;
    const bot = (
      await prisma.bot.create({
        data: {
          spaceId: ids.space,
          userId: ids.owner,
          name: `Agent ${seq}`,
          color: "blue",
          firewall: opts.firewall ?? false,
          disabledBuiltinTools: opts.disabled ?? ["contacts_list", "contacts_add", "web_search"],
        },
      })
    ).id;
    const thread = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.owner, botId: bot } })
    ).id;
    const task = await prisma.task.create({
      data: {
        spaceId: ids.space,
        botId: bot,
        threadId: thread,
        userId: ids.owner,
        prompt: "p",
        status: "running",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId: ids.space,
        botId: bot,
        threadId: thread,
        taskId: task.id,
        userId: ids.owner,
        status: "waiting_input",
        trigger: "user",
      },
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: ids.space,
        runId: run.id,
        kind: "request_access",
        idempotencyKey: `ra-${suffix}-${seq}`,
        status: "intended",
        request: { capability: "contacts", reason: "Save the lead" },
      },
    });
    const message = await prisma.message.create({
      data: {
        threadId: thread,
        seq: 0,
        role: "bot",
        runId: run.id,
        blocks: [
          {
            kind: "ask",
            approvalEffectId: effect.id,
            text: "Agent asks to see, add and edit your contacts",
            status: "pending",
            actions: (opts.actions ?? ["allow", "always", "deny"]).map((id) => ({ id, label: id })),
          },
        ],
      },
    });
    return { bot, thread, run, effect, message };
  }

  const answer = (a: Awaited<ReturnType<typeof waiting>>, userId: string, id: string) =>
    events().answerRunInput({
      spaceId: ids.space,
      threadId: a.thread,
      runId: a.run.id,
      messageId: a.message.id,
      answeredByUserId: userId,
      answer: id,
    });
  const botRow = (a: Awaited<ReturnType<typeof waiting>>) =>
    prisma.bot.findUniqueOrThrow({ where: { id: a.bot } });
  const rules = () => prisma.actionApprovalRule.count({ where: { spaceId: ids.space } });

  it("Always turns the tools back on and saves no approval rule", async () => {
    const a = await waiting();
    await expect(answer(a, ids.owner, "always")).resolves.toBe(true);
    const bot = await botRow(a);
    expect(bot.disabledBuiltinTools).toEqual(["web_search"]);
    expect(bot.firewallAskCapabilities).toEqual([]);
    expect(await rules()).toBe(0);
    expect((await prisma.externalEffect.findUnique({ where: { id: a.effect.id } }))?.status).toBe(
      "approved",
    );
    expect((await prisma.run.findUnique({ where: { id: a.run.id } }))?.status).toBe("queued");
  });

  it("Always on a Firewall agent records the capability as ask-each-time", async () => {
    const a = await waiting({ firewall: true, disabled: [] });
    await expect(answer(a, ids.owner, "always")).resolves.toBe(true);
    expect((await botRow(a)).firewallAskCapabilities).toEqual(["contacts"]);
    expect(await rules()).toBe(0);
  });

  it("Allow for this run changes nothing stored", async () => {
    const a = await waiting({ firewall: true });
    await expect(answer(a, ids.owner, "allow")).resolves.toBe(true);
    const bot = await botRow(a);
    expect(bot.firewallAskCapabilities).toEqual([]);
    expect(bot.disabledBuiltinTools).toEqual(["contacts_list", "contacts_add", "web_search"]);
    expect(await rules()).toBe(0);
  });

  it("Deny changes nothing and the run resumes", async () => {
    const a = await waiting();
    await expect(answer(a, ids.owner, "deny")).resolves.toBe(true);
    expect((await botRow(a)).disabledBuiltinTools).toHaveLength(3);
    expect((await prisma.externalEffect.findUnique({ where: { id: a.effect.id } }))?.status).toBe(
      "denied",
    );
  });

  it("refuses a teammate, even for Allow", async () => {
    const a = await waiting();
    await expect(answer(a, ids.mate, "allow")).resolves.toBe(false);
    await expect(answer(a, ids.mate, "always")).resolves.toBe(false);
    expect((await botRow(a)).disabledBuiltinTools).toHaveLength(3);
  });

  it("rejects Always when the card did not offer it", async () => {
    const a = await waiting({ actions: ["allow", "deny"] });
    await expect(answer(a, ids.owner, "always")).resolves.toBe(false);
    expect((await botRow(a)).disabledBuiltinTools).toHaveLength(3);
  });
});
