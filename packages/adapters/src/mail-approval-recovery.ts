import type { MailApproval } from "@rakazo/contracts";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { mailApprovalComposeClientId } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

type Outcome = NonNullable<MailApproval["outcome"]>;

/** A claimed approval older than this has lost its process; same as a stale pending send. */
export const MAIL_APPROVAL_STALE_MS = 2 * 60_000;

/**
 * What the agent reads when it resumes. The claim records the cautious one, since nothing is known
 * yet (and a crash must not leave it believing the mail went out); the real outcome replaces it.
 */
export function mailApprovalAgentNote(send: boolean, outcome?: Outcome): string {
  const what = send ? "email" : "draft";
  if (outcome === "sent" || outcome === "saved") {
    return send
      ? "The user edited this email and sent it themselves from the approval card. Do not send it again."
      : "The user edited this email and saved it as a draft themselves from the approval card. Do not save it again.";
  }
  if (outcome === "failed") {
    return `The user edited this ${what} on the approval card, but their ${send ? "send" : "save"} failed and nothing was ${send ? "sent" : "saved"}. Do not tell them it was ${send ? "sent" : "saved"}.`;
  }
  return `The user edited this ${what} on the approval card and the outcome of their ${send ? "send" : "save"} is ${outcome === "unknown" ? "unknown" : "not known yet"}. Do not ${send ? "send" : "save"} it again; they should check ${send ? "Sent" : "Drafts"}.`;
}

/**
 * Settles edited mail approvals whose process died after the claim, so the card does not stay on
 * "Sending..." forever. An unsettled one is a denied mail effect still carrying the claim's cautious
 * note. The compose record made with the claim says how far it got:
 * - send: still "draft" means the provider was never called, so the row is fenced as "abandoned"
 *   (never claimable again) and the card says failed;
 *   "pending" may have reached the provider, so the outcome is unknown. Nothing is ever resent.
 * - draft save: a stored draft id means it was saved; otherwise the provider may have created one.
 * Safe with several workers: record changes are conditional on the row being unchanged, and the
 * outcome write is idempotent (the effect leaves the scan once its note is replaced).
 */
export async function reconcileMailApprovals(deps: {
  prisma: PrismaClient;
  events: Pick<ThreadEvents, "setMailApprovalOutcome">;
  now: Date;
  batchSize: number;
}): Promise<void> {
  const cutoff = new Date(deps.now.getTime() - MAIL_APPROVAL_STALE_MS);
  // ponytail: oldest-first without a cursor; an effect that cannot be settled keeps its place, so
  // more than batchSize of them would hide newer ones. Add a cursor if that is ever seen.
  const effects = await deps.prisma.externalEffect.findMany({
    where: {
      kind: { in: ["mail_draft", "mail_send"] },
      status: "denied",
      updatedAt: { lte: cutoff },
      OR: [true, false].map((send) => ({
        result: { path: ["note"], equals: mailApprovalAgentNote(send) },
      })),
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: deps.batchSize,
    select: {
      id: true,
      spaceId: true,
      kind: true,
      runId: true,
      result: true,
      run: { select: { userId: true } },
    },
  });
  for (const effect of effects) {
    try {
      const send = effect.kind === "mail_send";
      const row = await deps.prisma.composeSend.findUnique({
        where: {
          spaceId_userId_clientId: {
            spaceId: effect.spaceId,
            userId: effect.run.userId,
            clientId: mailApprovalComposeClientId(effect.id),
          },
        },
        select: { id: true, state: true, draftId: true, updatedAt: true },
      });
      if (row && row.updatedAt > cutoff) continue;
      let outcome: Outcome = "unknown";
      let after: string | null = row?.state ?? null;
      if (row && send) {
        // "abandoned" fences the row: the inline sender only claims draft or failed rows, so a
        // stalled request that resumes later cannot send after the card says nothing was sent.
        const settle = async (state: "abandoned" | "unknown") => {
          const { count } = await deps.prisma.composeSend.updateMany({
            where: { id: row.id, state: row.state, updatedAt: row.updatedAt },
            data: { state },
          });
          return count === 1;
        };
        if (row.state === "sent") outcome = "sent";
        else if (row.state === "draft" || row.state === "failed") {
          if (!(await settle("abandoned"))) continue;
          outcome = "failed";
          after = "abandoned";
        } else if (row.state === "abandoned") outcome = "failed";
        // Known gap, accepted: if the inline sender records "sent" after we wrote "unknown" and the
        // API then dies before its card update, the card stays "unknown, check Sent" (conservative).
        else if (row.state === "pending") {
          if (!(await settle("unknown"))) continue;
          after = "unknown";
        }
      } else if (row && row.state === "draft" && row.draftId) {
        outcome = "saved";
      }
      const messages = await deps.prisma.message.findMany({
        where: { runId: effect.runId, role: "bot" },
        select: { id: true, threadId: true, blocks: true },
      });
      const card = messages.find(
        (message) =>
          Array.isArray(message.blocks) &&
          message.blocks.some(
            (block) =>
              block !== null &&
              typeof block === "object" &&
              (block as { kind?: unknown }).kind === "ask" &&
              (block as { approvalEffectId?: unknown }).approvalEffectId === effect.id,
          ),
      );
      if (!card) continue;
      await deps.events.setMailApprovalOutcome({
        spaceId: effect.spaceId,
        threadId: card.threadId,
        messageId: card.id,
        effectId: effect.id,
        outcome,
        note: mailApprovalAgentNote(send, outcome),
        onlyIf: {
          note: (effect.result as { note: string }).note,
          compose: {
            userId: effect.run.userId,
            clientId: mailApprovalComposeClientId(effect.id),
            state: after,
          },
        },
      });
    } catch (error) {
      getLogger().error("mail approval reconciliation", error);
    }
  }
}
