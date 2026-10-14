import { ORPCError } from "@orpc/server";
import { mailRequestIsValid, normalizeMailEdits } from "@rakazo/adapters";
import type { Actor, ComposeFields, ComposeResult, MailEdits } from "@rakazo/contracts";
import type { ThreadEvents } from "@rakazo/db";
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

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * An edited Send or Save draft on a mail approval. It is the person's own action: the pending
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
  // A saved draft is sent as it is; there is nothing here to edit.
  if (pending.request.draftId) throw new ORPCError("BAD_REQUEST", { message: "Not editable" });
  const merged: Record<string, unknown> = { ...pending.request, ...checked.edits };
  if (!mailRequestIsValid(pending.kind, merged)) {
    throw new ORPCError("BAD_REQUEST", { message: "The message is not valid" });
  }
  if (deps.mailWritesDisabled) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Sending is turned off." });
  }

  // The account is the caller's own connection, found from the address the agent named.
  const accounts = await deps.mail.listAccounts(
    { spaceId: actor.spaceId, userId: actor.userId },
    mailContext(actor, "mail.approval.edit"),
  );
  const wanted = typeof merged.account === "string" ? merged.account.trim().toLowerCase() : "";
  const account = wanted
    ? accounts.find((item) => item.address?.toLowerCase() === wanted)
    : accounts.length === 1
      ? accounts[0]
      : undefined;
  if (!account) throw new ORPCError("BAD_REQUEST", { message: "No connected mail account" });

  const send = pending.kind === "mail_send";
  const claimed = await deps.events.answerRunInput({
    spaceId: actor.spaceId,
    threadId: target.threadId,
    runId: input.runId,
    messageId: input.messageId,
    answeredByUserId: actor.userId,
    answer: "deny",
    mailDenial: {
      note: send
        ? "The user edited this email and sent it themselves from the approval card. Do not send it again."
        : "The user edited this email and saved it as a draft themselves from the approval card. Do not save it again.",
      mail: {
        to: strings(merged.to),
        cc: strings(merged.cc),
        bcc: strings(merged.bcc),
        subject: typeof merged.subject === "string" ? merged.subject : "",
        body: typeof merged.body === "string" ? merged.body : "",
        connectionId: account.id,
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
      const fields: ComposeFields = {
        // One compose record per approval: the same key on every attempt.
        clientId: `approval_${pending.effectId}`,
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
    }
    await deps.events.setMailApprovalOutcome({
      spaceId: actor.spaceId,
      threadId: target.threadId,
      messageId: input.messageId,
      effectId: pending.effectId,
      outcome,
    });
  } finally {
    await afterClaim();
  }
}
