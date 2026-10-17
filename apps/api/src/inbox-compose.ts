import { ORPCError } from "@orpc/server";
import type {
  AdapterContext,
  MailAccount,
  MailDraftAttachment,
  MailDraftInput,
} from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import {
  buildRawMessage,
  htmlToText,
  parseRecipients,
  replyPrefill,
  sanitizeComposeHtml,
  syncAfterSend,
} from "@rakazo/adapters";
import type {
  Actor,
  ComposeFields,
  ComposeMode,
  ComposePrefillOutput,
  ComposeResult,
} from "@rakazo/contracts";
import {
  MAX_COMPOSE_ATTACHMENT_BYTES,
  MAX_COMPOSE_ATTACHMENT_MB,
  MAX_COMPOSE_HTML,
} from "@rakazo/contracts";
import { getLogger } from "@rakazo/logging";
import type { InboxDeps } from "./inbox.js";
import { mailContext, mailUnavailable, notFound } from "./inbox.js";

export type ComposeDeps = InboxDeps & { mailWritesDisabled?: boolean };

/** A send still pending after this long belongs to a process that died, so its outcome is unknown. */
const PENDING_STALE_MS = 2 * 60_000;
/** How long a duplicate request waits for the first one to finish before answering "unknown". */
const WAIT_MS = 15_000;
const POLL_MS = 200;
const SEND_DEADLINE_MS = 100_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Messages here are safe to show: they name the problem, never the text or the addresses. */
function badRequest(error: unknown): never {
  if (error instanceof MailProviderError && error.kind === "invalid")
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  throw error;
}

/** One of the caller's own connected Gmail accounts, by connection id. */
const ownAccounts = (deps: ComposeDeps, actor: Actor, context: AdapterContext) =>
  deps.mail.listAccounts({ spaceId: actor.spaceId, userId: actor.userId }, context);

function pickAccount(accounts: MailAccount[], connectionId: string): MailAccount {
  const account = accounts.find((a) => a.id === connectionId);
  if (!account) throw notFound();
  return account;
}

async function ownAccount(
  deps: ComposeDeps,
  actor: Actor,
  connectionId: string,
  context: AdapterContext,
): Promise<MailAccount> {
  return pickAccount(await ownAccounts(deps, actor, context), connectionId);
}

/** The provider id of the caller's cached message on this account. */
async function ownMessage(
  deps: ComposeDeps,
  actor: Actor,
  messageId: string,
  connectionId: string | undefined,
) {
  const row = await deps.prisma.cachedMailMessage.findFirst({
    where: {
      id: messageId,
      spaceId: actor.spaceId,
      userId: actor.userId,
      ...(connectionId ? { connectionId } : {}),
    },
    select: {
      providerMessageId: true,
      connectionId: true,
      fromName: true,
      fromSelf: true,
      fromAddress: true,
      toAddresses: true,
      ccAddresses: true,
      subject: true,
      receivedAt: true,
    },
  });
  if (!row) throw notFound();
  return row;
}

const accountOut = (account: MailAccount) => ({
  connectionId: account.id,
  label: account.label,
  ...(account.address ? { address: account.address } : {}),
});

export async function inboxComposePrefill(
  deps: ComposeDeps,
  actor: Actor,
  input: { messageId: string; mode: ComposeMode; timeZone?: string; locale?: string },
  signal?: AbortSignal,
): Promise<ComposePrefillOutput> {
  const context = mailContext(actor, "inbox.compose.prefill", signal);
  const original = await ownMessage(deps, actor, input.messageId, undefined);
  // The account comes from the actor's own connections, never from client input.
  const accounts = await ownAccounts(deps, actor, context);
  const account = pickAccount(accounts, original.connectionId);
  try {
    const message = await deps.mail.getMessage(account, original.providerMessageId, context);
    // Every connected address is the user's own, so reply all never addresses the user.
    const mine = accounts.flatMap((a) => (a.address ? [a.address] : []));
    const prefill = replyPrefill(message, input.mode, mine, input);
    // A forward of an HTML mail keeps its formatting; an oversized result falls back to the text.
    const quotedHtml =
      input.mode === "forward" && message.html ? sanitizeComposeHtml(message.html) : "";
    const files =
      input.mode === "forward" ? message.attachments.filter((file) => !file.inline) : [];
    // Files are kept in order while they fit; the rest are named so the person knows what is missing.
    const kept: typeof files = [];
    const leftOut: typeof files = [];
    let total = 0;
    for (const file of files) {
      if (total + file.size <= MAX_COMPOSE_ATTACHMENT_BYTES) {
        kept.push(file);
        total += file.size;
      } else leftOut.push(file);
    }
    const tooLarge = leftOut.length > 0;
    return {
      connectionId: account.id,
      account: accountOut(account),
      ...prefill,
      ...(htmlToText(quotedHtml) && quotedHtml.length <= MAX_COMPOSE_HTML / 2
        ? { quotedHtml }
        : {}),
      attachments: kept.map(({ id, filename, mimeType, size }) => ({
        id,
        filename,
        mimeType,
        size,
      })),
      ...(tooLarge
        ? {
            attachmentsTooLarge: true,
            attachmentsLeftOut: leftOut.map(({ filename, size }) => ({ filename, size })),
          }
        : {}),
      ...(input.mode === "forward" ? {} : { replyToMessageId: input.messageId }),
    };
  } catch (error) {
    if (error instanceof MailProviderError) {
      getLogger().warn("inbox.compose.prefill failed", {
        connectionId: account.id,
        reason: error.kind,
      });
      if (error.kind === "not_found") throw notFound();
      if (error.kind === "auth")
        throw new ORPCError("PRECONDITION_FAILED", { message: error.message });
      // Anything else (a rate limit, an outage) still opens the window with the cached Subject. The
      // cache has no Reply-To, so recipients are filled only for the user's own message, which
      // answers to its To list whatever Reply-To says.
      const address = (a: string) => ({ address: a });
      const prefill = replyPrefill(
        {
          from: {
            address: original.fromAddress,
            ...(original.fromName ? { name: original.fromName } : {}),
          },
          to: original.toAddresses.map(address),
          cc: original.ccAddresses.map(address),
          replyTo: [],
          subject: original.subject,
          date: original.receivedAt.toISOString(),
          text: "",
        },
        input.mode,
        // A message sent from an alias is still the user's own.
        [
          ...accounts.flatMap((a) => (a.address ? [a.address] : [])),
          ...(original.fromSelf ? [original.fromAddress] : []),
        ],
        input,
      );
      return {
        connectionId: account.id,
        account: accountOut(account),
        ...prefill,
        ...(original.fromSelf ? {} : { to: "", cc: "" }),
        body: "",
        attachments: [],
        quoteUnavailable: true,
        ...(input.mode === "forward" ? {} : { replyToMessageId: input.messageId }),
      };
    }
    throw error;
  }
}

/**
 * The provider draft for the fields. A draft is saved leniently, dropping recipients still being
 * typed; a send is strict, and checked here so a bad field fails before any state changes.
 */
function draftOf(input: ComposeFields, providerMessageId: string | undefined, lenient: boolean) {
  try {
    const html = input.html === undefined ? undefined : sanitizeComposeHtml(input.html);
    const attachments = (input.attachments ?? []).map((file) => {
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.data))
        throw new MailProviderError("invalid", "An attachment could not be read");
      return {
        filename: file.filename,
        mimeType: file.mimeType,
        data: Buffer.from(file.data, "base64"),
      };
    });
    if (attachments.reduce((sum, file) => sum + file.data.length, 0) > MAX_COMPOSE_ATTACHMENT_BYTES)
      throw new MailProviderError(
        "invalid",
        `Attachments are over the ${MAX_COMPOSE_ATTACHMENT_MB} MB limit`,
      );
    const draft: MailDraftInput = {
      to: parseRecipients(input.to, lenient),
      cc: parseRecipients(input.cc, lenient),
      bcc: parseRecipients(input.bcc, lenient),
      subject: input.subject,
      text: html === undefined ? input.body : htmlToText(html),
      ...(html === undefined ? {} : { html }),
      ...(attachments.length ? { attachments } : {}),
      ...(providerMessageId ? { inReplyTo: providerMessageId } : {}),
    };
    // Dry run of the message build: recipients, addresses and subject are checked, nothing is sent.
    buildRawMessage({ ...draft, inReplyTo: undefined }, { draft: lenient });
    return draft;
  } catch (error) {
    return badRequest(error);
  }
}

type Row = { id: string; connectionId: string; draftId: string | null; state: string };

/** The compose record for this client id, created on first use. It never changes accounts. */
async function composeRow(deps: ComposeDeps, actor: Actor, input: ComposeFields): Promise<Row> {
  const key = { spaceId: actor.spaceId, userId: actor.userId, clientId: input.clientId };
  const select = { id: true, connectionId: true, draftId: true, state: true } as const;
  // Prisma's upsert is not atomic: two first requests can both insert. The loser reads the winner's row.
  const row = await deps.prisma.composeSend
    .upsert({
      where: { spaceId_userId_clientId: key },
      create: { ...key, connectionId: input.connectionId },
      update: {},
      select,
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code !== "P2002") throw error;
      return deps.prisma.composeSend.findUniqueOrThrow({
        where: { spaceId_userId_clientId: key },
        select,
      });
    });
  if (row.connectionId !== input.connectionId)
    throw new ORPCError("BAD_REQUEST", { message: "A draft cannot change accounts" });
  return row;
}

/** Marks the account as needing a new login, which the Inbox already shows as a reconnect notice. */
export async function flagReconnect(deps: ComposeDeps, connectionId: string): Promise<void> {
  const now = new Date();
  await deps.prisma.mailSyncState
    .upsert({
      where: { connectionId },
      create: { connectionId, lastErrorAt: now, needsReconnect: true, lastErrorKind: "auth" },
      update: { lastErrorAt: now, needsReconnect: true, lastErrorKind: "auth" },
    })
    .catch(() => undefined);
}

/** Creates the Gmail draft for the row, or replaces the one it has; a draft deleted in Gmail is recreated. */
async function writeDraft(
  deps: ComposeDeps,
  account: MailAccount,
  row: Row,
  draft: MailDraftInput,
  context: AdapterContext,
): Promise<string> {
  if (row.draftId) {
    try {
      return (await deps.mail.updateDraft(account, row.draftId, draft, context)).draftId;
    } catch (error) {
      if (!(error instanceof MailProviderError) || error.kind !== "not_found") throw error;
    }
  }
  const created = (await deps.mail.createDraft(account, draft, context)).draftId;
  // Two saves racing with no draft yet: the first to record its id wins, the other joins it.
  const { count } = await deps.prisma.composeSend.updateMany({
    where: {
      id: row.id,
      OR: [{ draftId: null }, ...(row.draftId ? [{ draftId: row.draftId }] : [])],
    },
    data: { draftId: created },
  });
  if (count > 0) return created;
  await deps.mail.deleteDraft(account, created, context).catch(() => undefined);
  const winner = await deps.prisma.composeSend.findUniqueOrThrow({
    where: { id: row.id },
    select: { draftId: true },
  });
  if (!winner.draftId) throw new MailProviderError("unavailable", "Draft could not be saved");
  return (await deps.mail.updateDraft(account, winner.draftId, draft, context)).draftId;
}

const savedStatus = (state: string): ComposeResult["status"] =>
  state === "sent" ? "sent" : state === "unknown" ? "unknown" : "saved";

export async function inboxComposeDraftSave(
  deps: ComposeDeps,
  actor: Actor,
  input: ComposeFields,
  signal?: AbortSignal,
): Promise<ComposeResult> {
  if (deps.mailWritesDisabled) return { status: "disabled" };
  const context = mailContext(actor, "inbox.compose.draftSave", signal);
  const account = await ownAccount(deps, actor, input.connectionId, context);
  const original = input.replyToMessageId
    ? await ownMessage(deps, actor, input.replyToMessageId, input.connectionId)
    : undefined;
  const draft = draftOf(input, original?.providerMessageId, true);
  const row = await composeRow(deps, actor, input);
  // A send in flight, or one that already happened, owns the draft.
  if (row.state === "abandoned") return { status: "failed" };
  if (row.state === "sent" || row.state === "unknown" || row.state === "pending")
    return { status: savedStatus(row.state) };
  try {
    const draftId = await writeDraft(deps, account, row, draft, context);
    await deps.prisma.composeSend.updateMany({
      where: { id: row.id, state: { in: ["draft", "failed"] } },
      data: { draftId },
    });
    return { status: "saved" };
  } catch (error) {
    if (!(error instanceof MailProviderError)) throw error;
    getLogger().warn("inbox compose draft not saved", {
      connectionId: account.id,
      reason: error.kind,
    });
    if (error.kind === "auth") {
      await flagReconnect(deps, account.id);
      return { status: "reconnect" };
    }
    return { status: "failed" };
  }
}

/** What an earlier or concurrent request settled on, waiting briefly for one still in flight. */
async function settled(deps: ComposeDeps, rowId: string): Promise<ComposeResult> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const row = await deps.prisma.composeSend.findUnique({
      where: { id: rowId },
      select: { state: true, updatedAt: true },
    });
    if (!row) return { status: "failed" };
    if (row.state === "sent") return { status: "sent" };
    if (row.state === "unknown") return { status: "unknown" };
    if (row.state !== "pending") return { status: "failed" };
    if (Date.now() - row.updatedAt.getTime() > PENDING_STALE_MS) {
      // The process that held it is gone; whether it sent is not known.
      await deps.prisma.composeSend.updateMany({
        where: { id: rowId, state: "pending" },
        data: { state: "unknown" },
      });
      continue;
    }
    if (Date.now() >= deadline) return { status: "unknown" };
    await sleep(POLL_MS);
  }
}

/** The original's chosen files, fetched by the server; together with the uploads they stay under the limit. */
async function forwardedFiles(
  deps: ComposeDeps,
  account: MailAccount,
  providerMessageId: string,
  forwardOf: NonNullable<ComposeFields["forwardOf"]>,
  draft: MailDraftInput,
  context: AdapterContext,
): Promise<MailDraftAttachment[]> {
  let remaining =
    MAX_COMPOSE_ATTACHMENT_BYTES - (draft.attachments ?? []).reduce((n, f) => n + f.data.length, 0);
  const files: MailDraftAttachment[] = [];
  for (const id of forwardOf.attachmentIds) {
    const file = await deps.mail.getAttachment(account, providerMessageId, id, remaining, context);
    remaining -= file.bytes.length;
    if (remaining < 0) throw new MailProviderError("invalid", "Attachments are too large");
    files.push({ filename: file.filename, mimeType: file.mimeType, data: Buffer.from(file.bytes) });
  }
  return files;
}

export async function inboxComposeSend(
  deps: ComposeDeps,
  actor: Actor,
  input: ComposeFields,
): Promise<ComposeResult> {
  if (deps.mailWritesDisabled) return { status: "disabled" };
  // The send runs to its end even if the browser leaves, so its outcome is always recorded.
  const context = mailContext(actor, "inbox.compose.send", AbortSignal.timeout(SEND_DEADLINE_MS));
  const account = await ownAccount(deps, actor, input.connectionId, context);
  const original = input.replyToMessageId
    ? await ownMessage(deps, actor, input.replyToMessageId, input.connectionId)
    : undefined;
  const forwarded = input.forwardOf
    ? await ownMessage(deps, actor, input.forwardOf.messageId, input.connectionId)
    : undefined;
  const draft = draftOf(input, original?.providerMessageId, false);
  const row = await composeRow(deps, actor, input);

  // Only one request moves a record out of draft/failed; every other one reports what happened.
  const claim = await deps.prisma.composeSend.updateMany({
    where: { id: row.id, state: { in: ["draft", "failed"] } },
    data: { state: "pending" },
  });
  if (claim.count === 0) return settled(deps, row.id);

  let sending = false;
  try {
    const files =
      forwarded && input.forwardOf
        ? await forwardedFiles(
            deps,
            account,
            forwarded.providerMessageId,
            input.forwardOf,
            draft,
            context,
          )
        : [];
    const draftId = await writeDraft(
      deps,
      account,
      row,
      files.length ? { ...draft, attachments: [...(draft.attachments ?? []), ...files] } : draft,
      context,
    );
    await deps.prisma.composeSend.update({ where: { id: row.id }, data: { draftId } });
    sending = true;
    const sent = await deps.mail.sendDraft(account, draftId, context);
    sending = false;
    await record(deps, row.id, {
      state: "sent",
      providerMessageId: sent.messageId || null,
      threadId: sent.threadId || null,
    });
    getLogger().info("inbox compose sent", { connectionId: account.id });
    await syncAfterSend(deps, account, context);
    return { status: "sent" };
  } catch (error) {
    if (sending && !(error instanceof MailProviderError && error.kind !== "unknown")) {
      await record(deps, row.id, { state: "unknown" });
      getLogger().warn("inbox compose send outcome unknown", {
        connectionId: account.id,
        reason: error instanceof MailProviderError ? error.kind : "error",
      });
      return { status: "unknown" };
    }
    // Nothing was sent: allow another attempt.
    await record(deps, row.id, { state: "failed" });
    if (!(error instanceof MailProviderError)) throw error;
    getLogger().warn("inbox compose send failed", { connectionId: account.id, reason: error.kind });
    if (error.kind === "auth") {
      await flagReconnect(deps, account.id);
      return { status: "reconnect" };
    }
    return { status: "failed" };
  }
}

/** Bookkeeping that must not turn a send that happened into an error. */
async function record(
  deps: ComposeDeps,
  id: string,
  data: { state: string; providerMessageId?: string | null; threadId?: string | null },
): Promise<void> {
  try {
    await deps.prisma.composeSend.update({ where: { id }, data });
  } catch (error) {
    getLogger().error("inbox compose record failed", error, { state: data.state });
  }
}

export async function inboxComposeDiscard(
  deps: ComposeDeps,
  actor: Actor,
  input: { clientId: string },
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  if (deps.mailWritesDisabled) return { ok: true };
  const row = await deps.prisma.composeSend.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      clientId: input.clientId,
      state: { in: ["draft", "failed"] },
      connection: { status: "connected" },
    },
  });
  if (!row) return { ok: true };
  if (row.draftId) {
    const context = mailContext(actor, "inbox.compose.discard", signal);
    const account = await ownAccount(deps, actor, row.connectionId, context);
    try {
      await deps.mail.deleteDraft(account, row.draftId, context);
    } catch (error) {
      if (!(error instanceof MailProviderError)) throw error;
      // A draft already gone is what was wanted; anything else keeps the record so Discard can be retried.
      if (error.kind !== "not_found") throw mailUnavailable(error);
    }
  }
  await deps.prisma.composeSend.deleteMany({
    where: { id: row.id, state: { in: ["draft", "failed"] } },
  });
  return { ok: true };
}
