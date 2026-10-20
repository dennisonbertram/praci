import type { MailProvider } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxAskAgent, mailThreadAgentName } from "./inbox-thread-agent.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describe("mailThreadAgentName", () => {
  it("strips reply and forward prefixes and keeps the name short", () => {
    expect(mailThreadAgentName("Re: RE: Fwd: Q3 invoice")).toBe("Q3 invoice");
    expect(mailThreadAgentName("FW:   Lunch\n  plans ")).toBe("Lunch plans");
    expect(mailThreadAgentName("Re:")).toBe("Email thread");
    const long = mailThreadAgentName(`Re: ${"word ".repeat(30)}`);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
  });
});

describePostgres("Ask agent on an email thread (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `askagent-${name}-${suffix}`;
  const actor = (name: string): Actor => ({
    userId: id(`user-${name}`),
    spaceId: id(`space-${name}`),
    email: `${name}-${suffix}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const owner = actor("owner");
  const other = actor("other");
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repos: ReturnType<typeof createRepos>;
  let ownerConnection: string;
  let otherConnection: string;
  const messageIds: Record<string, string> = {};
  const fetched: string[] = [];

  const bodies: Record<string, { text: string; attachments?: string[] }> = {
    p1: { text: "Please pay invoice 0000 by Friday.", attachments: ["invoice-q3.pdf"] },
    p2: {
      text: "Thanks, will do.\n\nOn Mon, Oct 1, 2026, Sample Vendor <billing@vendor.example> wrote:\n> Please pay invoice 0000 by Friday.",
    },
    p3: { text: "Received, thank you." },
  };
  // Only the connections in this list are the caller's own accounts.
  const mail = {
    listAccounts: async (scope: { userId: string }) =>
      scope.userId === owner.userId ? [{ id: ownerConnection }] : [{ id: otherConnection }],
    getMessage: async (_account: unknown, providerMessageId: string) => {
      fetched.push(providerMessageId);
      const body = bodies[providerMessageId] ?? { text: "" };
      return {
        id: providerMessageId,
        threadId: "t1",
        from: { name: "Sample Vendor", address: "billing@vendor.example" },
        to: [{ name: "", address: "you@example.test" }],
        cc: [],
        subject: "Re: Q3 invoice",
        date: "2026-10-01T09:00:00.000Z",
        text: body.text,
        html: null,
        attachments: (body.attachments ?? []).map((filename) => ({
          id: filename,
          filename,
          mimeType: "application/pdf",
          size: 10,
          inline: false,
        })),
      };
    },
  } as unknown as MailProvider;
  const deps = () => ({ prisma, mail, jobs: {} as never, repos });

  const cache = (who: Actor, connectionId: string, providerMessageId: string, threadId: string) =>
    prisma.cachedMailMessage.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectionId,
        providerMessageId,
        threadId,
        fromAddress: "billing@vendor.example",
        subject: "Re: Q3 invoice",
        snippet: `Snippet ${providerMessageId}`,
        receivedAt: new Date(`2026-10-0${providerMessageId.slice(1)}T09:00:00Z`),
        unread: false,
        inInbox: true,
        seenAt: new Date(),
      },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    repos = createRepos(prisma);
    for (const who of [owner, other]) {
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
      });
      await prisma.organization.create({
        data: {
          id: `org-${who.spaceId}`,
          name: "Org",
          slug: `org-${who.spaceId}`,
          createdAt: new Date(),
        },
      });
      await prisma.space.create({
        data: {
          id: who.spaceId,
          organizationId: `org-${who.spaceId}`,
          name: "General",
          isDefault: true,
        },
      });
      await prisma.member.create({
        data: {
          id: `${who.userId}-member`,
          organizationId: `org-${who.spaceId}`,
          userId: who.userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    const connect = async (who: Actor) =>
      (
        await prisma.connection.create({
          data: {
            spaceId: who.spaceId,
            userId: who.userId,
            connectorId: "emulator",
            provider: "gmail",
            displayName: "Mailbox",
            status: "connected",
            providerRef: `ref-${who.userId}`,
            metadata: { mailAddress: "you@example.test" },
          },
        })
      ).id;
    ownerConnection = await connect(owner);
    otherConnection = await connect(other);
    for (const [key, thread] of [
      ["p1", "t1"],
      ["p2", "t1"],
      ["p3", "t1"],
      ["p4", "t2"],
    ] as const) {
      messageIds[key] = (await cache(owner, ownerConnection, key, thread)).id;
    }
    messageIds.theirs = (await cache(other, otherConnection, "p1", "t1")).id;
  });

  afterAll(async () => {
    await prisma.bot.deleteMany({ where: { spaceId: { in: [owner.spaceId, other.spaceId] } } });
    await close();
  });

  it("creates one agent for the thread with the whole thread as its first message", async () => {
    const bot = await inboxAskAgent(deps(), owner, { messageId: messageIds.p2 as string });
    expect(bot.name).toBe("Q3 invoice");
    expect(bot.description).toBe("Handles one email thread.");
    const row = await prisma.bot.findUniqueOrThrow({
      where: { id: bot.id },
      include: { thread: { include: { messages: true } } },
    });
    expect(row.spawnKey).toBe(mailThreadAgentSpawnKey(ownerConnection, "t1"));
    expect(row.userId).toBe(owner.userId);
    const messages = row.thread?.messages ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("system");
    const block = (messages[0]?.blocks as unknown[])?.[0] as {
      kind: string;
      messages: Array<{ text: string; attachments?: string[] }>;
    };
    expect(block.kind).toBe("mail_thread");
    // Oldest first, only this thread, quoted history trimmed, attachment names kept.
    expect(block.messages.map((m) => m.text)).toEqual([
      "Please pay invoice 0000 by Friday.",
      "Thanks, will do.",
      "Received, thank you.",
    ]);
    expect(block.messages[0]?.attachments).toEqual(["invoice-q3.pdf"]);
    // Nothing was queued to run: the agent has no runs yet.
    expect(await prisma.run.count({ where: { botId: bot.id } })).toBe(0);
  });

  it("returns the same agent when asked again, without reading the mail again", async () => {
    const before = fetched.length;
    const first = await inboxAskAgent(deps(), owner, { messageId: messageIds.p1 as string });
    const second = await inboxAskAgent(deps(), owner, { messageId: messageIds.p3 as string });
    expect(second.id).toBe(first.id);
    expect(fetched.length).toBe(before);
    const count = await prisma.bot.count({
      where: { spaceId: owner.spaceId, spawnKey: mailThreadAgentSpawnKey(ownerConnection, "t1") },
    });
    expect(count).toBe(1);
  });

  it("makes a separate agent for another thread", async () => {
    const first = await inboxAskAgent(deps(), owner, { messageId: messageIds.p1 as string });
    const second = await inboxAskAgent(deps(), owner, { messageId: messageIds.p4 as string });
    expect(second.id).not.toBe(first.id);
  });

  it("refuses another user's message and creates nothing", async () => {
    const before = await prisma.bot.count({ where: { spaceId: owner.spaceId } });
    await expect(
      inboxAskAgent(deps(), owner, { messageId: messageIds.theirs as string }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      inboxAskAgent(deps(), other, { messageId: messageIds.p1 as string }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.bot.count({ where: { spaceId: owner.spaceId } })).toBe(before);
  });

  it("refuses a message whose account is no longer the caller's", async () => {
    const lapsed = {
      ...mail,
      listAccounts: async () => [],
    } as unknown as MailProvider;
    await expect(
      inboxAskAgent({ ...deps(), mail: lapsed }, owner, { messageId: messageIds.p4 as string }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
