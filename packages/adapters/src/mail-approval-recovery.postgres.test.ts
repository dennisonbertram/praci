import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadEvents } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAIL_APPROVAL_STALE_MS, reconcileMailApprovals } from "./mail-approval-recovery.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("mail approval recovery (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    user: `mar-user-${suffix}`,
    other: `mar-other-${suffix}`,
    org: `mar-org-${suffix}`,
    space: `mar-space-${suffix}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let connectionId: string;
  let botId: string;
  let threadId: string;
  let n = 0;
  const events = () => createThreadEvents(prisma);
  const later = () => new Date(Date.now() + MAIL_APPROVAL_STALE_MS + 1000);

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
    connectionId = (
      await prisma.connection.create({
        data: {
          spaceId: ids.space,
          userId: ids.user,
          provider: "gmail",
          displayName: "Mailbox",
          status: "connected",
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.delete({ where: { id: ids.user } });
    await close();
  });

  /** A waiting mail approval card; returns the ids the claim and the reconciler use. */
  async function waitingApproval(kind: "mail_send" | "mail_draft") {
    const seq = n++;
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
    const run = await prisma.run.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        taskId: task.id,
        userId: ids.user,
        status: "waiting_input",
        trigger: "user",
      },
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: ids.space,
        runId: run.id,
        kind,
        idempotencyKey: `mar-${suffix}-${seq}`,
        status: "intended",
        request: { to: ["a@example.test"], subject: "Hi", body: "Body" },
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
            text: `Review before ${kind}`,
            status: "pending",
            mail: { tool: kind, to: ["a@example.test"], cc: [], bcc: [], subject: "Hi", body: "B" },
            actions: [
              { id: "allow", label: "Allow once" },
              { id: "always", label: "Always allow this tool" },
              { id: "deny", label: "Deny" },
            ],
          },
        ],
      },
    });
    return { run, effect, message };
  }

  const claim = (a: Awaited<ReturnType<typeof waitingApproval>>) =>
    events().answerRunInput({
      spaceId: ids.space,
      threadId,
      runId: a.run.id,
      messageId: a.message.id,
      answeredByUserId: ids.user,
      answer: "deny",
      mailDenial: {
        note: "The user edited this email on the approval card and the outcome of their send is not known yet. Do not send it again; they should check Sent.",
        mail: { subject: "Edited", connectionId },
      },
    });

  const card = async (messageId: string) => {
    const message = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    return (message.blocks as Array<{ mail?: { outcome?: string } }>)[0]!.mail;
  };
  const note = async (effectId: string) =>
    (
      (await prisma.externalEffect.findUniqueOrThrow({ where: { id: effectId } })).result as {
        note: string;
      }
    ).note;
  const reconcile = (now: Date) =>
    reconcileMailApprovals({ prisma, events: events(), now, batchSize: 100 });

  it("makes the compose record with the claim, and a crash before the provider call settles as failed", async () => {
    const a = await waitingApproval("mail_send");
    await expect(claim(a)).resolves.toBe(true);
    const row = await prisma.composeSend.findFirstOrThrow({
      where: { clientId: `approval_${a.effect.id}` },
    });
    expect(row).toMatchObject({ state: "draft", userId: ids.user, connectionId });

    await reconcile(new Date());
    expect((await card(a.message.id))?.outcome).toBeUndefined();

    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("failed");
    expect(await note(a.effect.id)).toContain("nothing was sent");
    expect((await prisma.composeSend.findUniqueOrThrow({ where: { id: row.id } })).state).toBe(
      "abandoned",
    );

    // Idempotent: a second pass finds nothing left to settle.
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("failed");
  });

  it("settles a send that may have reached the provider as unknown, never failed", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    await prisma.composeSend.updateMany({
      where: { clientId: `approval_${a.effect.id}` },
      data: { state: "pending" },
    });
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("unknown");
    expect(await note(a.effect.id)).toContain("unknown");
    expect(
      (
        await prisma.composeSend.findFirstOrThrow({
          where: { clientId: `approval_${a.effect.id}` },
        })
      ).state,
    ).toBe("unknown");
  });

  it("records a send that finished but never reached the card as sent", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    await prisma.composeSend.updateMany({
      where: { clientId: `approval_${a.effect.id}` },
      data: { state: "sent" },
    });
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("sent");
    expect(await note(a.effect.id)).toContain("Do not send it again");
  });

  it("settles a draft save by whether a draft id was stored", async () => {
    const saved = await waitingApproval("mail_draft");
    const maybe = await waitingApproval("mail_draft");
    await claim(saved);
    await claim(maybe);
    await prisma.composeSend.updateMany({
      where: { clientId: `approval_${saved.effect.id}` },
      data: { draftId: "d-1" },
    });
    await reconcile(later());
    expect((await card(saved.message.id))?.outcome).toBe("saved");
    expect((await card(maybe.message.id))?.outcome).toBe("unknown");
  });

  it("settles a claim that predates the compose record as unknown", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    await prisma.composeSend.deleteMany({ where: { clientId: `approval_${a.effect.id}` } });
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("unknown");
  });

  it("skips its write when the send finished after the scan read the row", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    const clientId = `approval_${a.effect.id}`;
    // The scan reads the row (still "draft"), then the inline path sends and settles the card.
    const realFind = prisma.message.findMany.bind(prisma.message);
    const racing = {
      ...prisma,
      message: {
        findMany: async (args: Parameters<typeof realFind>[0]) => {
          await prisma.composeSend.updateMany({
            where: { clientId },
            data: { state: "sent" },
          });
          await events().setMailApprovalOutcome({
            spaceId: ids.space,
            threadId,
            messageId: a.message.id,
            effectId: a.effect.id,
            outcome: "sent",
            note: "inline note",
          });
          return realFind(args);
        },
      },
    } as unknown as PrismaClient;
    await reconcileMailApprovals({
      prisma: racing,
      events: events(),
      now: later(),
      batchSize: 100,
    });
    expect((await card(a.message.id))?.outcome).toBe("sent");
    expect(await note(a.effect.id)).toBe("inline note");
  });

  it("skips its write when only the compose record changed under the scan", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    const realFind = prisma.message.findMany.bind(prisma.message);
    const racing = {
      ...prisma,
      message: {
        findMany: async (args: Parameters<typeof realFind>[0]) => {
          await prisma.composeSend.updateMany({
            where: { clientId: `approval_${a.effect.id}` },
            data: { state: "sent" },
          });
          return realFind(args);
        },
      },
    } as unknown as PrismaClient;
    await reconcileMailApprovals({
      prisma: racing,
      events: events(),
      now: later(),
      batchSize: 100,
    });
    expect((await card(a.message.id))?.outcome).toBeUndefined();
    // The next pass sees the real state.
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("sent");
  });

  it("fences a failed send record too, so a retry cannot claim it", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    const where = { clientId: `approval_${a.effect.id}` };
    await prisma.composeSend.updateMany({ where, data: { state: "failed" } });
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBe("failed");
    expect((await prisma.composeSend.findFirstOrThrow({ where })).state).toBe("abandoned");
  });

  it("waits on the compose row lock, then skips when the state changed", async () => {
    const a = await waitingApproval("mail_send");
    await claim(a);
    const clientId = `approval_${a.effect.id}`;
    const claimNote = await note(a.effect.id);
    let write: Promise<void> | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.composeSend.updateMany({ where: { clientId }, data: { state: "sent" } });
      write = events().setMailApprovalOutcome({
        spaceId: ids.space,
        threadId,
        messageId: a.message.id,
        effectId: a.effect.id,
        outcome: "failed",
        note: "recovery note",
        onlyIf: { note: claimNote, compose: { userId: ids.user, clientId, state: "draft" } },
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await write;
    expect((await card(a.message.id))?.outcome).toBeUndefined();
    expect(await note(a.effect.id)).toBe(claimNote);
  });

  it("leaves a plain denial alone", async () => {
    const a = await waitingApproval("mail_send");
    await prisma.externalEffect.update({
      where: { id: a.effect.id },
      data: { status: "denied" },
    });
    await reconcile(later());
    expect((await card(a.message.id))?.outcome).toBeUndefined();
  });
});
