import { ORPCError } from "@orpc/server";
import type { NormalizedMailEdits } from "@rakazo/adapters";
import {
  findAccount,
  inferMailAccount,
  mailAccountsUsableBy,
  mailApprovalAgentNote,
  mailRequestIsValid,
  normalizeMailEdits,
} from "@rakazo/adapters";
import type { Actor, ComposeFields, ComposeResult, MailEdits } from "@rakazo/contracts";
import { disabledBuiltinToolSet } from "@rakazo/contracts";
import type { ThreadEvents } from "@rakazo/db";
import { mailApprovalComposeClientId } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { mailContext } from "./inbox.js";
import type { ComposeDeps } from "./inbox-compose.js";
import { inboxComposeDraftSave, inboxComposeSend } from "./inbox-compose.js";

export type MailApprovalEditDeps = ComposeDeps & {
  events: Pick<
    ThreadEvents,
    "answerRunInput" | "findMailApprovalForEdit" | "setMailApprovalOutcome"
  >;
};

export interface MailComposePath {
  send(deps: ComposeDeps, actor: Actor, input: ComposeFields): Promise<ComposeResult>;
  draftSave(deps: ComposeDeps, actor: Actor, input: ComposeFields): Promise<ComposeResult>;
}

const defaultCompose: MailComposePath = {
  send: inboxComposeSend,
  draftSave: inboxComposeDraftSave,
};

const withoutAccount = ({ account: _picked, ...rest }: NormalizedMailEdits) => rest;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** The provider ids a compose record holds, as the card stores them. */
export function composeIds(
  row: { threadId: string | null; providerMessageId: string | null; draftId: string | null } | null,
) {
  return {
    ...(row?.threadId ? { threadId: row.threadId } : {}),
    ...(row?.providerMessageId ? { messageId: row.providerMessageId } : {}),
    ...(row?.draftId ? { draftId: row.draftId } : {}),
  };
}

/**
 * An edited Send or Save draft on a mail approval, or Send now on a draft. It is the person's own action: the pending
 * agent call is denied first (one atomic claim, so a plain approval elsewhere cannot also run it),
 * and only the winner of that claim sends, through the same compose path as the Inbox composer.
 * The compose record is keyed by the effect, so a repeat can never send twice. The outcome is
 * stored on the card; a failed one is never retried here.
 */
export async function answerEditedMailApproval(
  deps: MailApprovalEditDeps,
  actor: Actor,
  target: { threadId: string },
  input: { runId: string; messageId: string; mail: MailEdits },
  /** Called once the call is claimed and the send has ended, however it ended: wakes the run. */
  afterClaim: () => Promise<void> = async () => undefined,
  compose: MailComposePath = defaultCompose,
): Promise<void> {
  const checked = normalizeMailEdits(input.mail);
  if (!checked.ok) throw new ORPCError("BAD_REQUEST", { message: checked.error });
  const pending = await deps.events.findMailApprovalForEdit({
    spaceId: actor.spaceId,
    threadId: target.threadId,
    runId: input.runId,
    messageId: input.messageId,
    answeredByUserId: actor.userId,
  });
  if (!pending) {
    throw new ORPCError("CONFLICT", { message: "This prompt is no longer awaiting an answer" });
  }
  // Replacing a saved draft is not offered by the card (it is locked), so this is only a direct call.
  if (pending.request.draftId) throw new ORPCError("BAD_REQUEST", { message: "Not editable" });
  const merged: Record<string, unknown> = { ...pending.request, ...checked.edits };
  if (!mailRequestIsValid(pending.kind, merged)) {
    throw new ORPCError("BAD_REQUEST", { message: "The message is not valid" });
  }
  if (deps.mailWritesDisabled) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Sending is turned off." });
  }
  const run = await deps.prisma.run.findFirst({
    where: { id: input.runId, spaceId: actor.spaceId, userId: actor.userId },
    select: { botId: true, bot: { select: { disabledBuiltinTools: true } } },
  });
  if (!run) {
    throw new ORPCError("CONFLICT", { message: "This prompt is no longer awaiting an answer" });
  }
  // Send now on a draft is the person's own send, so the bot's sending switch applies to it.
  const sendNow = pending.kind === "mail_draft" && input.mail.send === true;
  if (sendNow && disabledBuiltinToolSet(run.bot.disabledBuiltinTools).has("mail_send")) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Sending is turned off." });
  }

  // Only the accounts this agent may change are offered on the card, so only those are accepted: a
  // stale or crafted client must not send from any other mailbox.
  const accounts = await mailAccountsUsableBy(
    deps.prisma,
    { spaceId: actor.spaceId, userId: actor.userId },
    run.botId,
    pending.kind,
    await deps.mail.listAccounts(
      { spaceId: actor.spaceId, userId: actor.userId },
      mailContext(actor, "mail.approval.edit"),
    ),
  );
  const wanted = typeof merged.account === "string" ? merged.account.trim() : "";
  // The card submits the picked connection's id; it must be one the agent may use.
  const picked = checked.edits.account;
  const account = picked
    ? accounts.find((candidate) => candidate.id === picked)
    : wanted
      ? findAccount(accounts, wanted)
      : await inferMailAccount(
          deps.prisma,
          { spaceId: actor.spaceId, userId: actor.userId },
          accounts,
          merged,
        );
  if (!account) throw new ORPCError("BAD_REQUEST", { message: "No connected mail account" });

  const send = pending.kind === "mail_send" || sendNow;
  // Send now with no field changed is not an edit; the agent is told so.
  const edited = (["to", "cc", "bcc", "subject", "body"] as const).some(
    (key) => checked.edits[key] !== undefined,
  );
  const claimed = await deps.events.answerRunInput({
    spaceId: actor.spaceId,
    threadId: target.threadId,
    runId: input.runId,
    messageId: input.messageId,
    answeredByUserId: actor.userId,
    answer: "deny",
    mailDenial: {
      note: mailApprovalAgentNote(send, undefined, edited),
      // Only what the person typed replaces the card's fields. The rest of the card was redacted
      // when it was made, and the stored call is not, so it is never copied onto the card.
      mail: {
        ...withoutAccount(checked.edits),
        connectionId: account.id,
        // The card names the account it really went from, which may be the one picked on the card.
        ...(account.address ? { account: account.address } : {}),
        // The card now describes an email that is being sent, not a draft being saved.
        ...(sendNow ? { tool: "mail_send" as const } : {}),
      },
    },
  });
  if (!claimed) {
    // Someone else resolved the call first; nothing is sent.
    throw new ORPCError("CONFLICT", { message: "This prompt is no longer awaiting an answer" });
  }

  try {
    const replyTo = typeof merged.replyToId === "string" ? merged.replyToId.trim() : "";
    let outcome: "sent" | "saved" | "unknown" | "failed" = "failed";
    try {
      const original = replyTo
        ? await deps.prisma.cachedMailMessage.findFirst({
            where: {
              providerMessageId: replyTo,
              connectionId: account.id,
              spaceId: actor.spaceId,
              userId: actor.userId,
            },
            select: { id: true },
          })
        : null;
      if (replyTo && !original) {
        // The compose path replies through the cached message. Without it the send would go out
        // as a new conversation, so nothing is sent and the card offers the composer instead.
        throw new ORPCError("NOT_FOUND", { message: "The message being replied to is not cached" });
      }
      const fields: ComposeFields = {
        // One compose record per approval: the same key on every attempt.
        clientId: mailApprovalComposeClientId(pending.effectId),
        connectionId: account.id,
        ...(original ? { replyToMessageId: original.id } : {}),
        to: strings(merged.to).join(", "),
        cc: strings(merged.cc).join(", "),
        bcc: strings(merged.bcc).join(", "),
        subject: typeof merged.subject === "string" ? merged.subject : "",
        body: typeof merged.body === "string" ? merged.body : "",
      };
      const result = send
        ? await compose.send(deps, actor, fields)
        : await compose.draftSave(deps, actor, fields);
      outcome =
        result.status === "sent" || result.status === "saved" || result.status === "unknown"
          ? result.status
          : "failed";
    } catch (error) {
      getLogger().error("edited mail approval send failed", error);
      // The compose path rejects with an ORPCError only before it reaches the provider
      // (validation, account, record). Anything else may have come after the provider acted,
      // for example a database write that failed once the draft or message already existed.
      if (!(error instanceof ORPCError)) outcome = "unknown";
    }
    // The provider's ids come from the send record the server wrote, never from the client.
    const sentRow =
      outcome === "sent" || outcome === "saved"
        ? await deps.prisma.composeSend
            .findUnique({
              where: {
                spaceId_userId_clientId: {
                  spaceId: actor.spaceId,
                  userId: actor.userId,
                  clientId: mailApprovalComposeClientId(pending.effectId),
                },
              },
              select: { threadId: true, providerMessageId: true, draftId: true },
            })
            .catch(() => null)
        : null;
    // The send already happened, so a failed bookkeeping write must not fail the request.
    await deps.events
      .setMailApprovalOutcome({
        spaceId: actor.spaceId,
        threadId: target.threadId,
        messageId: input.messageId,
        effectId: pending.effectId,
        outcome,
        providerIds: composeIds(sentRow),
        note: mailApprovalAgentNote(send, outcome, edited, {
          to: strings(merged.to),
          from: account.address ?? undefined,
        }),
      })
      .catch((error: unknown) => {
        getLogger().error("edited mail approval outcome write failed", error);
      });
  } finally {
    await afterClaim();
  }
}
