import { AI_CONSENT_EFFECT_KIND, AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createThreadEvents } from "./events.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("answering an AI data sharing request (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    owner: `cons-owner-${suffix}`,
    mate: `cons-mate-${suffix}`,
    org: `cons-org-${suffix}`,
    space: `cons-space-${suffix}`,
    otherSpace: `cons-other-${suffix}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
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
    botId = (
      await prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.owner, name: "Bot", color: "blue" },
      })
    ).id;
    threadId = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.owner, botId } })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.mate] } } });
    await close();
  });

  async function waitingConsent(actions = ["allow", "deny"]) {
    const seq = n++;
    const task = await prisma.task.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        userId: ids.owner,
        prompt: "p",
        status: "running",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
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
        kind: AI_CONSENT_EFFECT_KIND,
        idempotencyKey: `cons-${suffix}-${seq}`,
        status: "intended",
        request: { recipientKey: `key-${seq}`, version: AI_DISCLOSURE_VERSION },
      },
    });
    const message = await prisma.message.create({
      data: {
        threadId,
        seq,
        role: "bot",
        runId: run.id,
        blocks: [
          {
            kind: "ask",
            approvalEffectId: effect.id,
            text: "Allow your mail to be sent to Example?",
            consent: { version: AI_DISCLOSURE_VERSION },
            status: "pending",
            actions: actions.map((id) => ({ id, label: id })),
          },
        ],
      },
    });
    return { run, effect, message, key: `key-${seq}` };
  }

  const answer = (
    a: Awaited<ReturnType<typeof waitingConsent>>,
    userId: string,
    id: string,
    spaceId = ids.space,
  ) =>
    events().answerRunInput({
      spaceId,
      threadId,
      runId: a.run.id,
      messageId: a.message.id,
      answeredByUserId: userId,
      answer: id,
    });
  const granted = (key: string) => prisma.aiDataConsent.findMany({ where: { recipientKey: key } });

  it("lets the owner allow: the consent row is for the owner, the space and the key", async () => {
    const a = await waitingConsent();
    await expect(answer(a, ids.owner, "allow")).resolves.toBe(true);
    expect(await granted(a.key)).toEqual([
      expect.objectContaining({
        userId: ids.owner,
        spaceId: ids.space,
        version: AI_DISCLOSURE_VERSION,
      }),
    ]);
    expect((await prisma.run.findUnique({ where: { id: a.run.id } }))?.status).toBe("queued");
    expect((await prisma.externalEffect.findUnique({ where: { id: a.effect.id } }))?.status).toBe(
      "approved",
    );
  });

  it("grants nothing on Not now, and the run resumes", async () => {
    const a = await waitingConsent();
    await expect(answer(a, ids.owner, "deny")).resolves.toBe(true);
    expect(await granted(a.key)).toEqual([]);
    expect((await prisma.externalEffect.findUnique({ where: { id: a.effect.id } }))?.status).toBe(
      "denied",
    );
  });

  it("refuses a teammate in the same space", async () => {
    const a = await waitingConsent();
    await expect(answer(a, ids.mate, "allow")).resolves.toBe(false);
    expect(await granted(a.key)).toEqual([]);
    expect((await prisma.run.findUnique({ where: { id: a.run.id } }))?.status).toBe(
      "waiting_input",
    );
  });

  it("finds the effect only in the run's own space", async () => {
    const a = await waitingConsent();
    await expect(answer(a, ids.owner, "allow", ids.otherSpace)).resolves.toBe(false);
    expect(await granted(a.key)).toEqual([]);
  });

  it("rejects the always action, which the card never offers", async () => {
    const a = await waitingConsent();
    await expect(answer(a, ids.owner, "always")).resolves.toBe(false);
    expect(await granted(a.key)).toEqual([]);
    expect(await prisma.actionApprovalRule.count({ where: { spaceId: ids.space } })).toBe(0);
  });

  it("does not leave a half-written grant when the effect is no longer waiting", async () => {
    const a = await waitingConsent();
    await prisma.externalEffect.update({ where: { id: a.effect.id }, data: { status: "denied" } });
    await expect(answer(a, ids.owner, "allow")).resolves.toBe(false);
    expect(await granted(a.key)).toEqual([]);
  });
});
