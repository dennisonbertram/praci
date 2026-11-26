import { ORPCError } from "@orpc/server";
import { findAccount } from "@rakazo/adapters";
import type { Actor, ComposeResult } from "@rakazo/contracts";
import { disabledBuiltinToolSet, MessageBlock as MessageBlockSchema } from "@rakazo/contracts";
import type { ThreadEvents } from "@rakazo/db";
import { mailApprovalComposeClientId } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { mailContext } from "./inbox.js";
import type { ComposeDeps } from "./inbox-compose.js";
import { inboxComposeSendDraft } from "./inbox-compose.js";
import { composeIds } from "./mail-approval-edit.js";

export type MailDraftSendDeps = ComposeDeps & {
  events: Pick<ThreadEvents, "setMailApprovalOutcome">;
};

/**
 * Send on a "Draft saved" card. The person's click is the approval for this one send. The draft
 * and account come from the server's record of the mail_draft call (its stored result, or the
 * compose record of an edited save), never from the client, and only for the run's own user.
 * The compose record is keyed by the call, so a repeat can never send twice.
 */
export async function sendSavedMailDraft(
  deps: MailDraftSendDeps,
  actor: Actor,
  target: { threadId: string },
  input: { runId: string; messageId: string },
  send: typeof inboxComposeSendDraft = inboxComposeSendDraft,
): Promise<ComposeResult> {
  if (deps.mailWritesDisabled) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Sending is turned off." });
  }
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const run = await deps.prisma.run.findFirst({
    where: { id: input.runId, threadId: target.threadId, ...scope },
    select: { bot: { select: { disabledBuiltinTools: true } } },
  });
  if (!run) throw new ORPCError("NOT_FOUND", { message: "Not found" });
  if (disabledBuiltinToolSet(run.bot.disabledBuiltinTools).has("mail_send")) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Sending is turned off." });
  }
  const message = await deps.prisma.message.findFirst({
    where: { id: input.messageId, threadId: target.threadId, runId: input.runId, role: "bot" },
  });
  const blocks = MessageBlockSchema.array().safeParse(message?.blocks);
  const card = blocks.success
    ? blocks.data.find(
        (block) =>
          block.kind === "ask" && block.approvalEffectId && block.mail?.tool === "mail_draft",
      )
    : undefined;
  if (card?.kind !== "ask" || !card.approvalEffectId || !card.mail) {
    throw new ORPCError("NOT_FOUND", { message: "Not found" });
  }
  const effectId = card.approvalEffectId;
  const effect = await deps.prisma.externalEffect.findFirst({
    where: { id: effectId, spaceId: actor.spaceId, runId: input.runId, kind: "mail_draft" },
  });
  if (!effect) throw new ORPCError("NOT_FOUND", { message: "Not found" });

  const clientId = mailApprovalComposeClientId(effect.id);
  const record = await deps.prisma.composeSend.findUnique({
    where: { spaceId_userId_clientId: { ...scope, clientId } },
    select: { connectionId: true, draftId: true },
  });
  let found = record?.draftId
    ? { connectionId: record.connectionId, draftId: record.draftId }
    : undefined;
  if (!found && effect.status === "completed") {
    // The agent's own saved draft: its stored result names the draft and the account.
    const result = (effect.result ?? {}) as { ok?: unknown; draftId?: unknown; account?: unknown };
    if (result.ok === true && typeof result.draftId === "string" && result.draftId) {
      const accounts = await deps.mail.listAccounts(scope, mailContext(actor, "mail.draft.send"));
      const account = findAccount(
        accounts,
        typeof result.account === "string" ? result.account : "",
      );
      if (account) found = { connectionId: account.id, draftId: result.draftId };
    }
  }
  if (!found) throw new ORPCError("CONFLICT", { message: "There is no saved draft to send" });

  // A later mail_draft that replaced this draft's content would otherwise be sent on this card's
  // approval, which was for the content the card showed.
  const replaced = await deps.prisma.externalEffect.findMany({
    where: {
      spaceId: actor.spaceId,
      kind: "mail_draft",
      status: { in: ["completed", "executing"] },
      createdAt: { gt: effect.createdAt },
      request: { path: ["draftId"], equals: found.draftId },
    },
    select: { id: true },
    take: 1,
  });
  if (replaced.length > 0) {
    throw new ORPCError("CONFLICT", { message: "This draft changed since you approved it" });
  }

  const result = await send(deps, actor, { clientId, ...found });
  if (result.status === "sent" || result.status === "unknown") {
    // The send already happened, so a failed bookkeeping write must not fail the request.
    await deps.events
      .setMailApprovalOutcome({
        spaceId: actor.spaceId,
        threadId: target.threadId,
        messageId: input.messageId,
        effectId: effect.id,
        outcome: result.status,
        providerIds: composeIds(
          await deps.prisma.composeSend
            .findUnique({
              where: { spaceId_userId_clientId: { ...scope, clientId } },
              select: { threadId: true, providerMessageId: true, draftId: true },
            })
            .catch(() => null),
        ),
        // The card now describes a sent email, so "unknown" points at Sent, not Drafts.
        tool: "mail_send",
      })
      .catch((error: unknown) => {
        getLogger().error("saved mail draft outcome write failed", error);
      });
  }
  return result;
}
