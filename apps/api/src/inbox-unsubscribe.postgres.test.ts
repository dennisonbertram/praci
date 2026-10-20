import type { MailUnsubscriber } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { parseRawMime } from "@rakazo/adapters";
import type { MailSignals } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxUnsubscribe } from "./inbox-unsubscribe.js";
import type { MailFixture } from "./test-support/mail-fixture.js";
import { bulkSignals, createMailFixture } from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const NEWS = "news@lists.example.test";
const oneClick: MailSignals = {
  ...bulkSignals,
  listUnsubscribe: [
    "https://lists.example.test/u/1",
    "mailto:unsub@lists.example.test?subject=stop",
  ],
  oneClick: true,
  dkimCoversUnsubscribe: true,
};

describePostgres("inbox unsubscribe (PostgreSQL + Gmail emulator)", () => {
  let f: MailFixture;
  let posts: string[];
  let postFails: boolean;
  const unsubscriber: MailUnsubscriber = {
    oneClick: async (url) => {
      posts.push(url);
      if (postFails) throw new MailProviderError("unavailable", "down");
    },
  };
  const run = (
    signals: MailSignals | null,
    input: { confirmMailto?: boolean; address?: string; connectionId?: string } = {},
    options: { writesDisabled?: boolean; who?: MailFixture["a"]; withUnsubscriber?: boolean } = {},
  ) =>
    (async () => {
      if (signals !== undefined) {
        await f.wipe();
        f.seed({ "box-a": [f.gmailMessage("m1")] });
        await f.cache(f.a, f.connA, "m1", { from: NEWS, signals });
      }
      return inboxUnsubscribe(
        {
          ...f.deps,
          mailWritesDisabled: options.writesDisabled,
          unsubscriber: options.withUnsubscriber === false ? undefined : unsubscriber,
        },
        options.who ?? f.a,
        {
          connectionId: input.connectionId ?? f.connA,
          address: input.address ?? NEWS,
          confirmMailto: input.confirmMailto,
        },
      );
    })();
  const decision = () =>
    f.prisma.mailSenderDecision.findFirst({
      where: { connectionId: f.connA, senderAddress: NEWS },
    });

  beforeAll(async () => {
    f = await createMailFixture("unsub", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });
  const reset = () => {
    posts = [];
    postFails = false;
  };

  it("posts once for a one-click sender, records it and starts skipping the inbox", async () => {
    reset();
    const out = await run(oneClick);

    expect(out).toEqual({ status: "done", method: "one_click" });
    expect(posts).toEqual(["https://lists.example.test/u/1"]);
    expect(await decision()).toMatchObject({
      unsubscribeStatus: "done",
      unsubscribeMethod: "one_click",
      unsubscribedAt: expect.any(Date),
      skipInboxAt: expect.any(Date),
    });
  });

  it("returns the link after a failed one-click POST and does not start skipping", async () => {
    reset();
    postFails = true;
    const out = await run(oneClick);

    expect(out).toEqual({
      status: "failed",
      method: "one_click",
      openUrl: "https://lists.example.test/u/1",
    });
    expect(await decision()).toMatchObject({ unsubscribeStatus: "failed", skipInboxAt: null });
  });

  it("opens the link, without a POST, when DKIM does not cover the headers", async () => {
    reset();
    const out = await run({ ...oneClick, dkimCoversUnsubscribe: false });

    expect(out).toEqual({
      status: "opened",
      method: "link",
      openUrl: "https://lists.example.test/u/1",
    });
    expect(posts).toEqual([]);
    expect(await decision()).toMatchObject({
      unsubscribeStatus: "opened",
      unsubscribeMethod: "link",
    });
  });

  it("degrades a one-click sender to its link when no unsubscriber is configured", async () => {
    reset();
    const out = await run(oneClick, {}, { withUnsubscriber: false });
    expect(out.status).toBe("opened");
  });

  it("asks before emailing a mailto and sends nothing until confirmed", async () => {
    reset();
    const mailto = {
      ...bulkSignals,
      listUnsubscribe: ["mailto:unsub@lists.example.test?subject=stop%20me"],
    };
    const asked = await run(mailto);

    expect(asked).toEqual({
      status: "needs_confirmation",
      method: "mailto",
      mailTo: "unsub@lists.example.test",
    });
    expect(f.gmail.sentOf("box-a")).toHaveLength(0);
    expect(await decision()).toBeNull();

    const sent = await inboxUnsubscribe({ ...f.deps, unsubscriber }, f.a, {
      connectionId: f.connA,
      address: NEWS,
      confirmMailto: true,
    });
    expect(sent).toEqual({ status: "sent", method: "mailto" });
    // A repeat of the confirmed call sends no second email.
    await inboxUnsubscribe({ ...f.deps, unsubscriber }, f.a, {
      connectionId: f.connA,
      address: NEWS,
      confirmMailto: true,
    });
    expect(f.gmail.sentOf("box-a")).toHaveLength(1);
    expect(await decision()).toMatchObject({
      unsubscribeStatus: "sent",
      unsubscribeMethod: "mailto",
      skipInboxAt: expect.any(Date),
    });
  });

  it("builds the unsubscribe email from the parsed mailto only", async () => {
    reset();
    const mailto = {
      ...bulkSignals,
      listUnsubscribe: [
        "mailto:unsub@lists.example.test?subject=stop%20me&body=bye&cc=x@example.test&bcc=y@example.test",
      ],
    };
    await run(mailto);
    await inboxUnsubscribe({ ...f.deps, unsubscriber }, f.a, {
      connectionId: f.connA,
      address: NEWS,
      confirmMailto: true,
    });

    const [sent] = f.gmail.sentOf("box-a");
    const mime = parseRawMime(sent?.raw ?? "");
    expect(mime.header("To")).toContain("unsub@lists.example.test");
    expect(mime.header("Subject")).toBe("stop me");
    expect(mime.header("Cc") ?? "").toBe("");
    expect(mime.header("Bcc") ?? "").toBe("");
    expect(mime.text).toContain("bye");
  });

  it("refuses spam-like and failed-authentication senders, records the attempt and never posts", async () => {
    reset();
    for (const signals of [
      { ...oneClick, categories: { ...oneClick.categories, spam: true } },
      { ...oneClick, auth: { dkim: "pass", spf: "fail", dmarc: "pass" } as MailSignals["auth"] },
    ]) {
      expect(await run(signals)).toEqual({ status: "refused", method: null });
      expect(await decision()).toMatchObject({ unsubscribeStatus: "refused", skipInboxAt: null });
    }
    expect(posts).toEqual([]);
  });

  it("is unavailable, and records nothing, when the sender has no unsubscribe target", async () => {
    reset();
    expect(await run({ ...bulkSignals, listUnsubscribe: [] })).toEqual({
      status: "unavailable",
      method: null,
    });
    expect(await decision()).toBeNull();
  });

  it("blocks one click and mailto, not the link, when mail writes are off", async () => {
    reset();
    expect(await run(oneClick, {}, { writesDisabled: true })).toEqual({
      status: "disabled",
      method: "one_click",
    });
    expect(
      await run(
        { ...bulkSignals, listUnsubscribe: ["mailto:u@lists.example.test"] },
        { confirmMailto: true },
        { writesDisabled: true },
      ),
    ).toEqual({ status: "disabled", method: "mailto" });
    expect(posts).toEqual([]);
    expect(f.gmail.sentOf("box-a")).toHaveLength(0);
    expect(await decision()).toBeNull();
    expect((await run({ ...oneClick, oneClick: false }, {}, { writesDisabled: true })).status).toBe(
      "opened",
    );
  });

  it("gives NOT_FOUND for another user's account", async () => {
    reset();
    await expect(run(undefined as unknown as MailSignals, {}, { who: f.b })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(run(oneClick, { connectionId: f.connC })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(posts).toEqual([]);
  });
});
