import { applySkipInbox } from "@rakazo/adapters";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxActionsList, inboxActionsUndo } from "./inbox-actions.js";
import { inboxCleanupArchive } from "./inbox-cleanup.js";
import { inboxMoveMany } from "./inbox-modify.js";
import { createMailFixture, type MailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const NEWS = "news@lists.example.test";

describePostgres("action log and undo (PostgreSQL + Gmail emulator)", () => {
  let f: MailFixture;
  beforeAll(async () => {
    f = await createMailFixture("actions", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });
  const row = (id: string) =>
    f.prisma.cachedMailMessage.findFirstOrThrow({
      where: { providerMessageId: id, userId: f.a.userId },
    });
  const setup = async (ids = ["m1", "m2"]) => {
    await f.wipe();
    f.seed({ "box-a": ids.map((id) => f.gmailMessage(id)), "box-b": [f.gmailMessage("b1")] });
    for (const id of ids) await f.cache(f.a, f.connA, id);
  };
  const archive = (kind: "archive" | "skip_inbox" | "spam" = "archive") =>
    inboxCleanupArchive(f.deps, f.a, { kind, connectionId: f.connA, address: NEWS });
  const rowOf = (batchId: string) =>
    f.prisma.mailActionLog.findFirstOrThrow({ where: { batchId } });

  it("lists the latest actions first, scoped to the caller, as one entry per batch", async () => {
    await setup();
    const first = await archive();
    await f.cache(f.a, f.connA, "m3");
    f.seed({ "box-a": [f.gmailMessage("m3")] });
    const second = await archive("spam");
    await f.prisma.mailActionLog.create({
      data: {
        spaceId: f.b.spaceId,
        userId: f.b.userId,
        connectionId: f.connB,
        batchId: "theirs",
        kind: "archive",
        source: "user",
        reason: "cleanup",
        threadIds: ["b1"],
      },
    });

    const { actions } = await inboxActionsList(f.deps, f.a);

    expect(actions.map((a) => a.batchId)).toEqual([second.batchId, first.batchId]);
    expect(actions[1]).toMatchObject({
      kind: "archive",
      source: "user",
      reason: "cleanup",
      undone: false,
      threadCount: 2,
      senders: [NEWS],
      senderCount: 1,
    });
  });

  it("undoes an archive in Gmail and the cache and marks it undone, once", async () => {
    await setup();
    const out = await archive();
    expect(f.labelsOf("box-a", "m1")).not.toContain("INBOX");

    expect(await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId })).toEqual({
      restored: 2,
      failed: 0,
    });

    expect(f.labelsOf("box-a", "m1")).toContain("INBOX");
    expect(await row("m1")).toMatchObject({ inInbox: true });
    expect((await rowOf(out.batchId)).undoneAt).not.toBeNull();
    await expect(inboxActionsUndo(f.deps, f.a, { batchId: out.batchId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await inboxActionsList(f.deps, f.a)).actions[0]?.undone).toBe(true);
  });

  it("undoes a user's skip inbox by forgetting the decision", async () => {
    await setup();
    const out = await archive("skip_inbox");
    expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connA } })).toBe(1);

    await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId });

    expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connA } })).toBe(0);
    expect(f.labelsOf("box-a", "m1")).toContain("INBOX");
  });

  it("undoes an automatic archive without forgetting the sender, and sync does not archive it again", async () => {
    await setup();
    await f.prisma.mailSenderDecision.create({
      data: {
        spaceId: f.a.spaceId,
        userId: f.a.userId,
        connectionId: f.connA,
        senderAddress: NEWS,
        skipInboxAt: new Date(Date.now() - 86_400_000 * 3),
      },
    });
    const [account] = (
      await f.mail.listAccounts(
        { spaceId: f.a.spaceId, userId: f.a.userId },
        {
          operationId: "t",
          traceId: "t",
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          signal: new AbortController().signal,
        },
      )
    ).filter((x) => x.id === f.connA);
    const context = {
      operationId: "t",
      traceId: "t",
      spaceId: f.a.spaceId,
      userId: f.a.userId,
      signal: new AbortController().signal,
    };
    await applySkipInbox({ prisma: f.prisma, mail: f.mail }, account as never, context);
    const { actions } = await inboxActionsList(f.deps, f.a);
    expect(actions[0]).toMatchObject({ kind: "skip_inbox", source: "auto" });

    await inboxActionsUndo(f.deps, f.a, { batchId: actions[0]?.batchId as string });

    expect(f.labelsOf("box-a", "m1")).toContain("INBOX");
    expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connA } })).toBe(1);
    expect(
      await applySkipInbox({ prisma: f.prisma, mail: f.mail }, account as never, context),
    ).toBe(0);
    expect(f.labelsOf("box-a", "m1")).toContain("INBOX");
  });

  it("undoes spam and not spam, and trash even after sync removed the cache rows", async () => {
    await setup();
    const m1 = await row("m1");
    const spam = await inboxMoveMany(f.deps, f.a, { op: "spam", messageIds: [m1.id] });
    await inboxActionsUndo(f.deps, f.a, { batchId: spam.batchId });
    expect(f.labelsOf("box-a", "m1")).toEqual(["INBOX"]);
    expect(await row("m1")).toMatchObject({ inInbox: true, isSpam: false });

    const trash = await inboxMoveMany(f.deps, f.a, { op: "trash", messageIds: [m1.id] });
    expect(f.labelsOf("box-a", "m1")).toEqual(["TRASH"]);
    await f.prisma.cachedMailMessage.deleteMany({
      where: { providerMessageId: "m1", userId: f.a.userId },
    });
    expect(await inboxActionsUndo(f.deps, f.a, { batchId: trash.batchId })).toEqual({
      restored: 1,
      failed: 0,
    });
    expect(f.labelsOf("box-a", "m1")).toEqual(["INBOX"]);
  });

  it("refuses another user's batch and writes-disabled, and keeps a partly failed batch undoable", async () => {
    await setup();
    const out = await archive();

    await expect(inboxActionsUndo(f.deps, f.b, { batchId: out.batchId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      inboxActionsUndo({ ...f.deps, mailWritesDisabled: true }, f.a, { batchId: out.batchId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    f.gmail.failNext(500, { urlIncludes: "/modify", times: 3 });
    const partial = await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId });
    expect(partial.failed).toBeGreaterThan(0);
    expect((await rowOf(out.batchId)).undoneAt).toBeNull();

    f.gmail.clearFailures();
    expect(await inboxActionsUndo(f.deps, f.a, { batchId: out.batchId })).toEqual({
      restored: 2,
      failed: 0,
    });
  });
});
