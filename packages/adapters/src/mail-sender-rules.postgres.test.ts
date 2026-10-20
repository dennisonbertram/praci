import type {
  AdapterContext,
  ConnectorProxyRequest,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { GMAIL_SETTINGS_BASIC } from "./google-connector.js";
import type { SenderRuleDeps } from "./mail-sender-rules.js";
import {
  applyPendingSenderRules,
  ensureSenderRule,
  removeSenderRules,
} from "./mail-sender-rules.js";
import { runMailSyncJob } from "./mail-sync-job.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const SENDER = "news@lists.example.test";
const FILTERS = "/settings/filters";

describePostgres("Gmail sender rules (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `rule-user-${suffix}`;
  const otherUserId = `rule-other-${suffix}`;
  const organizationId = `rule-org-${suffix}`;
  const spaceId = `rule-space-${suffix}`;
  const otherSpaceId = `rule-space2-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let gmail: GmailApiEmulator;
  let mail: ReturnType<typeof createMailProvider>;
  let counter = 0;

  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as unknown as ManagedConnectorProvider;
  const context = (): AdapterContext => ({
    operationId: "rules",
    traceId: "rules",
    spaceId,
    userId,
    signal: new AbortController().signal,
  });
  const deps = (writesDisabled = false): SenderRuleDeps => ({ prisma, mail, writesDisabled });
  /** Requests one account sent to Gmail, optionally only its filter calls of one method. */
  const requestsOf = (a: MailAccount, method?: string) =>
    gmail.requests.filter((r) => r.accountRef === a.accountRef && (!method || r.method === method));

  /**
   * A connected account on its own emulated mailbox. `scope` is what the connection records (and,
   * when it includes the settings scope, what the emulated Gmail grants).
   */
  async function connect(
    options: {
      native?: boolean;
      scope?: "settings" | "none";
      owner?: { spaceId: string; userId: string };
    } = {},
  ): Promise<MailAccount> {
    const ref = `acct-${++counter}-${suffix}`;
    const owner = options.owner ?? { spaceId, userId };
    gmail.addMailbox(ref);
    const settings = options.scope === "settings";
    if (settings) gmail.grantScope(ref, GMAIL_SETTINGS_BASIC);
    const row = await prisma.connection.create({
      data: {
        ...owner,
        connectorId: options.native === false ? "emulator" : "google",
        provider: "gmail",
        displayName: ref,
        status: "connected",
        providerRef: ref,
        metadata: {
          mailAddress: `${ref}@example.test`,
          scope: `openid ${settings ? GMAIL_SETTINGS_BASIC : ""}`.trim(),
        },
      },
    });
    return account(row.id, owner);
  }
  async function account(id: string, owner = { spaceId, userId }): Promise<MailAccount> {
    const accounts = await mail.listAccounts(owner, { ...context(), ...owner });
    return accounts.find((a) => a.id === id) as MailAccount;
  }
  /** Grants the permission everywhere: in the emulated Gmail and on the connection row. */
  async function grant(a: MailAccount) {
    gmail.grantScope(a.accountRef, GMAIL_SETTINGS_BASIC);
    await prisma.connection.update({
      where: { id: a.id },
      data: { metadata: { mailAddress: a.address, scope: `openid ${GMAIL_SETTINGS_BASIC}` } },
    });
    return account(a.id);
  }
  const skip = (
    a: MailAccount,
    address = SENDER,
    data: { ruleId?: string; ruleStatus?: string } = {},
  ) =>
    prisma.mailSenderDecision.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectionId: a.id,
        senderAddress: address,
        skipInboxAt: new Date(),
        ...data,
      },
    });
  const decision = (a: MailAccount, address = SENDER) =>
    prisma.mailSenderDecision.findFirstOrThrow({
      where: { connectionId: a.id, senderAddress: address },
    });
  const ensure = (a: MailAccount, address = SENDER, writesDisabled = false) =>
    ensureSenderRule(deps(writesDisabled), a, context(), address);

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    gmail = new GmailApiEmulator({ mailboxes: {} });
    mail = createMailProvider({
      prisma,
      connectors: { managed: () => connector },
      sleep: async () => {},
      random: () => 0,
    });
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: organizationId, name: "Rule Org", slug: organizationId, createdAt: new Date() },
    });
    for (const id of [spaceId, otherSpaceId])
      await prisma.space.create({
        data: { id, organizationId, name: id, isDefault: id === spaceId },
      });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("creates one filter for a skipped sender on a ready account and makes no second request", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);

    expect(await ensure(a)).toBe("active");

    const filters = gmail.filtersOf(a.accountRef);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({
      criteria: { from: SENDER },
      action: { removeLabelIds: ["INBOX"] },
    });
    expect(await decision(a)).toMatchObject({ ruleId: filters[0]?.id, ruleStatus: "active" });
    const before = requestsOf(a).length;
    expect(await ensure(a)).toBe("active");
    expect(requestsOf(a)).toHaveLength(before);
  });

  it("waits as pending without permission, never flags a reconnect, and creates the filter once the account has it", async () => {
    const a = await connect({ scope: "none" });
    await skip(a);

    expect(await ensure(a)).toBe("pending");

    expect(requestsOf(a)).toHaveLength(0);
    expect(await decision(a)).toMatchObject({ ruleId: null, ruleStatus: "pending" });
    expect(await prisma.mailSyncState.findUnique({ where: { connectionId: a.id } })).toBeNull();
    // Still without the permission, a sync does nothing.
    expect(await applyPendingSenderRules(deps(), a, context())).toBe(0);
    expect(requestsOf(a)).toHaveLength(0);

    const ready = await grant(a);
    expect(await applyPendingSenderRules(deps(), ready, context())).toBe(1);
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(1);
    expect(await decision(a)).toMatchObject({ ruleStatus: "active" });
    expect((await decision(a)).ruleId).toBeTruthy();
  });

  it("does nothing for a route that cannot hold filters", async () => {
    const a = await connect({ native: false });
    await skip(a);
    expect(a.senderRules).toBe("unsupported");

    expect(await ensure(a)).toBeNull();

    expect(requestsOf(a)).toHaveLength(0);
    expect(await decision(a)).toMatchObject({ ruleId: null, ruleStatus: null });
  });

  it("does nothing for a sender with no skip decision", async () => {
    const a = await connect({ scope: "settings" });
    await prisma.mailSenderDecision.create({
      data: { spaceId, userId, connectionId: a.id, senderAddress: SENDER },
    });
    expect(await ensure(a)).toBeNull();
    expect(await ensure(a, "nobody@lists.example.test")).toBeNull();
    expect(requestsOf(a)).toHaveLength(0);
  });

  it("keeps the skip and records a full quota at 1,000 filters", async () => {
    const a = await connect({ scope: "settings" });
    gmail.fillFilters(a.accountRef, 1000);
    await skip(a);

    expect(await ensure(a)).toBe("full");

    const d = await decision(a);
    expect(d).toMatchObject({ ruleId: null, ruleStatus: "full" });
    expect(d.skipInboxAt).not.toBeNull();
    expect(requestsOf(a, "POST")).toHaveLength(0);
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(1000);
  });

  it("records a provider failure as failed, and a withdrawn permission as pending", async () => {
    const down = await connect({ scope: "settings" });
    await skip(down);
    gmail.failNext(503, { urlIncludes: FILTERS, times: 20 });
    expect(await ensure(down)).toBe("failed");
    gmail.clearFailures();
    expect(await decision(down)).toMatchObject({ ruleId: null, ruleStatus: "failed" });
    // A later attempt can succeed.
    expect(await ensure(down)).toBe("active");

    // The connection says it has the permission, but Google no longer does.
    const revoked = await connect({ scope: "none" });
    await prisma.connection.update({
      where: { id: revoked.id },
      data: { metadata: { scope: GMAIL_SETTINGS_BASIC } },
    });
    await skip(revoked);
    expect(await ensure(await account(revoked.id))).toBe("pending");
    expect(
      await prisma.mailSyncState.findUnique({ where: { connectionId: revoked.id } }),
    ).toBeNull();
  });

  it("adopts an identical filter the user made, and never deletes it", async () => {
    const a = await connect({ scope: "settings" });
    const theirs = gmail.addFilter(a.accountRef, {
      criteria: { from: SENDER },
      action: { removeLabelIds: ["INBOX"] },
    });
    await skip(a);

    expect(await ensure(a)).toBe("active");

    expect(await decision(a)).toMatchObject({ ruleId: null, ruleStatus: "active" });
    expect(requestsOf(a, "POST")).toHaveLength(0);
    const d = await decision(a);
    expect(await removeSenderRules(deps(), a, context(), [d])).toEqual({ failed: 0 });
    expect(requestsOf(a, "DELETE")).toHaveLength(0);
    expect(gmail.filtersOf(a.accountRef).map((f) => f.id)).toEqual([theirs.id]);
  });

  it("leaves exactly one filter when two requests race", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);

    const results = await Promise.all([ensure(a), ensure(a), ensure(a)]);

    expect(results).toEqual(["active", "active", "active"]);
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(1);
    expect((await decision(a)).ruleId).toBe(gmail.filtersOf(a.accountRef)[0]?.id);
  });

  it("makes no filter for a sender marked important", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);
    await prisma.inboxSenderFeedback.create({
      data: { spaceId, userId, senderAddress: SENDER, mark: "important" },
    });
    try {
      expect(await ensure(a)).toBeNull();
    } finally {
      await prisma.inboxSenderFeedback.deleteMany({ where: { spaceId, userId } });
    }
    expect(requestsOf(a)).toHaveLength(0);
    expect(await decision(a)).toMatchObject({ ruleId: null, ruleStatus: null });
  });

  it("changes nothing while writes are switched off", async () => {
    const ready = await connect({ scope: "settings" });
    await skip(ready);
    const waiting = await connect({ scope: "none" });
    await skip(waiting, SENDER, { ruleStatus: "pending" });
    const withRule = await connect({ scope: "settings" });
    await skip(withRule);
    expect(await ensure(withRule)).toBe("active");
    const before = gmail.requests.length;

    expect(await ensure(ready, SENDER, true)).toBeNull();
    expect(await applyPendingSenderRules(deps(true), await grant(waiting), context())).toBe(0);
    const d = await decision(withRule);
    expect(await removeSenderRules(deps(true), withRule, context(), [d])).toEqual({ failed: 1 });

    expect(gmail.requests).toHaveLength(before);
    expect(await decision(ready)).toMatchObject({ ruleStatus: null });
    expect(await decision(waiting)).toMatchObject({ ruleStatus: "pending" });
    expect(await decision(withRule)).toMatchObject({ ruleId: d.ruleId, ruleStatus: "active" });
  });

  it("touches only its own user, space, connection and sender", async () => {
    const mine = await connect({ scope: "settings" });
    const sameBox = await connect({ scope: "settings" });
    const stranger = await connect({
      scope: "settings",
      owner: { spaceId: otherSpaceId, userId: otherUserId },
    });
    await skip(mine);
    await skip(sameBox);
    await skip(stranger);
    await skip(mine, "other@lists.example.test");

    expect(await ensure(mine)).toBe("active");

    expect(await decision(sameBox)).toMatchObject({ ruleId: null, ruleStatus: null });
    expect(await decision(stranger)).toMatchObject({ ruleId: null, ruleStatus: null });
    expect(await decision(mine, "other@lists.example.test")).toMatchObject({ ruleId: null });
    expect(gmail.filtersOf(sameBox.accountRef)).toHaveLength(0);
    expect(gmail.filtersOf(stranger.accountRef)).toHaveLength(0);
    // Another user's account cannot be acted on with this user's context.
    expect(await ensureSenderRule(deps(), stranger, context(), SENDER)).toBeNull();
    expect(gmail.filtersOf(stranger.accountRef)).toHaveLength(0);
  });

  it("removes a filter, ignoring one already gone, and keeps the id when Gmail is down", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);
    await ensure(a);
    const d = await decision(a);
    gmail.failNext(503, { urlIncludes: FILTERS, times: 20 });

    expect(await removeSenderRules(deps(), a, context(), [d])).toEqual({ failed: 1 });
    gmail.clearFailures();
    expect(await decision(a)).toMatchObject({ ruleId: d.ruleId, ruleStatus: "active" });
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(1);

    expect(await removeSenderRules(deps(), a, context(), [d])).toEqual({ failed: 0 });
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(0);
    expect(await decision(a)).toMatchObject({ ruleId: null, ruleStatus: null });
    // Deleted in Gmail already: still a success.
    expect(await removeSenderRules(deps(), a, context(), [{ id: d.id, ruleId: d.ruleId }])).toEqual(
      { failed: 0 },
    );
  });

  it("treats an auth error as nothing left to manage only on an account without the permission", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);
    await ensure(a);
    const d = await decision(a);
    gmail.revokeScope(a.accountRef, GMAIL_SETTINGS_BASIC);

    // The account still says it has the permission, so this is a token problem: keep the filter id.
    expect(await removeSenderRules(deps(), a, context(), [d])).toEqual({ failed: 1 });
    expect(await decision(a)).toMatchObject({ ruleId: d.ruleId });

    const withdrawn = { ...a, senderRules: "needs_permission" as const };
    expect(await removeSenderRules(deps(), withdrawn, context(), [d])).toEqual({ failed: 0 });
    expect(await decision(a)).toMatchObject({ ruleId: null });
  });

  it("counts a filter as failed when its account cannot be reached", async () => {
    const a = await connect({ scope: "settings" });
    await skip(a);
    await ensure(a);
    const d = await decision(a);

    expect(await removeSenderRules(deps(), undefined, context(), [d])).toEqual({ failed: 1 });
    expect(await decision(a)).toMatchObject({ ruleId: d.ruleId });
  });

  it("gives at most 20 waiting senders a filter per run", async () => {
    const waiting = await connect({ scope: "none" });
    for (let i = 0; i < 25; i++)
      await skip(waiting, `s${i}@lists.example.test`, { ruleStatus: "pending" });
    const ready = await grant(waiting);

    expect(await applyPendingSenderRules(deps(), ready, context())).toBe(20);
    expect(gmail.filtersOf(waiting.accountRef)).toHaveLength(20);
    expect(await applyPendingSenderRules(deps(), ready, context())).toBe(5);
    expect(gmail.filtersOf(waiting.accountRef)).toHaveLength(25);
  });

  it("stops a run at the first sender that hits the quota", async () => {
    const waiting = await connect({ scope: "none" });
    for (let i = 0; i < 3; i++)
      await skip(waiting, `s${i}@lists.example.test`, { ruleStatus: "pending" });
    const ready = await grant(waiting);
    gmail.fillFilters(waiting.accountRef, 1000);

    expect(await applyPendingSenderRules(deps(), ready, context())).toBe(0);

    const statuses = (
      await prisma.mailSenderDecision.findMany({ where: { connectionId: waiting.id } })
    ).map((d) => d.ruleStatus);
    expect(statuses.sort()).toEqual(["full", "pending", "pending"]);
  });

  it("makes the waiting filters at the end of a sync job once the account has the permission", async () => {
    const a = await connect({ scope: "none" });
    await skip(a, SENDER, { ruleStatus: "pending" });
    const jobs: JobPublisher = {
      enqueue: async () => {},
      cancel: async () => {},
      close: async () => {},
    };
    const sync = (writesDisabled = false) =>
      runMailSyncJob(
        { prisma, mail, jobs, mailWritesDisabled: writesDisabled },
        { spaceId, userId, connectionId: a.id },
      );

    await sync();
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(0);

    await grant(a);
    await sync(true);
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(0);
    await sync();
    expect(gmail.filtersOf(a.accountRef)).toHaveLength(1);
    expect(await decision(a)).toMatchObject({ ruleStatus: "active" });
  });
});
