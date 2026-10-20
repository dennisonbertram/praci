import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxList } from "./inbox.js";
import { inboxMoveMany } from "./inbox-modify.js";
import { createMailFixture, type MailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("spam and trash (PostgreSQL + Gmail emulator)", () => {
  let f: MailFixture;
  beforeAll(async () => {
    f = await createMailFixture("move", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });
  const setup = async () => {
    await f.wipe();
    f.seed({
      "box-a": [
        f.gmailMessage("m1"),
        f.gmailMessage("m2"),
        f.gmailMessage("m3"),
        f.gmailMessage("junk", "J <j@x.example.test>", ["SPAM"]),
      ],
      "box-a2": [f.gmailMessage("x1")],
      "box-b": [f.gmailMessage("b1")],
    });
    return {
      m1: await f.cache(f.a, f.connA, "m1"),
      m2: await f.cache(f.a, f.connA, "m2"),
      archived: await f.cache(f.a, f.connA, "m3", { inInbox: false }),
      junk: await f.cache(f.a, f.connA, "junk", { inInbox: false, isSpam: true, pile: "spam" }),
      other: await f.cache(f.a, f.connA2, "x1"),
      theirs: await f.cache(f.b, f.connB, "b1"),
    };
  };
  const row = (providerMessageId: string) =>
    f.prisma.cachedMailMessage.findFirstOrThrow({
      where: { providerMessageId, userId: f.a.userId },
    });

  it("spam sets SPAM in Gmail, isSpam in the cache and one log row per account", async () => {
    const r = await setup();
    const out = await inboxMoveMany(f.deps, f.a, { op: "spam", messageIds: [r.m1.id, r.other.id] });

    expect(out.failed).toEqual([]);
    expect([...out.done].sort()).toEqual([r.m1.id, r.other.id].sort());
    expect(f.labelsOf("box-a", "m1")).toEqual(["SPAM"]);
    expect(await row("m1")).toMatchObject({ inInbox: false, isSpam: true });
    const logs = await f.prisma.mailActionLog.findMany({ where: { batchId: out.batchId } });
    expect(logs.map((l) => [l.kind, l.source, l.reason, l.connectionId]).sort()).toEqual(
      [
        ["spam", "user", "selection", f.connA],
        ["spam", "user", "selection", f.connA2],
      ].sort(),
    );
    expect(logs.find((l) => l.connectionId === f.connA)?.threadIds).toEqual(["m1"]);
  });

  it("not spam puts the thread back in the inbox", async () => {
    const r = await setup();
    const out = await inboxMoveMany(f.deps, f.a, { op: "notSpam", messageIds: [r.junk.id] });

    expect(out.done).toEqual([r.junk.id]);
    expect(f.labelsOf("box-a", "junk")).toEqual(["INBOX"]);
    expect(await row("junk")).toMatchObject({ inInbox: true, isSpam: false });
    expect(
      (await f.prisma.mailActionLog.findFirstOrThrow({ where: { batchId: out.batchId } })).kind,
    ).toBe("not_spam");
  });

  it("not spam takes Gmail-spam mail and rule-classified inbox mail out of the Spam pile", async () => {
    const r = await setup();
    const ruled = await f.cache(f.a, f.connA, "ruled", {
      from: "help@paypa1-secure.example.test",
      pile: "spam",
    });
    const out = await inboxMoveMany(f.deps, f.a, {
      op: "notSpam",
      messageIds: [r.junk.id, ruled.id],
    });

    expect(out.failed).toEqual([]);
    expect(await row("junk")).toMatchObject({ inInbox: true, isSpam: false, pile: null });
    const subjects = async (pile: "spam" | "important") =>
      (await inboxList(f.deps, f.a, { pile })).rows.map((x) => x.subject);
    expect(await subjects("spam")).toEqual([]);
    expect(await subjects("important")).toContain("Subject junk");
    // Only the rule-classified sender is remembered, so the next sync does not re-assign spam.
    expect(
      await f.prisma.inboxSenderFeedback.findMany({
        where: { userId: f.a.userId },
        select: { senderAddress: true, mark: true },
      }),
    ).toEqual([{ senderAddress: "help@paypa1-secure.example.test", mark: "important" }]);
  });

  it("trash sets TRASH and takes the thread out of the inbox", async () => {
    const r = await setup();
    const out = await inboxMoveMany(f.deps, f.a, { op: "trash", messageIds: [r.m2.id] });

    expect(out.done).toEqual([r.m2.id]);
    expect(f.labelsOf("box-a", "m2")).toEqual(["TRASH"]);
    expect(await row("m2")).toMatchObject({ inInbox: false });
  });

  it("reports mail outside the inbox, mail that is not spam and foreign ids as not_found", async () => {
    const r = await setup();
    const spam = await inboxMoveMany(f.deps, f.a, {
      op: "spam",
      messageIds: [r.archived.id, r.junk.id, r.theirs.id, "no-such-id"],
    });
    expect(spam.done).toEqual([]);
    expect(spam.failed.map((x) => x.reason)).toEqual([
      "not_found",
      "not_found",
      "not_found",
      "not_found",
    ]);
    const notSpam = await inboxMoveMany(f.deps, f.a, { op: "notSpam", messageIds: [r.m1.id] });
    expect(notSpam.failed).toEqual([{ messageId: r.m1.id, reason: "not_found" }]);
    expect(await f.prisma.mailActionLog.count({ where: { connectionId: f.connA } })).toBe(0);
  });

  it("refuses when mail writes are off and rejects an empty or oversized selection at the contract", async () => {
    const r = await setup();
    await expect(
      inboxMoveMany({ ...f.deps, mailWritesDisabled: true }, f.a, {
        op: "trash",
        messageIds: [r.m1.id],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const { InboxMoveInputSchema } = await import("@rakazo/contracts");
    expect(InboxMoveInputSchema.safeParse({ op: "spam", messageIds: [] }).success).toBe(false);
    expect(
      InboxMoveInputSchema.safeParse({
        op: "spam",
        messageIds: Array.from({ length: 51 }, (_, i) => `id-${i}`),
      }).success,
    ).toBe(false);
  });
});
