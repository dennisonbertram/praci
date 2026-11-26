import type { AdapterContext, JobPublisher, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { mailReplyBatchJob, runContinueJob } from "@rakazo/adapter-kit";
import type { MailReplyFlag } from "@rakazo/contracts";
import {
  disabledBuiltinToolSet,
  MAIL_REPLY_ACCOUNT_HOLD,
  MAIL_REPLY_BATCH_TOOL,
  MAIL_REPLY_FIREWALL_HOLD,
  MAIL_REPLY_FLAGS,
  MAIL_REPLY_GRANT_HOLD,
  MAIL_REPLY_INFORMING_FLAGS,
  MAIL_REPLY_LIMIT_HOLD,
  MAIL_REPLY_NEW_MESSAGE_HOLD,
  MAIL_REPLY_SWITCH_HOLD,
  MAX_COMPOSE_BODY,
  MAX_MAIL_REPLY_BATCH,
  MailSignalsSchema,
} from "@rakazo/contracts";
import {
  accountAllowedIn,
  bodyHasLink,
  connectionAccessFilter,
  connectionRowsForAudience,
  recipientsOffThread,
  redactSecrets,
  replyGuard,
  withInboxAgentStandIn,
} from "@rakazo/core";
import { mailReplyHash } from "@rakazo/core/node/approval-effect-key";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  MAIL_REPLY_CLEARED_HOLD,
  MAIL_REPLY_CLIENT_PREFIX,
  MAIL_REPLY_HASH_HOLD,
  mailReplyClientId,
  releaseNewRecipientSends,
  reserveNewRecipientSends,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { z } from "zod";
import { mailRequestIsValid } from "./approval-ask.js";
import type { FirewallMailDeps } from "./firewall-mail.js";
import { firewallMailReadDecision, threadParticipants } from "./firewall-mail.js";
import type { PriorMailEffect } from "./mail-approval-recovery.js";
import {
  MAIL_APPROVAL_STALE_MS,
  MAIL_DUPLICATE_WINDOW_MS,
  mailSendRefusal,
  sentCopyMatches,
  sentToSameSubject,
} from "./mail-approval-recovery.js";
import { displayAddress, parseRecipients } from "./mail-compose.js";
import { protectedSenders } from "./mail-protected-senders.js";
import type { MailToolDeps } from "./mail-tools.js";
import { accountName, mailToolFromTool, resolveAccount } from "./mail-tools.js";

type Scope = { spaceId: string; userId: string };

const ReplyArgs = z.object({
  /** Without it the row is a new email. An empty id is refused, never read as a new email. */
  replyToId: z.string().trim().min(1).optional(),
  to: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string(),
  body: z.string().max(MAX_COMPOSE_BODY),
});
const BatchArgs = z.object({ account: z.string().optional(), replies: z.array(ReplyArgs).min(1) });

/** The columns the flags read of a stored or proposed row. */
export type MailReplyFlagInput = {
  /** Other cards' rows count as earlier sends; this card's do not. */
  effectId?: string;
  connectionId: string;
  /** Null for a new email. */
  providerThreadId: string | null;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  subject: string;
  body: string;
  seenMessageId: string | null;
};

const addressesOf = (entries: readonly string[]) =>
  parseRecipients(entries.join(", ")).map((entry) => entry.address);

const flagOrder = (flags: Set<MailReplyFlag>) => MAIL_REPLY_FLAGS.filter((flag) => flags.has(flag));

export const startsUnticked = (flags: readonly MailReplyFlag[]) =>
  flags.some((flag) => !(MAIL_REPLY_INFORMING_FLAGS as readonly MailReplyFlag[]).includes(flag));

/**
 * The same, for a stored row. A run that read outside content may have been told whom to write to,
 * so a new email or a new address waits for a deliberate tick.
 */
export const rowStartsUnticked = (
  row: { providerThreadId: string | null; outsideContent: boolean },
  flags: readonly MailReplyFlag[],
) =>
  startsUnticked(flags) ||
  (row.outsideContent && (row.providerThreadId === null || flags.includes("new_recipient")));

/** What a new email cannot go without. */
export function newEmailIsComplete(row: {
  to: readonly string[];
  subject: string;
  body: string;
}): boolean {
  try {
    return (
      addressesOf(row.to).length > 0 && Boolean(row.subject.trim()) && Boolean(row.body.trim())
    );
  } catch {
    return false;
  }
}

/** The same address and subject within this many days reads as a duplicate. */
const RECENT_DUPLICATE_DAYS = 30;
/** New rows with one text before it reads as a mailing, not individually written emails. */
const SAME_TEXT_AT = 3;

const safeAddresses = (entries: readonly string[]) => {
  try {
    return addressesOf(entries).map((address) => address.toLowerCase());
  } catch {
    return [];
  }
};

/**
 * Which of these lowercased addresses already appear in an account's synced mail, as
 * `connectionId:address`. Only as complete as the sync, so someone known long ago can read as new,
 * which is the cautious way to be wrong.
 */
// ponytail: reads the account's whole cache because addresses are not indexed; add a GIN index or a
// per-account address table if flags show up in the timing of large mailboxes.
async function addressesWithMail(
  prisma: Pick<PrismaClient, "$queryRaw">,
  scope: Scope,
  connectionIds: string[],
  addresses: string[],
): Promise<Set<string>> {
  if (addresses.length === 0) return new Set();
  const found = await prisma.$queryRaw<{ connectionId: string; address: string }[]>`
    SELECT m."connectionId", lower(x) AS address
    FROM mail_messages m
    CROSS JOIN LATERAL unnest(m."toAddresses" || m."ccAddresses" || m."fromAddress") AS x
    WHERE m."spaceId" = ${scope.spaceId} AND m."userId" = ${scope.userId}
      AND m."connectionId" = ANY(${connectionIds}::text[])
      AND lower(x) = ANY(${addresses}::text[])
    GROUP BY 1, 2`;
  return new Set(found.map((row) => `${row.connectionId}:${row.address}`));
}

/** Per row, the new emails that repeat an address on this card or a recent send with its subject. */
async function duplicateEmails(
  prisma: Pick<PrismaClient, "cachedMailMessage" | "mailReplyItem">,
  scope: Scope,
  rows: readonly MailReplyFlagInput[],
  recipientsOf: readonly string[][],
): Promise<boolean[]> {
  const fresh = rows.flatMap((row, index) =>
    row.providerThreadId === null ? [{ row, index }] : [],
  );
  if (fresh.length === 0) return rows.map(() => false);
  const onCard = new Map<string, number>();
  for (const { index } of fresh) {
    for (const address of new Set(recipientsOf[index])) {
      onCard.set(address, (onCard.get(address) ?? 0) + 1);
    }
  }
  const where = {
    ...scope,
    connectionId: { in: [...new Set(fresh.map(({ row }) => row.connectionId))] },
    subject: { in: fresh.map(({ row }) => row.subject), mode: "insensitive" as const },
  };
  const cutoff = new Date(Date.now() - RECENT_DUPLICATE_DAYS * 24 * 60 * 60_000);
  const [mail, cards] = await Promise.all([
    prisma.cachedMailMessage.findMany({
      where: { ...where, fromSelf: true, receivedAt: { gte: cutoff } },
      select: { connectionId: true, subject: true, toAddresses: true, ccAddresses: true },
    }),
    prisma.mailReplyItem.findMany({
      where: {
        ...where,
        providerThreadId: null,
        dispatch: { in: ["queued", "claimed"] },
        createdAt: { gte: cutoff },
      },
      select: { effectId: true, connectionId: true, subject: true, to: true, cc: true, bcc: true },
    }),
  ]);
  const earlier = [
    ...mail.map((message) => ({
      effectId: undefined as string | undefined,
      connectionId: message.connectionId,
      subject: message.subject,
      recipients: [...message.toAddresses, ...message.ccAddresses].map((a) => a.toLowerCase()),
    })),
    ...cards.map((card) => ({
      effectId: card.effectId as string | undefined,
      connectionId: card.connectionId,
      subject: card.subject,
      recipients: safeAddresses([...card.to, ...card.cc, ...card.bcc]),
    })),
  ];
  return rows.map((row, index) => {
    if (row.providerThreadId !== null) return false;
    const recipients = recipientsOf[index] ?? [];
    return (
      recipients.some((address) => (onCard.get(address) ?? 0) > 1) ||
      earlier.some(
        (send) =>
          send.effectId !== row.effectId &&
          send.connectionId === row.connectionId &&
          send.subject.toLowerCase() === row.subject.toLowerCase() &&
          send.recipients.some((address) => recipients.includes(address)),
      )
    );
  });
}

/** Rows whose text is shared by enough new rows on this card to read as a mailing. */
function sharedText(rows: readonly MailReplyFlagInput[]): boolean[] {
  const textOf = (row: MailReplyFlagInput) =>
    row.providerThreadId === null ? row.body.trim().replace(/\s+/g, " ").toLowerCase() : "";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const text = textOf(row);
    if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return rows.map((row) => (counts.get(textOf(row)) ?? 0) >= SAME_TEXT_AT);
}

/**
 * Why the owner should look at each row, in the rows' order, most serious first. A flag never blocks.
 * Read from synced mail, so it is only as fresh as the last sync.
 */
export async function mailReplyFlags(
  prisma: Pick<
    PrismaClient,
    | "$queryRaw"
    | "cachedMailMessage"
    | "mailSenderStat"
    | "inboxSenderFeedback"
    | "contact"
    | "mailReplyItem"
  >,
  scope: Scope,
  rows: readonly MailReplyFlagInput[],
): Promise<{ flags: MailReplyFlag[]; newestInboundId: string | null; newRecipients: string[] }[]> {
  if (rows.length === 0) return [];
  const connectionIds = [...new Set(rows.map((row) => row.connectionId))];
  const threadIds = [...new Set(rows.flatMap((row) => row.providerThreadId ?? []))];
  const threads =
    threadIds.length === 0
      ? []
      : await prisma.cachedMailMessage.findMany({
          where: { ...scope, connectionId: { in: connectionIds }, threadId: { in: threadIds } },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          select: {
            providerMessageId: true,
            connectionId: true,
            threadId: true,
            fromAddress: true,
            toAddresses: true,
            ccAddresses: true,
            fromSelf: true,
            signals: true,
          },
        });
  const threadOf = (row: MailReplyFlagInput) =>
    threads.filter(
      (message) =>
        message.connectionId === row.connectionId && message.threadId === row.providerThreadId,
    );
  const recipientsOf = rows.map((row) => safeAddresses([...row.to, ...row.cc, ...row.bcc]));
  // Thread participants are known already, so most replies need no lookup.
  const outsidersOf = rows.map((row, index) => {
    const onThread = threadParticipants(threadOf(row)).map((address) => address.toLowerCase());
    return [...new Set(recipientsOf[index])].filter((address) => !onThread.includes(address));
  });
  const [withMail, duplicates, justSent] = await Promise.all([
    addressesWithMail(prisma, scope, connectionIds, [...new Set(outsidersOf.flat())]),
    duplicateEmails(prisma, scope, rows, recipientsOf),
    prisma.cachedMailMessage.findMany({
      where: {
        ...scope,
        fromSelf: true,
        receivedAt: { gte: new Date(Date.now() - MAIL_DUPLICATE_WINDOW_MS) },
      },
      select: {
        connectionId: true,
        threadId: true,
        toAddresses: true,
        ccAddresses: true,
        subject: true,
        snippet: true,
      },
    }),
  ]);
  const shared = sharedText(rows);
  const inboundOf = (row: MailReplyFlagInput) => threadOf(row).filter((m) => !m.fromSelf);
  const sendersOf = (row: MailReplyFlagInput) =>
    inboundOf(row).flatMap((m) => (m.fromAddress ? [m.fromAddress.toLowerCase()] : []));
  const safe = await protectedSenders(prisma, scope, [
    ...rows.flatMap(sendersOf),
    ...recipientsOf.flat(),
  ]);
  const newestSenders = rows.flatMap((row) => {
    const newest = inboundOf(row)[0];
    return newest?.fromAddress
      ? [{ connectionId: row.connectionId, senderAddress: newest.fromAddress.toLowerCase() }]
      : [];
  });
  const stats =
    newestSenders.length === 0
      ? []
      : await prisma.mailSenderStat.findMany({
          where: {
            ...scope,
            connectionId: { in: newestSenders.map((sender) => sender.connectionId) },
            senderAddress: { in: newestSenders.map((sender) => sender.senderAddress) },
          },
          select: {
            connectionId: true,
            senderAddress: true,
            priorContact: true,
            messageCount: true,
            noReplyCount: true,
          },
        });
  return rows.map((row, index) => {
    const recipients = recipientsOf[index] ?? [];
    const inbound = inboundOf(row);
    const newest = inbound[0];
    const flags = new Set<MailReplyFlag>();
    const newEmail = row.providerThreadId === null;
    const newRecipients = (outsidersOf[index] ?? []).filter(
      (address) => !withMail.has(`${row.connectionId}:${address}`),
    );
    if (newRecipients.length > 0) flags.add("new_recipient");
    if (duplicates[index]) flags.add("duplicate_email");
    if (shared[index]) flags.add("same_text");
    // An entry that does not parse cannot be checked, so it counts as off the thread, or, on a new
    // email, as someone new.
    if (newEmail) {
      if (recipients.length === 0) flags.add("new_recipient");
      const guard = (fromAddress: string) =>
        replyGuard({
          fromAddress,
          autoSubmitted: false,
          priorContact: null,
          messageCount: 0,
          noReplyCount: 0,
          protectedSender: safe.has(fromAddress),
        });
      if (recipients.some((address) => guard(address) === "no_reply_sender")) {
        flags.add("no_reply_address");
      }
    } else if (
      recipients.length === 0 ||
      recipientsOffThread(recipients, threadParticipants(threadOf(row))).length > 0
    ) {
      flags.add("not_on_thread");
    }
    if (newest && row.seenMessageId !== newest.providerMessageId) flags.add("new_message");
    if ([...sendersOf(row), ...recipients].some((address) => safe.has(address))) {
      flags.add("important_sender");
    }
    if (newest?.fromAddress) {
      const address = newest.fromAddress.toLowerCase();
      const stat = stats.find(
        (entry) => entry.connectionId === row.connectionId && entry.senderAddress === address,
      );
      const guard = replyGuard({
        fromAddress: address,
        autoSubmitted: MailSignalsSchema.safeParse(newest.signals).data?.autoSubmitted === true,
        priorContact: stat?.priorContact ?? null,
        messageCount: stat?.messageCount ?? 0,
        noReplyCount: stat?.noReplyCount ?? 0,
        protectedSender: safe.has(address),
      });
      // rarely_answered gets no flag: a customer who writes often and has no answer yet matches it.
      if (guard === "no_reply_sender") flags.add("no_reply_address");
      if (guard === "corrected") flags.add("no_reply_needed");
    }
    // A new email has no thread and may be reworded, so someone just emailed about this subject
    // counts, from any of the owner's accounts. A reply is compared with its thread's own sends.
    const alreadySent = newEmail
      ? justSent.some((message) => sentToSameSubject(message, { recipients, subject: row.subject }))
      : justSent.some(
          (message) =>
            message.connectionId === row.connectionId &&
            message.threadId === row.providerThreadId &&
            sentCopyMatches(message, row),
        );
    if (alreadySent) flags.add("already_sent");
    if (bodyHasLink(row.body)) flags.add("has_link");
    return {
      flags: flagOrder(flags),
      newestInboundId: newest?.providerMessageId ?? null,
      newRecipients,
    };
  });
}

/**
 * The batch rows of this run as the repeat guard reads them, so a sent, unknown, skipped or failed
 * row cannot go out again through another card. A failed row has one way out: the owner's Retry.
 */
export async function priorBatchRows(
  prisma: Pick<PrismaClient, "mailReplyItem" | "composeSend">,
  scope: Scope,
  runId: string,
): Promise<PriorMailEffect[]> {
  const rows = await prisma.mailReplyItem.findMany({
    where: { ...scope, effect: { runId } },
    select: {
      id: true,
      replyToId: true,
      to: true,
      subject: true,
      body: true,
      dispatch: true,
      effect: { select: { status: true } },
    },
  });
  if (rows.length === 0) return [];
  const records = await prisma.composeSend.findMany({
    where: { ...scope, clientId: { in: rows.map((row) => mailReplyClientId(row.id)) } },
    select: { clientId: true, state: true },
  });
  return rows.flatMap((row) => {
    const state = records.find((record) => record.clientId === mailReplyClientId(row.id))?.state;
    const fields = { to: row.to, subject: row.subject, body: row.body };
    // A later call may name the thread or only the same people and subject: both are the same reply.
    const known = (status: string, result: unknown) =>
      [{ ...fields, replyToId: row.replyToId }, fields].map((request) => ({
        runId,
        status,
        request,
        result,
      }));
    const discarded = row.effect.status === "denied";
    if (row.dispatch === "skipped" || discarded) return known("denied", null);
    if (row.dispatch === "reviewing") return [];
    // The same refusals as the owner's own send on a card, which also cover a reworded repeat.
    return known("denied", { outcome: state === "sent" ? "sent" : "unknown" });
  });
}

/** The activity line of a settled batch; undefined when the result is a refusal. */
export function mailBatchStepSummary(result: unknown): string | undefined {
  const replies = (result as { replies?: { outcome?: string; replyToId?: string | null }[] } | null)
    ?.replies;
  if (!Array.isArray(replies)) return undefined;
  const sent = replies.filter((reply) => reply.outcome === "sent").length;
  // A settled row with no message answered is a new email, so "replies" would be wrong.
  const what = replies.some((reply) => reply.replyToId === null) ? "email" : "reply";
  if (sent === 1) return `Sent 1 ${what}`;
  return `Sent ${sent} ${what === "email" ? "emails" : "replies"}`;
}

export type PreparedMailReply = {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  flags: MailReplyFlag[];
  newEmail: boolean;
};

/**
 * Checks a mail_reply_batch call and stores its rows, before any card. A refusal names the row. The
 * rows are unique per effect and position, so a replayed call makes no second set.
 */
export async function prepareMailReplyBatch(
  deps: Pick<MailToolDeps, "accounts" | "ownerAccounts" | "readableAccounts" | "scope"> & {
    prisma: PrismaClient;
    runId: string;
    effectId: string;
    secrets: string[];
    /** Set for a firewalled agent: each thread must stay inside its support label. */
    firewall?: FirewallMailDeps;
    /** A firewalled or external agent, or a tainted run: injected text must not choose whom it writes to. */
    refuseNewEmail?: boolean;
    /** The run has read outside content: see rowStartsUnticked. */
    outsideContent?: boolean;
    prior: PriorMailEffect[];
  },
  args: Record<string, unknown>,
): Promise<{ rows: PreparedMailReply[]; account: MailAccount } | { error: string }> {
  const parsed = BatchArgs.safeParse(args);
  if (!parsed.success) {
    return {
      error:
        "replies needs at least one row with to, subject and body, and replyToId unless it is a new email.",
    };
  }
  const { replies } = parsed.data;
  if (replies.length > MAX_MAIL_REPLY_BATCH) {
    return {
      error: `At most ${MAX_MAIL_REPLY_BATCH} replies per call. Split them into several calls.`,
    };
  }
  const scope = { spaceId: deps.scope.spaceId, userId: deps.scope.userId };
  const picked = await resolveAccount(deps, {
    account: parsed.data.account,
    replyToId: replies.find((reply) => reply.replyToId)?.replyToId,
  });
  if ("error" in picked) return { error: picked.error };
  const { account } = picked;
  const name = (index: number) =>
    replies[index]!.replyToId
      ? `Reply ${index + 1} (${replies[index]!.replyToId})`
      : `New email ${index + 1}`;

  const cached = await deps.prisma.cachedMailMessage.findMany({
    where: {
      ...scope,
      connectionId: account.id,
      providerMessageId: { in: replies.flatMap((reply) => reply.replyToId ?? []) },
    },
    select: { providerMessageId: true, threadId: true },
  });
  const threadOf = (replyToId: string) =>
    cached.find((message) => message.providerMessageId === replyToId)?.threadId;
  const seenThreads = new Map<string, number>();
  const rows: Omit<PreparedMailReply, "id" | "flags" | "newEmail">[] = [];
  for (const [index, reply] of replies.entries()) {
    if (reply.replyToId) {
      const threadId = threadOf(reply.replyToId);
      if (!threadId) {
        return { error: `${name(index)} is not in the synced mail of ${accountName(account)}.` };
      }
      const earlier = seenThreads.get(threadId);
      if (earlier !== undefined) {
        return {
          error: `${name(index)} is in the same thread as ${name(earlier)}. Use one row per thread.`,
        };
      }
      seenThreads.set(threadId, index);
      if (deps.firewall) {
        const decision = await firewallMailReadDecision(
          "mail_get",
          { account: account.address, id: reply.replyToId },
          deps.firewall,
        );
        if (!decision.free) {
          return { error: `${name(index)} is outside this agent's support label.` };
        }
      }
    } else {
      if (deps.refuseNewEmail) {
        return {
          error: `${name(index)}: new emails cannot go in a batch here. Remove the row, then send each new email with mail_send, one at a time; the owner sees each one in full.`,
        };
      }
      if (!newEmailIsComplete(reply)) {
        return { error: `${name(index)} needs a to, a subject and a body.` };
      }
    }
    const fields = [
      ...reply.to,
      ...(reply.cc ?? []),
      ...(reply.bcc ?? []),
      reply.subject,
      reply.body,
    ];
    // The card shows redacted text, and what is sent must be what the card shows.
    if (fields.some((field) => redactSecrets(field, deps.secrets) !== field)) {
      return { error: `${name(index)} contains a saved secret. Remove it and call again.` };
    }
    const refusal = mailSendRefusal(reply, deps.prior, deps.runId, MAIL_REPLY_BATCH_TOOL);
    if (refusal) return { error: `${name(index)}: ${refusal}` };
    if (!mailRequestIsValid("mail_send", reply)) {
      return { error: `${name(index)} is not a valid message. Check its addresses and subject.` };
    }
    const list = (entries: readonly string[] | undefined) =>
      parseRecipients((entries ?? []).join(", ")).map(displayAddress);
    rows.push({
      to: list(reply.to),
      cc: list(reply.cc),
      bcc: list(reply.bcc),
      subject: reply.subject,
    });
  }

  const newest =
    seenThreads.size === 0
      ? []
      : await deps.prisma.cachedMailMessage.findMany({
          where: {
            ...scope,
            connectionId: account.id,
            threadId: { in: [...seenThreads.keys()] },
            fromSelf: false,
          },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          select: { providerMessageId: true, threadId: true },
        });
  await deps.prisma.mailReplyItem.createMany({
    data: replies.map((reply, position) => {
      const providerThreadId = reply.replyToId ? threadOf(reply.replyToId)! : null;
      return {
        effectId: deps.effectId,
        position,
        ...scope,
        connectionId: account.id,
        replyToId: reply.replyToId ?? null,
        providerThreadId,
        outsideContent: deps.outsideContent === true,
        to: rows[position]!.to,
        cc: rows[position]!.cc,
        bcc: rows[position]!.bcc,
        subject: reply.subject,
        body: reply.body,
        seenMessageId:
          newest.find((message) => message.threadId === providerThreadId)?.providerMessageId ??
          null,
      };
    }),
    skipDuplicates: true,
  });
  const stored = await deps.prisma.mailReplyItem.findMany({
    where: { ...scope, effectId: deps.effectId },
    orderBy: { position: "asc" },
  });
  const flags = await mailReplyFlags(deps.prisma, scope, stored);
  return {
    account,
    rows: stored.map((row, index) => ({
      id: row.id,
      to: row.to,
      cc: row.cc,
      bcc: row.bcc,
      subject: row.subject,
      flags: flags[index]?.flags ?? [],
      newEmail: row.providerThreadId === null,
    })),
  };
}

export type MailReplyWorkerDeps = {
  prisma: PrismaClient;
  mail: MailProvider;
  jobs: JobPublisher;
  events: Pick<ThreadEvents, "setMailBatchCounts" | "settleMailReplyBatch">;
  mailWritesDisabled?: boolean;
};

/**
 * Why this bot may not send now, as a hold code, read fresh. Turning off Allow changes, a write
 * grant or the bot's sending switch stops every row not yet sent.
 */
async function sendDenial(
  prisma: PrismaClient,
  scope: Scope,
  botId: string,
  connectionId: string,
  newEmail: boolean,
): Promise<
  | typeof MAIL_REPLY_GRANT_HOLD
  | typeof MAIL_REPLY_SWITCH_HOLD
  | typeof MAIL_REPLY_FIREWALL_HOLD
  | null
> {
  const bot = await findBotWithAccess(prisma, scope, botId);
  if (!bot) return MAIL_REPLY_GRANT_HOLD;
  const allowed = accountAllowedIn(bot.rows, connectionId, MAIL_REPLY_BATCH_TOOL, bot);
  if (!allowed) return MAIL_REPLY_GRANT_HOLD;
  const off = disabledBuiltinToolSet(bot.disabledBuiltinTools);
  if (off.has("mail_send") || off.has(MAIL_REPLY_BATCH_TOOL)) return MAIL_REPLY_SWITCH_HOLD;
  // The switch may have been turned on after the card: the refusal at the call has to hold here too.
  return newEmail && (bot.firewall || bot.audience === "external")
    ? MAIL_REPLY_FIREWALL_HOLD
    : null;
}

async function findBotWithAccess(prisma: PrismaClient, scope: Scope, botId: string) {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, ...scope },
    select: {
      id: true,
      userId: true,
      spawnKey: true,
      audience: true,
      firewall: true,
      archivedAt: true,
      disabledBuiltinTools: true,
    },
  });
  if (!bot || bot.archivedAt) return null;
  const rows = await prisma.connection.findMany({
    where: scope,
    select: {
      id: true,
      connectorId: true,
      provider: true,
      status: true,
      allAgents: true,
      writesEnabled: true,
      agentBotId: true,
      privateByDefault: true,
      botAccess: {
        where: connectionAccessFilter(bot),
        select: { botId: true, canWrite: true },
      },
      agentBot: { select: { spawnKey: true } },
    },
  });
  return {
    ...bot,
    rows: connectionRowsForAudience(
      rows.map((row) => withInboxAgentStandIn(row, bot)),
      bot.audience,
      bot.firewall,
    ),
  };
}

/**
 * The accounts this bot may use for `toolName` right now, read fresh from the access rules. A card's
 * From choices and the check of the account a person picked on it both come from here, so a stale
 * or crafted client cannot send from a mailbox the agent has no access to.
 */
export async function mailAccountsUsableBy<T extends { id: string }>(
  prisma: PrismaClient,
  scope: Scope,
  botId: string,
  toolName: string,
  accounts: T[],
): Promise<T[]> {
  const bot = await findBotWithAccess(prisma, scope, botId);
  if (!bot) return [];
  return accounts.filter((account) => accountAllowedIn(bot.rows, account.id, toolName, bot));
}

async function sendRow(
  deps: MailReplyWorkerDeps,
  scope: Scope,
  rowId: string,
  botId: string,
  context: AdapterContext,
): Promise<void> {
  // Every hold comes before a provider call, so a recovered row gives back any place it held.
  const hold = (error: string) =>
    deps.prisma.mailReplyItem.updateMany({
      where: { id: rowId, dispatch: "claimed" },
      data: { dispatch: "held", error, newRecipientCount: 0, newRecipientAt: null },
    });
  const row = await deps.prisma.mailReplyItem.findFirst({ where: { id: rowId, ...scope } });
  if (!row) return;
  // The order of the plan: hash, account, grant, bot switch, stale thread, message validity. Each
  // refusal holds the row with no provider call.
  if (!row.approvedHash || mailReplyHash(row) !== row.approvedHash) {
    await hold(MAIL_REPLY_HASH_HOLD);
    return;
  }
  const accounts = await deps.mail.listAccounts(scope, context);
  const account = accounts.find((candidate) => candidate.id === row.connectionId);
  if (!account) {
    await hold(MAIL_REPLY_ACCOUNT_HOLD);
    return;
  }
  const newEmail = row.providerThreadId === null;
  const denial = await sendDenial(deps.prisma, scope, botId, row.connectionId, newEmail);
  if (denial) {
    await hold(denial);
    return;
  }
  const [flagged] = await mailReplyFlags(deps.prisma, scope, [row]);
  if (flagged?.flags.includes("new_message")) {
    await hold(MAIL_REPLY_NEW_MESSAGE_HOLD);
    return;
  }
  const message = { to: row.to, cc: row.cc, bcc: row.bcc, subject: row.subject, body: row.body };
  if (!mailRequestIsValid("mail_send", message) || (newEmail && !newEmailIsComplete(message))) {
    await hold("invalid");
    return;
  }
  // Last of the checks, so a row refused above never takes a place in the limit.
  const newRecipients = flagged?.newRecipients.length ?? 0;
  if (
    newRecipients > 0 &&
    !(await reserveNewRecipientSends(deps.prisma, {
      ...scope,
      itemId: row.id,
      connectionId: row.connectionId,
      count: newRecipients,
    }))
  ) {
    await hold(MAIL_REPLY_LIMIT_HOLD);
    return;
  }
  await mailToolFromTool(
    "mail_send",
    {
      mail: deps.mail,
      prisma: deps.prisma,
      jobs: deps.jobs,
      accounts: async () => [account],
      // Read again right before each provider write, including a provider retry.
      beforeWrite: async () =>
        (await sendDenial(deps.prisma, scope, botId, row.connectionId, newEmail))
          ? "This connected account is no longer available for changes by this bot."
          : null,
      ...(deps.mailWritesDisabled ? { writesDisabled: true } : {}),
      idempotencyKey: `batch_${row.id}`,
      sendOnce: true,
      scope: { ...scope, botId },
    },
    context,
    { ...message, ...(row.replyToId ? { replyToId: row.replyToId } : {}) },
  );
  const record = await deps.prisma.composeSend.findUnique({
    where: { spaceId_userId_clientId: { ...scope, clientId: mailReplyClientId(row.id) } },
    select: { state: true },
  });
  // A definite refusal did not reach anyone, so it does not count. "unknown" may have, so it does.
  if (!record || record.state === "failed")
    await releaseNewRecipientSends(deps.prisma, scope, row.id);
  // The send refused before it made a record (mail writes are off, for example).
  if (!record) await hold("not_sent");
}

/** Handler for the `mail.reply.batch` job: sends the queued rows in order, then settles. */
export async function runMailReplyBatch(
  deps: MailReplyWorkerDeps,
  payload: Scope & { effectId: string },
): Promise<void> {
  const scope = { spaceId: payload.spaceId, userId: payload.userId };
  const effect = await deps.prisma.externalEffect.findFirst({
    where: { id: payload.effectId, spaceId: scope.spaceId, kind: MAIL_REPLY_BATCH_TOOL },
    select: { runId: true, run: { select: { botId: true } } },
  });
  if (!effect) return;
  const context: AdapterContext = {
    operationId: `mail.reply.batch:${payload.effectId}`,
    traceId: `mail.reply.batch:${payload.effectId}`,
    ...scope,
    botId: effect.run.botId,
    runId: effect.runId,
    signal: new AbortController().signal,
  };
  for (;;) {
    const next = await deps.prisma.mailReplyItem.findFirst({
      where: { ...scope, effectId: payload.effectId, dispatch: "queued" },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!next) break;
    const claimed = await deps.prisma.mailReplyItem.updateMany({
      where: { id: next.id, dispatch: "queued" },
      data: { dispatch: "claimed" },
    });
    if (claimed.count !== 1) continue;
    try {
      await sendRow(deps, scope, next.id, effect.run.botId, context);
    } catch (error) {
      // One row's error never ends the job. The row stays claimed for recovery.
      getLogger().error("mail reply batch row", error);
    }
    await deps.events
      .setMailBatchCounts({ ...scope, effectId: payload.effectId })
      .catch((error) => getLogger().error("mail reply batch counts", error));
  }
  const { resumeRunId } = await deps.events.settleMailReplyBatch({
    ...scope,
    effectId: payload.effectId,
  });
  if (resumeRunId) {
    // The queued run is durable; a missed wake is repaired by the reconciler.
    await deps.jobs
      .enqueue(runContinueJob(resumeRunId))
      .catch((error) => getLogger().error("mail reply batch wake", error));
  }
}

/**
 * Recovers batches whose worker died, with the same staleness as a mail approval:
 * - queued: enqueue again.
 * - claimed with no record, or one in draft: back to queued. The draft claim stops two workers.
 * - claimed with pending: unknown, never resent.
 * - nothing waiting but the effect still executing: settle.
 * Held, skipped and composer rows, and claimed ones with a sent, failed or unknown record, are left
 * alone. Safe with several workers: every change is conditional on the row being unchanged.
 */
export async function reconcileMailReplyBatches(deps: {
  prisma: PrismaClient;
  jobs: JobPublisher;
  events: Pick<ThreadEvents, "settleMailReplyBatch">;
  now: Date;
  batchSize: number;
}): Promise<void> {
  const cutoff = new Date(deps.now.getTime() - MAIL_APPROVAL_STALE_MS);
  const enqueue = (row: { effectId: string; spaceId: string; userId: string }) =>
    deps.jobs.enqueue({
      ...mailReplyBatchJob({ effectId: row.effectId, spaceId: row.spaceId, userId: row.userId }),
      keepExisting: true,
      replaceLockedBefore: cutoff,
    });
  // A sent, failed or unknown row stays claimed for good, so the scan leaves those out; otherwise they
  // would fill every batch and an interrupted row behind them would never be reached.
  // ponytail: still reads every finished row of the index range each pass; give finished rows their
  // own dispatch state if this table grows large enough to show up in the reconciler's timing.
  const claimed = await deps.prisma.$transaction(
    (tx) => tx.$queryRaw<
      {
        id: string;
        effectId: string;
        spaceId: string;
        userId: string;
        updatedAt: Date;
        runId: string;
      }[]
    >`
      SELECT r.id, r."effectId", r."spaceId", r."userId", r."updatedAt", e."runId"
      FROM mail_reply_items r
      JOIN external_effects e ON e.id = r."effectId"
      LEFT JOIN compose_sends c
        ON c."spaceId" = r."spaceId" AND c."userId" = r."userId"
        AND c."clientId" = ${MAIL_REPLY_CLIENT_PREFIX} || r.id
      WHERE r.dispatch = 'claimed' AND r."updatedAt" <= ${cutoff}
        AND (c.id IS NULL OR c.state IN ('draft', 'pending'))
      ORDER BY r."updatedAt" ASC, r.id ASC
      LIMIT ${deps.batchSize}`,
  );
  for (const row of claimed) {
    const record = await deps.prisma.composeSend.findUnique({
      where: {
        spaceId_userId_clientId: {
          spaceId: row.spaceId,
          userId: row.userId,
          clientId: mailReplyClientId(row.id),
        },
      },
      select: { id: true, state: true, updatedAt: true },
    });
    if (!record || record.state === "draft") {
      // A cleared thread has no messages of the run left: this row never reached the provider, and
      // the owner has stopped the batch, so it does not go out now.
      const cleared =
        (await deps.prisma.message.count({ where: { runId: row.runId, role: "bot" } })) === 0;
      await deps.prisma.mailReplyItem.updateMany({
        where: { id: row.id, dispatch: "claimed", updatedAt: row.updatedAt },
        data: cleared
          ? {
              dispatch: "held",
              error: MAIL_REPLY_CLEARED_HOLD,
              newRecipientCount: 0,
              newRecipientAt: null,
            }
          : { dispatch: "queued" },
      });
    } else if (record.state === "pending" && record.updatedAt <= cutoff) {
      // It may have reached the provider, so it is never sent again.
      await deps.prisma.composeSend.updateMany({
        where: { id: record.id, state: "pending", updatedAt: record.updatedAt },
        data: { state: "unknown" },
      });
    }
  }
  // Includes rows just moved back above: their updatedAt is new, so match on the claim list too.
  const queued = await deps.prisma.mailReplyItem.findMany({
    where: {
      dispatch: "queued",
      OR: [{ updatedAt: { lte: cutoff } }, { id: { in: claimed.map((row) => row.id) } }],
    },
    distinct: ["effectId"],
    take: deps.batchSize,
    select: { effectId: true, spaceId: true, userId: true },
  });
  await Promise.all(queued.map(enqueue));
  const executing = await deps.prisma.externalEffect.findMany({
    where: { kind: MAIL_REPLY_BATCH_TOOL, status: "executing", updatedAt: { lte: cutoff } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: deps.batchSize,
    select: { id: true, spaceId: true, run: { select: { userId: true } } },
  });
  for (const effect of executing) {
    const { resumeRunId } = await deps.events.settleMailReplyBatch({
      spaceId: effect.spaceId,
      userId: effect.run.userId,
      effectId: effect.id,
    });
    if (resumeRunId) await deps.jobs.enqueue(runContinueJob(resumeRunId));
  }
}
