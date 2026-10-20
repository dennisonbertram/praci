import { createRouterClient } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRouter, type RouterDeps } from "./router.js";
import { createMailFixture, type MailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const NEWS = "news@lists.example.test";

describePostgres("cleanup procedures through the router (PostgreSQL)", () => {
  let f: MailFixture;
  beforeAll(async () => {
    f = await createMailFixture("router", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });
  const clientFor = (actor: MailFixture["a"]) =>
    createRouterClient(
      createRouter({ ...f.deps, env: { mailWritesDisabled: false } } as unknown as RouterDeps),
      { context: { actor } as never },
    );

  it("serves list, archive, actions, moveMany, unsubscribe and forget for the signed-in user only", async () => {
    await f.wipe();
    f.seed({
      "box-a": [f.gmailMessage("m1"), f.gmailMessage("m2")],
      "box-b": [f.gmailMessage("b1")],
    });
    await f.cache(f.a, f.connA, "m1");
    const m2 = await f.cache(f.a, f.connA, "m2", { from: "other@lists.example.test" });
    await f.cache(f.b, f.connB, "b1");
    for (const [who, connectionId, address] of [
      [f.a, f.connA, NEWS],
      [f.b, f.connB, NEWS],
    ] as const)
      await f.prisma.mailSenderStat.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectionId,
          senderAddress: address,
          messageCount: 4,
          readCount: 0,
          bulk: true,
          priorContact: false,
        },
      });
    const mine = clientFor(f.a);

    const list = await mine.inbox.cleanup.list({});
    expect(list.senders.map((s) => s.address)).toEqual([NEWS]);
    await expect(mine.inbox.cleanup.list({ connectionId: f.connB })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const archived = await mine.inbox.cleanup.archive({
      kind: "archive",
      connectionId: f.connA,
      address: NEWS,
    });
    expect(archived).toMatchObject({ done: 1, remaining: 0 });
    await expect(
      mine.inbox.cleanup.archive({ kind: "archive", connectionId: f.connB, address: NEWS }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const actions = await mine.inbox.actions.list({});
    expect(actions.actions.map((a) => a.batchId)).toEqual([archived.batchId]);
    expect((await clientFor(f.b).inbox.actions.list({})).actions).toEqual([]);
    expect(await mine.inbox.actions.undo({ batchId: archived.batchId })).toEqual({
      restored: 1,
      failed: 0,
    });

    const spam = await mine.inbox.moveMany({ op: "spam", messageIds: [m2.id] });
    expect(spam.done).toEqual([m2.id]);
    await expect(mine.inbox.moveMany({ op: "spam", messageIds: [] })).rejects.toThrow();

    const unsub = await mine.inbox.unsubscribe({ connectionId: f.connA, address: NEWS });
    expect(unsub).toEqual({
      status: "opened",
      method: "link",
      openUrl: "https://lists.example.test/u/1",
    });
    expect(await mine.inbox.cleanup.forget({ connectionId: f.connA, address: NEWS })).toEqual({
      ok: true,
    });
    expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connA } })).toBe(0);
  });
});
