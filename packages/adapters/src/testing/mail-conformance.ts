import assert from "node:assert/strict";
import { type AdapterContext, type MailProvider, MailProviderError } from "@rakazo/adapter-kit";
import type { MailEmulator } from "../gmail-api-emulator.js";
import { parseRawMime } from "../mime-parse.js";

/**
 * Behavior every MailProvider must show against the seeded Gmail emulator: listing, paging,
 * sent mail, a full message, isolation between accounts, and the auth error mapping.
 * `emulator.accounts` must be two accounts of one user whose requests reach `emulator.gmail`.
 */
export async function assertMailConformance(
  provider: MailProvider,
  emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  const [a, b] = emulator.accounts;
  assert.ok(a && b, "conformance needs two accounts");
  const context: AdapterContext = {
    operationId: "mail-conformance",
    traceId: "mail-conformance",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const everything = { query: "", pageSize: 500 };

  const listed = await provider.listAccounts({ spaceId: a.spaceId, userId: a.userId }, context);
  assert.deepEqual(
    listed.map((account) => account.id),
    emulator.accounts.map((account) => account.id),
  );

  const first = await provider.listMessages(a, { query: "in:inbox", pageSize: 3 }, context);
  assert.equal(first.messages.length, 3);
  assert.ok(first.nextPageToken, "a partial page has a next page token");
  for (const message of first.messages) {
    assert.ok(message.id && message.threadId);
    assert.ok(!Number.isNaN(Date.parse(message.date)));
    assert.ok(message.labelIds.includes("INBOX"));
  }
  const second = await provider.listMessages(
    a,
    { query: "in:inbox", pageSize: 3, pageToken: first.nextPageToken },
    context,
  );
  assert.ok(second.messages.length > 0);
  const firstIds = new Set(first.messages.map((m) => m.id));
  assert.ok(
    second.messages.every((m) => !firstIds.has(m.id)),
    "page 2 does not repeat page 1",
  );

  const sent = await provider.listMessages(a, { ...everything, query: "in:sent" }, context);
  assert.ok(sent.messages.length > 0);
  assert.ok(sent.messages.every((m) => m.labelIds.includes("SENT")));

  const opened = await provider.getMessage(a, first.messages[0]?.id as string, context);
  assert.equal(opened.id, first.messages[0]?.id);
  assert.ok(opened.text.length > 0);
  assert.ok(Array.isArray(opened.attachments));

  const aIds = (await provider.listMessages(a, everything, context)).messages.map((m) => m.id);
  const bIds = (await provider.listMessages(b, everything, context)).messages.map((m) => m.id);
  assert.ok(aIds.length > 0 && bIds.length > 0);
  assert.ok(
    aIds.every((id) => !bIds.includes(id)),
    "account A never sees account B's mail",
  );
  await assert.rejects(
    provider.getMessage(b, aIds[0] as string, context),
    (error) => error instanceof MailProviderError && error.kind === "not_found",
  );

  emulator.gmail.failNext(401);
  await assert.rejects(
    provider.listMessages(a, everything, context),
    (error) => error instanceof MailProviderError && error.kind === "auth",
  );
}

/**
 * Write behavior every MailProvider must show: save, change and send a draft, a threaded reply,
 * and delete a draft. Run it after `assertMailConformance`; it reads the result from the emulator.
 */
export async function assertMailWriteConformance(
  provider: MailProvider,
  emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  const [a] = emulator.accounts;
  assert.ok(a, "conformance needs an account");
  const context: AdapterContext = {
    operationId: "mail-write-conformance",
    traceId: "mail-write-conformance",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const draft = {
    to: [{ name: "Priya Shah", address: "priya@example.test" }],
    cc: [],
    bcc: [],
    subject: "Conformance",
    text: "first version",
  };
  const created = await provider.createDraft(a, draft, context);
  assert.ok(created.draftId);
  assert.equal(emulator.gmail.draftsOf(a.accountRef).length, 1);
  assert.equal(emulator.gmail.sentOf(a.accountRef).length, 0, "saving a draft sends nothing");

  const updated = await provider.updateDraft(
    a,
    created.draftId,
    { ...draft, text: "second version" },
    context,
  );
  assert.equal(updated.draftId, created.draftId);
  assert.equal(emulator.gmail.draftsOf(a.accountRef).length, 1);

  const sent = await provider.sendDraft(a, created.draftId, context);
  assert.ok(sent.messageId && sent.threadId);
  assert.equal(emulator.gmail.draftsOf(a.accountRef).length, 0, "a sent draft is gone");
  const [record] = emulator.gmail.sentOf(a.accountRef);
  assert.equal(record?.id, sent.messageId);
  assert.match(parseRawMime(record?.raw ?? "").text ?? "", /second version/);

  const listed = await provider.listMessages(a, { query: "in:sent", pageSize: 500 }, context);
  assert.ok(listed.messages.some((m) => m.id === sent.messageId));

  const reply = await provider.createDraft(
    a,
    { ...draft, subject: "Re: Contract renewal", inReplyTo: "a-01" },
    context,
  );
  assert.equal(reply.threadId, "t-contract");
  await provider.sendDraft(a, reply.draftId, context);
  const replied = emulator.gmail.sentOf(a.accountRef).at(-1);
  assert.equal(replied?.threadId, "t-contract");
  assert.equal(parseRawMime(replied?.raw ?? "").header("In-Reply-To"), "<a-01@mail.example.test>");

  const spare = await provider.createDraft(a, draft, context);
  await provider.deleteDraft(a, spare.draftId, context);
  assert.equal(emulator.gmail.draftsOf(a.accountRef).length, 0);
  await assert.rejects(
    provider.deleteDraft(a, spare.draftId, context),
    (error) => error instanceof MailProviderError && error.kind === "not_found",
  );
}

/**
 * Label behavior every MailProvider must show: list labels, mark read and unread, archive, and the
 * errors for an unknown message, an unknown label and an account without permission to change mail.
 * Run it after `assertMailConformance`.
 */
export async function assertMailModifyConformance(
  provider: MailProvider,
  emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  const [a, b] = emulator.accounts;
  assert.ok(a && b, "conformance needs two accounts");
  const context: AdapterContext = {
    operationId: "mail-modify-conformance",
    traceId: "mail-modify-conformance",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const labelsOf = async (id: string) => (await provider.getMessage(a, id, context)).labelIds;

  const labels = await provider.listLabels(a, context);
  assert.deepEqual(
    labels.find((label) => label.id === "INBOX"),
    { id: "INBOX", name: "INBOX", type: "system" },
  );
  assert.ok(labels.some((label) => label.type === "user"));

  const unread = await provider.listMessages(
    a,
    { query: "in:inbox is:unread", pageSize: 1, useCache: false },
    context,
  );
  const id = unread.messages[0]?.id as string;
  assert.ok(id, "the seed has an unread inbox message");

  const read = await provider.modifyMessage(a, id, { removeLabelIds: ["UNREAD"] }, context);
  assert.ok(!read.labelIds.includes("UNREAD") && read.labelIds.includes("INBOX"));
  assert.deepEqual(await labelsOf(id), read.labelIds);

  const again = await provider.modifyMessage(a, id, { addLabelIds: ["UNREAD"] }, context);
  assert.ok(again.labelIds.includes("UNREAD"));

  await provider.modifyMessage(
    a,
    id,
    { removeLabelIds: ["INBOX"], addLabelIds: ["Label_1"] },
    context,
  );
  assert.deepEqual(
    (await labelsOf(id)).filter((label) => label === "INBOX" || label === "Label_1"),
    ["Label_1"],
  );
  const inbox = await provider.listMessages(
    a,
    { query: "in:inbox", pageSize: 500, useCache: false },
    context,
  );
  assert.ok(!inbox.messages.some((m) => m.id === id), "an archived message leaves the inbox");

  const kind = (expected: string) => (error: unknown) =>
    error instanceof MailProviderError && error.kind === expected;
  await assert.rejects(
    provider.modifyMessage(a, "no-such-message", { removeLabelIds: ["UNREAD"] }, context),
    kind("not_found"),
  );
  await assert.rejects(
    provider.modifyMessage(a, id, { addLabelIds: ["no-such-label"] }, context),
    kind("invalid"),
  );
  const others = await provider.listMessages(b, { query: "", pageSize: 1 }, context);
  await assert.rejects(
    provider.modifyMessage(
      a,
      others.messages[0]?.id as string,
      { addLabelIds: ["STARRED"] },
      context,
    ),
    kind("not_found"),
  );
  // A thread change reaches every message of the thread in one call, listed or not.
  for (const mid of ["thread-1", "thread-2"])
    emulator.gmail.addMessage(a.accountRef, {
      id: mid,
      threadId: "t-modify",
      date: "2026-10-01T10:00:00Z",
      labels: ["INBOX", "UNREAD"],
      from: "New Sender <new@example.test>",
      to: "alice@example.test",
      subject: `Thread ${mid}`,
    });
  await provider.modifyThread(a, "t-modify", { removeLabelIds: ["INBOX", "UNREAD"] }, context);
  assert.deepEqual(await labelsOf("thread-1"), []);
  assert.deepEqual(await labelsOf("thread-2"), []);
  await assert.rejects(
    provider.modifyThread(a, "no-such-thread", { removeLabelIds: ["UNREAD"] }, context),
    kind("not_found"),
  );
  await assert.rejects(
    provider.modifyThread(a, "t-modify", { addLabelIds: ["no-such-label"] }, context),
    kind("invalid"),
  );
  emulator.gmail.failNext(403, { reason: "insufficientPermissions", urlIncludes: "/modify" });
  await assert.rejects(
    provider.modifyMessage(a, id, { addLabelIds: ["STARRED"] }, context),
    kind("auth"),
  );
}

/**
 * Change-feed behavior every MailProvider must show: a cursor, added, relabelled and deleted
 * messages since it, a message added and deleted in between, an empty feed, and an expired or
 * unrecognized cursor. Run it last: it adds and deletes mail in the emulator.
 */
export async function assertMailChangesConformance(
  provider: MailProvider,
  emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  const [a] = emulator.accounts;
  assert.ok(a, "conformance needs an account");
  const context: AdapterContext = {
    operationId: "mail-changes-conformance",
    traceId: "mail-changes-conformance",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const arrived = (id: string, labels: string[]) => ({
    id,
    date: "2026-10-01T10:00:00Z",
    labels,
    from: "New Sender <new@example.test>",
    to: "alice@example.test",
    subject: `New ${id}`,
  });

  // A connector that retries may leave part of an earlier suite's injected failure unused.
  emulator.gmail.clearFailures();
  const start = await provider.getCursor(a, context);
  assert.ok(start);
  const quiet = await provider.listChanges(a, start, context);
  assert.deepEqual(quiet, { cursor: start, changedIds: [], deletedIds: [] });

  emulator.gmail.addMessage(a.accountRef, arrived("c-new", ["INBOX", "UNREAD"]));
  emulator.gmail.addMessage(a.accountRef, arrived("c-temp", ["INBOX"]));
  emulator.gmail.deleteMessage(a.accountRef, "c-temp");
  await provider.modifyMessage(a, "a-03", { removeLabelIds: ["UNREAD"] }, context);
  emulator.gmail.deleteMessage(a.accountRef, "a-05");

  const changes = await provider.listChanges(a, start, context);
  assert.ok(changes);
  assert.deepEqual([...changes.changedIds].sort(), ["a-03", "c-new"]);
  assert.deepEqual([...changes.deletedIds].sort(), ["a-05", "c-temp"]);
  assert.notEqual(changes.cursor, start);
  const hydrated = await provider.listMessages(
    a,
    { query: "", pageSize: 500, ids: changes.changedIds, useCache: false },
    context,
  );
  assert.ok(!hydrated.messages.find((m) => m.id === "a-03")?.unread);
  assert.ok(hydrated.messages.find((m) => m.id === "c-new")?.unread);

  assert.deepEqual(await provider.listChanges(a, changes.cursor, context), {
    cursor: changes.cursor,
    changedIds: [],
    deletedIds: [],
  });

  emulator.gmail.expireHistory(a.accountRef);
  assert.equal(await provider.listChanges(a, changes.cursor, context), null, "expired cursor");
  assert.equal(await provider.listChanges(a, "not-a-cursor", context), null, "unknown cursor");
  const fresh = await provider.getCursor(a, context);
  assert.deepEqual(await provider.listChanges(a, fresh, context), {
    cursor: fresh,
    changedIds: [],
    deletedIds: [],
  });

  emulator.gmail.failNext(401);
  await assert.rejects(
    provider.listChanges(a, fresh, context),
    (error) => error instanceof MailProviderError && error.kind === "auth",
  );
}

/**
 * Classifier signals every MailProvider must show: List-Unsubscribe and friends, authentication
 * results, repeated DKIM-Signature headers, Gmail category flags and the sent-mail lookup that
 * proves prior contact. Run it last: it adds mail to the emulator.
 */
export async function assertMailSignalsConformance(
  provider: MailProvider,
  emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  const [a] = emulator.accounts;
  assert.ok(a, "conformance needs an account");
  const context: AdapterContext = {
    operationId: "mail-signals-conformance",
    traceId: "mail-signals-conformance",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
  };
  const arrive = (message: Parameters<typeof emulator.gmail.addMessage>[1]) =>
    emulator.gmail.addMessage(a.accountRef, message);
  const base = { date: "2026-10-01T10:00:00Z", to: "alice@example.test" };

  arrive({
    ...base,
    id: "sig-news",
    labels: ["INBOX", "CATEGORY_PROMOTIONS"],
    from: "Deals <deals@shop.example.test>",
    subject: "Sale",
    headers: [
      {
        name: "List-Unsubscribe",
        value: "<https://shop.example.test/u/1>, <mailto:u@shop.example.test>",
      },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
      { name: "List-Id", value: "Deals <deals.shop.example.test>" },
      { name: "Precedence", value: "bulk" },
      {
        name: "Authentication-Results",
        value: "mx.google.com; dkim=pass header.i=@shop.example.test; spf=pass; dmarc=pass",
      },
      { name: "DKIM-Signature", value: "v=1; d=other.example.test; h=from; b=1" },
      {
        name: "DKIM-Signature",
        value: "v=1; d=shop.example.test; h=from:list-unsubscribe:list-unsubscribe-post; b=2",
      },
    ],
  });
  arrive({
    ...base,
    id: "sig-spam",
    labels: ["SPAM"],
    from: "Prize <win@prize.example.test>",
    subject: "You won",
  });

  const page = await provider.listMessages(
    a,
    { query: "", pageSize: 500, ids: ["sig-news", "sig-spam"], useCache: false },
    context,
  );
  const news = page.messages.find((m) => m.id === "sig-news")?.signals;
  assert.ok(news, "signals are returned");
  assert.deepEqual(news.listUnsubscribe, [
    "https://shop.example.test/u/1",
    "mailto:u@shop.example.test",
  ]);
  assert.equal(news.oneClick, true);
  assert.equal(news.listId, "Deals <deals.shop.example.test>");
  assert.equal(news.bulk, true);
  assert.deepEqual(news.auth, { dkim: "pass", spf: "pass", dmarc: "pass" });
  assert.equal(news.dkimCoversUnsubscribe, true, "both DKIM-Signature headers are read");
  assert.equal(news.categories.promotions, true);
  assert.equal(news.categories.spam, false);
  const junk = page.messages.find((m) => m.id === "sig-spam")?.signals;
  assert.equal(junk?.categories.spam, true);
  assert.deepEqual(junk?.listUnsubscribe, []);

  // The prior-contact lookup: one result is enough, and an address never written to has none.
  const written = await provider.listMessages(
    a,
    { query: 'in:sent to:"priya@example.test"', pageSize: 1, useCache: false },
    context,
  );
  assert.equal(written.messages.length, 1);
  assert.ok(written.messages[0]?.labelIds.includes("SENT"));
  const never = await provider.listMessages(
    a,
    { query: 'in:sent to:"nobody@example.test"', pageSize: 1, useCache: false },
    context,
  );
  assert.equal(never.messages.length, 0);
  assert.ok(!never.unhydratedIds?.length);
}
