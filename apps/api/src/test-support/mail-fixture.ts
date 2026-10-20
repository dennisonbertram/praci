import type {
  AdapterContext,
  ConnectorProxyRequest,
  JobPublisher,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { EmulatedMessage } from "@rakazo/adapters";
import { createMailProvider, GmailApiEmulator } from "@rakazo/adapters";
import type { Actor, MailSignals } from "@rakazo/contracts";
import { MAIL_SIGNALS_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";

const DAY = 86_400_000;
export const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

export const bulkSignals: MailSignals = {
  listUnsubscribe: ["https://lists.example.test/u/1"],
  oneClick: false,
  listId: null,
  bulk: false,
  autoSubmitted: false,
  auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
  dkimCoversUnsubscribe: false,
  categories: {
    spam: false,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
    important: false,
  },
};

export interface CachedMessageOptions {
  threadId: string;
  from: string;
  fromName: string | null;
  receivedAt: Date;
  unread: boolean;
  inInbox: boolean;
  fromSelf: boolean;
  isSpam: boolean;
  pile: string | null;
  category: string | null;
  signals: MailSignals | null;
}

/**
 * Two users in one space and one user in another, each with one emulated Gmail account, for
 * Postgres tests of the cleanup, unsubscribe, move and action-log procedures. Uses a throwaway
 * database named by DATABASE_URL; every record is deleted on `dispose`.
 */
export async function createMailFixture(label: string, databaseUrl: string) {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `${label}-${name}-${suffix}`;
  const db = createDb(databaseUrl);
  const prisma: PrismaClient = db.prisma;
  const orgA = id("org-a");
  const orgB = id("org-b");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const actor = (name: string, spaceId: string): Actor => ({
    userId: id(name),
    spaceId,
    email: `${id(name)}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor("user-a", spaceA);
  const b = actor("user-b", spaceA);
  const c = actor("user-c", spaceB);

  let gmail = new GmailApiEmulator({ mailboxes: {} });
  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
    revoke: async () => {},
  } as unknown as ManagedConnectorProvider;
  const mail: MailProvider = createMailProvider({
    prisma,
    connectors: { managed: () => connector },
    sleep: async () => {},
    random: () => 0,
  });
  const jobs: JobPublisher = {
    enqueue: async () => {},
    cancel: async () => {},
    close: async () => {},
  };
  const deps = { prisma, mail, jobs };

  /** `scope`: the OAuth scopes the connection records, as a native Google connection does. */
  const connect = async (
    who: Actor,
    ref: string,
    status = "connected",
    options: { connectorId?: string; scope?: string } = {},
  ) =>
    (
      await prisma.connection.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectorId: options.connectorId ?? "emulator",
          provider: "gmail",
          displayName: `Mailbox ${ref}`,
          status,
          providerRef: ref,
          metadata: {
            mailAddress: `${ref}@example.test`,
            ...(options.scope === undefined ? {} : { scope: options.scope }),
          },
        },
      })
    ).id;

  for (const who of [a, b, c])
    await prisma.user.create({
      data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
    });
  for (const [organizationId, spaceId] of [
    [orgA, spaceA],
    [orgB, spaceB],
  ] as const) {
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationId,
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  }
  for (const [organizationId, who] of [
    [orgA, a],
    [orgA, b],
    [orgB, c],
  ] as const)
    await prisma.member.create({
      data: {
        id: `${who.userId}-member`,
        organizationId,
        userId: who.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
  const connA = await connect(a, "box-a");
  const connA2 = await connect(a, "box-a2");
  const connB = await connect(b, "box-b");
  const connC = await connect(c, "box-c");
  const revokedA = await connect(a, "box-revoked", "revoked");

  /** A message as the emulated Gmail account has it. */
  const gmailMessage = (
    messageId: string,
    from = "News <news@lists.example.test>",
    labels = ["INBOX"],
    threadId = messageId,
  ): EmulatedMessage => ({
    id: messageId,
    threadId,
    date: daysAgo(1).toISOString(),
    labels,
    from,
    to: "me@example.test",
    subject: `Subject ${messageId}`,
  });

  return {
    prisma,
    mail,
    jobs,
    deps,
    a,
    b,
    c,
    connA,
    connA2,
    connB,
    connC,
    revokedA,
    spaceIds: [spaceA, spaceB],
    get gmail() {
      return gmail;
    },
    /** Replaces the emulated Gmail with these mailboxes. */
    seed(mailboxes: Record<string, EmulatedMessage[]>) {
      gmail = new GmailApiEmulator({
        mailboxes: Object.fromEntries(
          Object.entries(mailboxes).map(([ref, messages]) => [
            ref,
            { address: `${ref}@example.test`, messages },
          ]),
        ),
      });
    },
    gmailMessage,
    labelsOf: (ref: string, messageId: string) =>
      (
        gmail.handle(ref, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
          .data as { labelIds: string[] }
      ).labelIds,
    connect,
    cache: (
      who: Actor,
      connectionId: string,
      providerMessageId: string,
      extra: Partial<CachedMessageOptions> = {},
    ) =>
      prisma.cachedMailMessage.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectionId,
          providerMessageId,
          threadId: extra.threadId ?? providerMessageId,
          fromName: extra.fromName === undefined ? "News" : extra.fromName,
          fromAddress: extra.from ?? "news@lists.example.test",
          subject: `Subject ${providerMessageId}`,
          snippet: `Snippet ${providerMessageId}`,
          receivedAt: extra.receivedAt ?? daysAgo(1),
          unread: extra.unread ?? true,
          inInbox: extra.inInbox ?? true,
          fromSelf: extra.fromSelf ?? false,
          isSpam: extra.isSpam ?? false,
          pile: extra.pile ?? null,
          category: extra.category ?? null,
          seenAt: new Date(),
          signals: extra.signals === null ? undefined : (extra.signals ?? bulkSignals),
          signalsVersion: MAIL_SIGNALS_VERSION,
        },
      }),
    /** Deletes rows the tests create; connections and users stay for the next test. */
    async wipe() {
      const where = { spaceId: { in: [spaceA, spaceB] } };
      await prisma.cachedMailMessage.deleteMany({ where });
      await prisma.mailSenderStat.deleteMany({ where });
      await prisma.mailSenderDecision.deleteMany({ where });
      await prisma.mailActionLog.deleteMany({ where });
      await prisma.inboxSenderFeedback.deleteMany({ where });
      await prisma.composeSend.deleteMany({ where });
      await prisma.mailSyncState.deleteMany({
        where: { connection: { spaceId: { in: [spaceA, spaceB] } } },
      });
    },
    async dispose() {
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
      await prisma.user.deleteMany({ where: { id: { in: [a.userId, b.userId, c.userId] } } });
      await prisma.$disconnect();
      await db.pool.end();
    },
  };
}

export type MailFixture = Awaited<ReturnType<typeof createMailFixture>>;
