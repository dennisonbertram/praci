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
