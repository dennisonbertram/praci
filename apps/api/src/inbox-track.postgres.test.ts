import { listScratchpadItems } from "@rakazo/adapters";
import { FIRST_BOT_SPAWN_KEY } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxList } from "./inbox.js";
import { inboxTrack, inboxUntrack } from "./inbox-track.js";
import type { MailFixture } from "./test-support/mail-fixture.js";
import { createMailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("track a mail thread in the Chief's Open work (PostgreSQL)", () => {
  let f: MailFixture;
  let chiefId: string;
  beforeAll(async () => {
    f = await createMailFixture("track", databaseUrl as string);
    chiefId = (
      await f.prisma.bot.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          name: "Chief",
          color: "#000000",
          spawnKey: FIRST_BOT_SPAWN_KEY,
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (f) {
      await f.prisma.scratchpadItem.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
      await f.prisma.bot.deleteMany({ where: { spaceId: { in: f.spaceIds } } });
      await f.wipe();
      await f.dispose();
    }
  });

  const items = (includeDone = false) =>
    listScratchpadItems(
      { prisma: f.prisma },
      { spaceId: f.a.spaceId, userId: f.a.userId, botId: chiefId, includeDone },
    );

  it("tracks once, flags the list row, and untrack marks the item done", async () => {
    await f.wipe();
    await f.prisma.scratchpadItem.deleteMany({ where: { spaceId: f.a.spaceId } });
    const message = await f.cache(f.a, f.connA, "m1", { threadId: "t1" });
    f.seed({ "box-a": [f.gmailMessage("m1")] });

    await inboxTrack(f.prisma, f.a, message.id);
    await inboxTrack(f.prisma, f.a, message.id);
    const open = await items();
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      title: "Subject m1",
      waitingOn: "News",
      status: "open",
      mailMessageId: "m1",
    });

    const list = await inboxList(f.deps, f.a, {});
    expect(list.rows.find((r) => r.id === message.id)?.tracked).toBe(true);

    await inboxUntrack(f.prisma, f.a, message.id);
    expect(await items()).toHaveLength(0);
    const done = await items(true);
    expect(done[0]).toMatchObject({
      status: "done",
      resolvedReason: "Stopped tracking from Inbox",
    });
    const after = await inboxList(f.deps, f.a, {});
    expect(after.rows.find((r) => r.id === message.id)?.tracked).toBeUndefined();

    // A finished item does not block tracking the thread again.
    await inboxTrack(f.prisma, f.a, message.id);
    expect(await items()).toHaveLength(1);
  });

  it("refuses a message the caller does not own, and a caller with no Chief", async () => {
    await f.wipe();
    await f.prisma.scratchpadItem.deleteMany({ where: { spaceId: f.a.spaceId } });
    const mine = await f.cache(f.a, f.connA, "m2");
    const theirs = await f.cache(f.b, f.connB, "b2");
    await expect(inboxTrack(f.prisma, f.b, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(inboxTrack(f.prisma, f.c, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(inboxUntrack(f.prisma, f.b, mine.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // User b owns the message but has no Chief bot.
    await expect(inboxTrack(f.prisma, f.b, theirs.id)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await items()).toHaveLength(0);
  });
});
