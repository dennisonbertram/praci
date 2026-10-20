import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxFeedbackSet } from "./inbox.js";
import { inboxActionsUndo } from "./inbox-actions.js";
import { inboxCleanupArchive, inboxCleanupForget, inboxCleanupList } from "./inbox-cleanup.js";
import { inboxMoveMany } from "./inbox-modify.js";
import { createMailFixture, daysAgo, type MailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const SETTINGS = "https://www.googleapis.com/auth/gmail.settings.basic";
const NEWS = "news@lists.example.test";
const FILTERS = "settings/filters";

describePostgres("Gmail filters for skipped senders (PostgreSQL + Gmail emulator)", () => {
  let f: MailFixture;
  let counter = 0;
  beforeAll(async () => {
    f = await createMailFixture("cleanrules", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });

  /**
   * A fresh emulated Gmail with one native Google account for user A holding `count` inbox
   * conversations from NEWS. `permission`: the account was connected with the filter permission.
   */
  async function box(permission: boolean, count = 3, who = f.a) {
    await f.wipe();
    const ref = `rules-${++counter}`;
    const ids = Array.from({ length: count }, (_, i) => `${ref}-m${i}`);
    f.seed({ [ref]: ids.map((id) => f.gmailMessage(id)) });
    if (permission) f.gmail.grantScope(ref, SETTINGS);
    const connectionId = await f.connect(who, ref, "connected", {
      connectorId: "google",
      scope: permission ? `openid ${SETTINGS}` : "openid",
    });
    for (const id of ids)
      await f.cache(who, connectionId, id, { from: NEWS, receivedAt: daysAgo(1) });
    await f.prisma.mailSenderStat.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectionId,
        senderAddress: NEWS,
        messageCount: count,
        readCount: 0,
        lastReceivedAt: daysAgo(1),
        bulk: true,
        priorContact: false,
      },
    });
    return { ref, connectionId, ids };
  }
  const skip = (connectionId: string, batchId?: string, who = f.a, deps = f.deps) =>
    inboxCleanupArchive(deps, who, {
      kind: "skip_inbox",
      connectionId,
      address: NEWS,
      ...(batchId ? { batchId } : {}),
    });
  const decision = (connectionId: string) =>
    f.prisma.mailSenderDecision.findFirstOrThrow({
      where: { connectionId, senderAddress: NEWS },
    });
  const filterCalls = (ref: string, method?: string) =>
    f.gmail.requests.filter(
      (r) => r.accountRef === ref && r.url.includes(FILTERS) && (!method || r.method === method),
    );
  const senderOf = async (connectionId: string) =>
    (await inboxCleanupList(f.deps, f.a, {})).senders.find(
      (s) => s.connectionId === connectionId && s.address === NEWS,
    );

  it("makes one filter across pages, archives the mail and lists the rule as active", async () => {
    const { ref, connectionId } = await box(true, 60);

    const first = await skip(connectionId);
    expect(first).toMatchObject({ done: 50, remaining: 10 });
    await skip(connectionId, first.batchId);

    expect(f.gmail.filtersOf(ref)).toHaveLength(1);
    expect(f.gmail.filtersOf(ref)[0]).toMatchObject({
      criteria: { from: NEWS },
      action: { removeLabelIds: ["INBOX"] },
    });
    expect(filterCalls(ref, "POST")).toHaveLength(1);
    expect(await decision(connectionId)).toMatchObject({
      ruleId: f.gmail.filtersOf(ref)[0]?.id,
      ruleStatus: "active",
    });
    expect(f.labelsOf(ref, `${ref}-m0`)).not.toContain("INBOX");
    const list = await inboxCleanupList(f.deps, f.a, {});
    expect(list.senders.find((s) => s.connectionId === connectionId)).toMatchObject({
      skipInbox: true,
      rule: "active",
    });
    expect(list.accounts.find((a) => a.connectionId === connectionId)?.senderRules).toBe("ready");
  });

  it("archives and waits as pending without the permission, with no reconnect flag", async () => {
    const { ref, connectionId, ids } = await box(false);

    expect(await skip(connectionId)).toMatchObject({ done: 3, remaining: 0 });

    expect(f.labelsOf(ref, ids[0] as string)).not.toContain("INBOX");
    expect(filterCalls(ref)).toHaveLength(0);
    expect(await senderOf(connectionId)).toMatchObject({ skipInbox: true, rule: "pending" });
    const list = await inboxCleanupList(f.deps, f.a, {});
    expect(list.accounts.find((a) => a.connectionId === connectionId)?.senderRules).toBe(
      "needs_permission",
    );
    expect(await f.prisma.mailSyncState.findUnique({ where: { connectionId } })).toBeNull();
  });

  it("has no rule on a route that cannot hold filters", async () => {
    await f.wipe();
    f.seed({ "box-a": [f.gmailMessage("plain-1")] });
    await f.cache(f.a, f.connA, "plain-1", { from: NEWS });
    await f.prisma.mailSenderStat.create({
      data: {
        spaceId: f.a.spaceId,
        userId: f.a.userId,
        connectionId: f.connA,
        senderAddress: NEWS,
        messageCount: 1,
        readCount: 0,
        lastReceivedAt: daysAgo(1),
        bulk: true,
        priorContact: false,
      },
    });

    await skip(f.connA);

    expect((await senderOf(f.connA))?.rule).toBeUndefined();
    expect(filterCalls("box-a")).toHaveLength(0);
    const list = await inboxCleanupList(f.deps, f.a, {});
    expect(list.accounts.find((a) => a.connectionId === f.connA)?.senderRules).toBe("unsupported");
  });

  it("keeps the skip and archives when the filter quota is full", async () => {
    const { ref, connectionId } = await box(true);
    f.gmail.fillFilters(ref, 1000);

    expect(await skip(connectionId)).toMatchObject({ done: 3 });

    expect(await decision(connectionId)).toMatchObject({ ruleId: null, ruleStatus: "full" });
    expect((await decision(connectionId)).skipInboxAt).not.toBeNull();
    expect(await senderOf(connectionId)).toMatchObject({ skipInbox: true, rule: "full" });
    expect(f.gmail.filtersOf(ref)).toHaveLength(1000);
  });

  it("retries a failed filter only when Skip inbox is pressed again", async () => {
    const { ref, connectionId } = await box(true, 60);
    f.gmail.failNext(503, { urlIncludes: FILTERS, times: 50 });

    const first = await skip(connectionId);
    expect(first).toMatchObject({ done: 50 });
    expect(await senderOf(connectionId)).toMatchObject({ rule: "failed" });
    f.gmail.clearFailures();

    // Later pages of the same click do not retry.
    await skip(connectionId, first.batchId);
    expect(filterCalls(ref, "POST")).toHaveLength(0);
    expect(await senderOf(connectionId)).toMatchObject({ rule: "failed" });

    // A new click does, even though no inbox mail is left to archive.
    expect(await skip(connectionId)).toMatchObject({ done: 0 });
    expect(await senderOf(connectionId)).toMatchObject({ rule: "active" });
    expect(f.gmail.filtersOf(ref)).toHaveLength(1);
  });

  describe("forget", () => {
    const forget = (connectionId: string, who = f.a, writesDisabled = false) =>
      inboxCleanupForget({ ...f.deps, mailWritesDisabled: writesDisabled }, who, {
        connectionId,
        address: NEWS,
      });

    it("deletes the filter, then the decision", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      expect(f.gmail.filtersOf(ref)).toHaveLength(1);

      await forget(connectionId);

      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(0);
    });

    it("ignores a filter the user already removed in Gmail", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      const id = f.gmail.filtersOf(ref)[0]?.id;
      f.gmail.handle(
        ref,
        `https://gmail.googleapis.com/gmail/v1/users/me/settings/filters/${id}`,
        "DELETE",
      );

      await forget(connectionId);

      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(0);
    });

    it("keeps the decision and reports it when the filter cannot be deleted", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      f.gmail.failNext(503, { urlIncludes: FILTERS, times: 50 });

      await expect(forget(connectionId)).rejects.toMatchObject({
        code: "BAD_GATEWAY",
        message: "Couldn't remove the Gmail filter",
      });
      f.gmail.clearFailures();

      expect(await decision(connectionId)).toMatchObject({ ruleStatus: "active" });
      expect((await decision(connectionId)).ruleId).toBeTruthy();
      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      // The next try works.
      await forget(connectionId);
      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
    });

    it("keeps the decision when the account cannot be listed", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      await f.prisma.connection.update({ where: { id: connectionId }, data: { status: "error" } });

      await expect(forget(connectionId)).rejects.toMatchObject({ code: "BAD_GATEWAY" });

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      expect((await decision(connectionId)).ruleId).toBeTruthy();
    });

    it("refuses while mail writes are off when a filter exists, but forgets a decision with none", async () => {
      const withRule = await box(true);
      await skip(withRule.connectionId);
      await expect(forget(withRule.connectionId, f.a, true)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(f.gmail.filtersOf(withRule.ref)).toHaveLength(1);
      expect(
        await f.prisma.mailSenderDecision.count({ where: { connectionId: withRule.connectionId } }),
      ).toBe(1);

      const without = await box(false);
      await skip(without.connectionId);
      await forget(without.connectionId, f.a, true);
      expect(
        await f.prisma.mailSenderDecision.count({ where: { connectionId: without.connectionId } }),
      ).toBe(0);
    });

    it("cannot be used on another user's decision", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);

      await forget(connectionId, f.b);
      await forget(connectionId, f.c);

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(1);
    });
  });

  describe("undo", () => {
    it("deletes the filter and the decision with a user's skip batch", async () => {
      const { ref, connectionId, ids } = await box(true);
      const out = await skip(connectionId);
      expect(f.gmail.filtersOf(ref)).toHaveLength(1);

      expect(await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId })).toEqual({
        restored: 3,
        failed: 0,
      });

      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(0);
      expect(f.labelsOf(ref, ids[0] as string)).toContain("INBOX");
    });

    it("leaves the batch undoable when the filter cannot be deleted", async () => {
      const { ref, connectionId } = await box(true);
      const out = await skip(connectionId);
      f.gmail.failNext(503, { urlIncludes: FILTERS, times: 50 });

      const first = await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId });
      f.gmail.clearFailures();

      expect(first.failed).toBeGreaterThan(0);
      expect(
        await f.prisma.mailActionLog.count({ where: { batchId: out.batchId, undoneAt: null } }),
      ).toBe(1);
      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(1);

      expect(await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId })).toMatchObject({
        failed: 0,
      });
      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId } })).toBe(0);
    });

    /** A logged batch of NEWS threads, as if an earlier action had archived them. */
    const logged = (
      connectionId: string,
      ids: string[],
      kind: "unsubscribe" | "skip_inbox",
      source: "user" | "auto",
    ) =>
      f.prisma.mailActionLog.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          connectionId,
          batchId: crypto.randomUUID(),
          kind,
          source,
          reason: "cleanup",
          senderAddresses: [NEWS],
          threadIds: ids,
        },
      });

    it("releases the filter when an unsubscribe is undone", async () => {
      const { ref, connectionId, ids } = await box(true);
      await skip(connectionId);
      const log = await logged(connectionId, ids, "unsubscribe", "user");

      await inboxActionsUndo(f.deps, f.a, { batchId: log.batchId });

      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await decision(connectionId)).toMatchObject({
        skipInboxAt: null,
        ruleId: null,
        ruleStatus: null,
      });
    });

    it("leaves the decision and filter alone when an automatic batch is undone", async () => {
      const { ref, connectionId, ids } = await box(true);
      await skip(connectionId);
      const log = await logged(connectionId, ids, "skip_inbox", "auto");

      await inboxActionsUndo(f.deps, f.a, { batchId: log.batchId });

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      expect(await decision(connectionId)).toMatchObject({ ruleStatus: "active" });
    });

    it("cannot be used on another user's batch", async () => {
      const { ref, connectionId } = await box(true);
      const out = await skip(connectionId);

      await expect(inboxActionsUndo(f.deps, f.b, { batchId: out.batchId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
    });
  });
  describe("important sender", () => {
    const messageOf = (connectionId: string) =>
      f.prisma.cachedMailMessage.findFirstOrThrow({ where: { connectionId } });

    it("deletes the filter when the sender is marked important", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      const message = await messageOf(connectionId);

      await inboxFeedbackSet(f.deps, f.a, { messageId: message.id, mark: "important" });

      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await decision(connectionId)).toMatchObject({ ruleId: null, ruleStatus: null });
      expect(await f.prisma.inboxSenderFeedback.count({ where: { senderAddress: NEWS } })).toBe(1);
    });

    it("keeps the filter tracked and reports it when it cannot be deleted", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      const message = await messageOf(connectionId);
      f.gmail.failNext(503, { urlIncludes: FILTERS, times: 50 });

      await expect(
        inboxFeedbackSet(f.deps, f.a, { messageId: message.id, mark: "important" }),
      ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
      f.gmail.clearFailures();

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
      expect((await decision(connectionId)).ruleId).toBeTruthy();
      // Marking again retries the delete.
      await inboxFeedbackSet(f.deps, f.a, { messageId: message.id, mark: "important" });
      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
    });

    it("leaves the filter when the sender is marked as noise", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      const message = await messageOf(connectionId);

      await inboxFeedbackSet(f.deps, f.a, { messageId: message.id, mark: "noise" });

      expect(f.gmail.filtersOf(ref)).toHaveLength(1);
    });

    it("deletes the filter when a message from the sender is marked not spam", async () => {
      const { ref, connectionId } = await box(true);
      await skip(connectionId);
      const message = await messageOf(connectionId);
      await f.prisma.cachedMailMessage.update({
        where: { id: message.id },
        data: { pile: "spam" },
      });

      await inboxMoveMany(f.deps, f.a, { op: "notSpam", messageIds: [message.id] });

      expect(f.gmail.filtersOf(ref)).toHaveLength(0);
      expect(await decision(connectionId)).toMatchObject({ ruleId: null });
    });
  });
});
