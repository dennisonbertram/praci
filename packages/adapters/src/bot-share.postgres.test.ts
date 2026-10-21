import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { BOT_SHARE_DECLINED_MESSAGE, BOT_SHARE_HELD_MESSAGE } from "@rakazo/contracts";
import { PrivateFragments } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { messageBot } from "./bot-messages.js";
import { answerBotShare, findBotShareEffect } from "./bot-share.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("held shares to an external bot (PostgreSQL)", () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (name: string) => `hs-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const strangerId = id("stranger");
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let chief: { id: string; name: string; threadId: string };
  let finance: { id: string; threadId: string };
  let support: { id: string; threadId: string };
  const deps = () =>
    ({
      prisma,
      events: { notify: async () => undefined },
      jobs: { enqueue: async () => undefined },
    }) as never;

  const secret = "priya.shah@halcyon-ventures.example";
  const fragments = () => {
    const f = new PrivateFragments();
    f.addPrivate(JSON.stringify({ from: `Priya Shah <${secret}>`, body: "wire $1,250,000" }));
    return f;
  };
  const heldText = `The lead investor is ${secret.toUpperCase()}.`;

  async function chiefRun(status = "running") {
    const task = await prisma.task.create({
      data: { spaceId, botId: chief.id, threadId: chief.threadId, userId, prompt: "x", status },
    });
    return prisma.run.create({
      data: {
        spaceId,
        botId: chief.id,
        threadId: chief.threadId,
        taskId: task.id,
        userId,
        status,
        trigger: "user",
      },
    });
  }
  const textsIn = async (threadId: string) =>
    (await prisma.message.findMany({ where: { threadId }, orderBy: { seq: "asc" } })).flatMap(
      (message) =>
        (message.blocks as { kind: string; text?: string }[])
          .filter((block) => block.kind === "bot_message_received")
          .map((block) => block.text),
    );
  const scope = (threadId = chief.threadId, user = userId) => ({ spaceId, userId: user, threadId });
  const hold = async (text = heldText, deliveryKey?: string) => {
    const run = await chiefRun();
    const sent = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      { bot_id: support.id, message: text, intent: "request", deliveryKey },
      { outbound: async () => fragments() },
    );
    const card = await prisma.message.findFirstOrThrow({
      where: { threadId: chief.threadId, runId: run.id, role: "bot" },
    });
    const effect = await prisma.externalEffect.findFirstOrThrow({ where: { runId: run.id } });
    return { run, sent, card, effect };
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, strangerId])
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    await prisma.member.create({
      data: { id: id("m"), organizationId: orgId, userId, role: "member", createdAt: new Date() },
    });
    const repos = createRepos(prisma);
    const make = (name: string) =>
      repos.createBot(actor, {
        name,
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: false,
      });
    chief = await make("Chief");
    finance = await make("Finance");
    support = await make("Support");
    await prisma.bot.update({
      where: { id: support.id },
      data: { audience: "external", externalMessageTargets: [chief.id] },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, strangerId] } } });
    await close();
  });

  it("holds a message that repeats a private fragment; the external bot gets only the fixed words", async () => {
    const { sent, card, effect } = await hold();
    expect(sent).toMatchObject({ ok: true, held: true });
    expect(effect).toMatchObject({ kind: "bot_message_share", status: "intended" });
    expect((effect.request as { text: string }).text).toBe(heldText);
    expect(card.blocks).toEqual([
      expect.objectContaining({
        kind: "ask",
        share: true,
        text: "Share with Support?",
        detail: heldText,
        approvalEffectId: effect.id,
        actions: [
          { id: "allow", label: "Share" },
          { id: "deny", label: "Don't share" },
        ],
      }),
    ]);
    const received = await textsIn(support.threadId);
    expect(received).toContain(BOT_SHARE_HELD_MESSAGE);
    expect(received.join("\n")).not.toContain(secret);
    expect(received.join("\n").toLowerCase()).not.toContain("halcyon");
  });

  it("delivers the stored text once on Share, even if the card text was altered, and refuses a replay", async () => {
    const { run, card, effect } = await hold(
      "Investor: PRIYA.SHAH@halcyon-ventures.example again.",
    );
    const stored = (effect.request as { text: string }).text;
    // The card is only a view: changing what it shows changes nothing that is sent.
    await prisma.message.update({
      where: { id: card.id },
      data: {
        blocks: (card.blocks as { detail?: string }[]).map((block) => ({
          ...block,
          detail: "edited text that was never approved",
        })),
      },
    });
    const first = await answerBotShare(deps(), scope(), {
      runId: run.id,
      messageId: card.id,
      answer: "allow",
    });
    expect(first).toBe(true);
    const received = await textsIn(support.threadId);
    expect(received.filter((text) => text === stored)).toHaveLength(1);
    expect(received.join("\n")).not.toContain("edited text");
    expect(
      await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } }),
    ).toMatchObject({ status: "completed" });
    // A second approval, a late deny, or a replay of the click delivers nothing more.
    for (const answer of ["allow", "deny", "allow"]) {
      expect(
        await answerBotShare(deps(), scope(), { runId: run.id, messageId: card.id, answer }),
      ).toBe(false);
    }
    expect((await textsIn(support.threadId)).filter((text) => text === stored)).toHaveLength(1);
    // The card now reads as answered.
    const after = await prisma.message.findUniqueOrThrow({ where: { id: card.id } });
    expect(after.blocks).toEqual([
      expect.objectContaining({ status: "answered", answer: "allow" }),
    ]);
  });

  it("delivers nothing on Don't share but a fixed reply", async () => {
    const { run, card, effect } = await hold("Send Priya Shah a note about the round.");
    const before = (await textsIn(support.threadId)).length;
    expect(
      await answerBotShare(deps(), scope(), { runId: run.id, messageId: card.id, answer: "deny" }),
    ).toBe(true);
    const received = await textsIn(support.threadId);
    expect(received.length).toBe(before + 1);
    expect(received.at(-1)).toBe(BOT_SHARE_DECLINED_MESSAGE);
    expect(
      await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } }),
    ).toMatchObject({ status: "denied" });
    // A later Share on the same card is refused.
    expect(
      await answerBotShare(deps(), scope(), { runId: run.id, messageId: card.id, answer: "allow" }),
    ).toBe(false);
    expect(await textsIn(support.threadId)).toHaveLength(before + 1);
  });

  it("a retried hold of the same message makes no second card", async () => {
    const { run } = await hold("Reach priya.shah@halcyon-ventures.example today.");
    const again = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      {
        bot_id: support.id,
        message: "Reach priya.shah@halcyon-ventures.example today.",
        intent: "request",
      },
      { outbound: async () => fragments() },
    );
    expect(again).toMatchObject({ ok: true, held: true });
    expect(await prisma.externalEffect.count({ where: { runId: run.id } })).toBe(1);
    const cards = (
      await prisma.message.findMany({
        where: { threadId: chief.threadId, runId: run.id, role: "bot" },
      })
    ).filter((message) =>
      (message.blocks as { kind: string }[]).some((block) => block.kind === "ask"),
    );
    expect(cards).toHaveLength(1);
  });

  it("only the owner in this space can answer", async () => {
    const { run, card, effect } = await hold("Mail priya.shah@halcyon-ventures.example now.");
    const stranger = scope(chief.threadId, strangerId);
    expect(await findBotShareEffect(prisma, stranger, { runId: run.id, messageId: card.id })).toBe(
      null,
    );
    expect(
      await answerBotShare(deps(), stranger, {
        runId: run.id,
        messageId: card.id,
        answer: "allow",
      }),
    ).toBe(false);
    expect(
      await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } }),
    ).toMatchObject({ status: "intended" });
  });

  it("does not touch a message that repeats nothing private, or internal traffic", async () => {
    const run = await chiefRun();
    const clean = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      { bot_id: support.id, message: "We open at 9am on weekdays.", intent: "request" },
      { outbound: async () => fragments() },
    );
    expect(clean).toMatchObject({ ok: true });
    expect(clean).not.toHaveProperty("held", true);
    expect(await textsIn(support.threadId)).toContain("We open at 9am on weekdays.");
    // To an internal bot the same private text goes straight through.
    const internal = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      { bot_id: finance.id, message: heldText, intent: "request" },
      { outbound: async () => fragments() },
    );
    expect(internal).toMatchObject({ ok: true });
    expect(await textsIn(finance.threadId)).toContain(heldText);
    // No snapshot of the run's reads to an external bot: held, not sent.
    const unknown = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      { bot_id: support.id, message: "Unchecked text.", intent: "request" },
    );
    expect(unknown).toMatchObject({ ok: true, held: true });
    expect(await textsIn(support.threadId)).not.toContain("Unchecked text.");
  });

  it("approval reuses the original delivery key, so a retried status or result does not duplicate", async () => {
    const { run, card, effect } = await hold(
      "Call priya.shah@halcyon-ventures.example",
      "auto-outcome:k1",
    );
    expect(
      await answerBotShare(deps(), scope(), { runId: run.id, messageId: card.id, answer: "allow" }),
    ).toBe(true);
    const nonce = await prisma.message.findFirst({
      where: { threadId: support.threadId, clientNonce: "bot-message:auto-outcome:k1" },
    });
    expect(nonce).not.toBeNull();
    // The same auto outcome retried (even with other text): replayed, no second card or effect.
    const again = await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      {
        bot_id: support.id,
        message: "Different text priya.shah@halcyon-ventures.example",
        intent: "request",
        deliveryKey: "auto-outcome:k1",
      },
      { outbound: async () => fragments() },
    );
    expect(again).toMatchObject({ ok: true, replayed: true });
    expect(await prisma.externalEffect.count({ where: { runId: run.id } })).toBe(1);
    expect(effect.id).toBeDefined();
  });

  it("a retried hold under the same key makes no second card even when the text differs", async () => {
    const { run } = await hold("Mail priya.shah@halcyon-ventures.example a", "status:k2");
    await messageBot(
      deps(),
      run,
      { id: chief.id, name: chief.name },
      {
        bot_id: support.id,
        message: "Mail priya.shah@halcyon-ventures.example b",
        intent: "request",
        deliveryKey: "status:k2",
      },
      { outbound: async () => fragments() },
    );
    expect(await prisma.externalEffect.count({ where: { runId: run.id } })).toBe(1);
  });

  it("recovers a share stranded between the claim and the delivery", async () => {
    const { run, card, effect } = await hold("Stranded priya.shah@halcyon-ventures.example");
    const stored = (effect.request as { text: string }).text;
    // A crash after the claim: executing, and not touched for a while.
    await prisma.externalEffect.update({
      where: { id: effect.id },
      data: { status: "executing", updatedAt: new Date(Date.now() - 120_000) },
    });
    expect(
      await answerBotShare(deps(), scope(), { runId: run.id, messageId: card.id, answer: "allow" }),
    ).toBe(true);
    expect((await textsIn(support.threadId)).filter((text) => text === stored)).toHaveLength(1);
    expect(
      await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } }),
    ).toMatchObject({ status: "completed" });
    // A claim that is still fresh belongs to a live answer: refused.
    const fresh = await hold("Fresh priya.shah@halcyon-ventures.example");
    await prisma.externalEffect.update({
      where: { id: fresh.effect.id },
      data: { status: "executing" },
    });
    expect(
      await answerBotShare(deps(), scope(), {
        runId: fresh.run.id,
        messageId: fresh.card.id,
        answer: "allow",
      }),
    ).toBe(false);
  });

  it("delivers whatever state the sender's run is in, and never marks answered when delivery failed", async () => {
    const paused = await hold("Paused priya.shah@halcyon-ventures.example");
    await prisma.run.update({ where: { id: paused.run.id }, data: { status: "waiting_input" } });
    // Delivery fails (the recipient is archived): the card stays pending and the effect is released.
    await prisma.bot.update({ where: { id: support.id }, data: { archivedAt: new Date() } });
    await expect(
      answerBotShare(deps(), scope(), {
        runId: paused.run.id,
        messageId: paused.card.id,
        answer: "allow",
      }),
    ).rejects.toThrow();
    const pending = await prisma.message.findUniqueOrThrow({ where: { id: paused.card.id } });
    expect(pending.blocks).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(
      await prisma.externalEffect.findUniqueOrThrow({ where: { id: paused.effect.id } }),
    ).toMatchObject({ status: "intended" });
    // The recipient is back: the same answer now delivers from the paused run.
    await prisma.bot.update({ where: { id: support.id }, data: { archivedAt: null } });
    expect(
      await answerBotShare(deps(), scope(), {
        runId: paused.run.id,
        messageId: paused.card.id,
        answer: "allow",
      }),
    ).toBe(true);
    expect(await textsIn(support.threadId)).toContain(
      (paused.effect.request as { text: string }).text,
    );
    // Don't share from a paused run delivers its fixed reply.
    const second = await hold("Declined priya.shah@halcyon-ventures.example");
    await prisma.run.update({ where: { id: second.run.id }, data: { status: "waiting_input" } });
    expect(
      await answerBotShare(deps(), scope(), {
        runId: second.run.id,
        messageId: second.card.id,
        answer: "deny",
      }),
    ).toBe(true);
    expect((await textsIn(support.threadId)).at(-1)).toBe(BOT_SHARE_DECLINED_MESSAGE);
  });

  it("a retried hold sends the fixed notice that a crash lost, once", async () => {
    const { run, effect } = await hold("Notice priya.shah@halcyon-ventures.example", "status:k3");
    // The card committed but the notice did not.
    await prisma.message.deleteMany({
      where: { threadId: support.threadId, clientNonce: `bot-message:share-held:${effect.id}` },
    });
    const before = (await textsIn(support.threadId)).filter(
      (text) => text === BOT_SHARE_HELD_MESSAGE,
    ).length;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await messageBot(
        deps(),
        run,
        { id: chief.id, name: chief.name },
        {
          bot_id: support.id,
          message: "Notice priya.shah@halcyon-ventures.example",
          intent: "request",
          deliveryKey: "status:k3",
        },
        { outbound: async () => fragments() },
      );
    }
    const after = (await textsIn(support.threadId)).filter(
      (text) => text === BOT_SHARE_HELD_MESSAGE,
    ).length;
    expect(after).toBe(before + 1);
    expect(await prisma.externalEffect.count({ where: { runId: run.id } })).toBe(1);
  });
});
