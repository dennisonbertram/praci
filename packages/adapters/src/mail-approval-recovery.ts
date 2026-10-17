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

/** How an approved mail_send or mail_draft call ended, from its tool result, for its card. */
export function approvedMailOutcome(
  name: "mail_send" | "mail_draft",
  result: Record<string, unknown>,
): { outcome: Outcome; error?: string } {
  const error = typeof result.error === "string" ? result.error : undefined;
  if (!error) return { outcome: name === "mail_send" ? "sent" : "saved" };
  // mail_send says so when the provider may have sent it; the card must not say "Not sent".
  if (error.includes("may or may not")) return { outcome: "unknown" };
  return { outcome: "failed", error };
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
      run: { select: { userId: true, threadId: true } },
    },
  });
  for (const effect of effects) {
    const claimNote = (effect.result as { note: string }).note;
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
      // A cleared thread has no card; the effect's note is still settled so it leaves the scan.
      await deps.events.setMailApprovalOutcome({
        spaceId: effect.spaceId,
        threadId: card?.threadId ?? effect.run.threadId,
        ...(card ? { messageId: card.id } : {}),
        effectId: effect.id,
        outcome,
        note: mailApprovalAgentNote(send, outcome),
        onlyIf: {
          note: claimNote,
          compose: {
            userId: effect.run.userId,
            clientId: mailApprovalComposeClientId(effect.id),
            state: after,
          },
        },
      });
    } catch (error) {
      getLogger().error("mail approval reconciliation", error);
    } finally {
      // Still unsettled (skipped, fresh, or failed): move it to the back of the oldest-first scan
      // so it cannot starve newer approvals. It is retried once the stale window passes again.
      await deps.prisma.externalEffect
        .updateMany({
          where: { id: effect.id, result: { path: ["note"], equals: claimNote } },
          data: { updatedAt: deps.now },
        })
        .catch(() => undefined);
    }
  }
}

const addresses = (value: unknown): string =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => (item.match(/<([^>]+)>/)?.[1] ?? item).trim().toLowerCase())
    .sort()
    .join(",");
const baseSubject = (value: unknown): string =>
  (typeof value === "string" ? value : "")
    .replace(/^\s*((re|fwd?)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Two mail_send calls are the same email when they answer the same message, or go to the same people about the same thing. */
function sameEmail(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const replyA = text(a.replyToId);
  const replyB = text(b.replyToId);
  if (replyA || replyB) return replyA === replyB;
  return addresses(a.to) === addresses(b.to) && baseSubject(a.subject) === baseSubject(b.subject);
}

/** A bracketed stand-in the model left for the user to fill, such as "[Your Name]". */
const PLACEHOLDER = /\[(?:your|my|sender|insert|recipient)[^\]\n]{0,40}\]/i;

export type PriorMailEffect = { runId: string; status: string; request: unknown; result: unknown };

/**
 * Why a mail_send call must not reach an approval card, or undefined when it may. Checked before
 * the card is made, so the user never sees a placeholder signature or a second card for an email
 * that already went out (the agent does not always follow the note on the earlier result).
 */
export function mailSendRefusal(
  args: Record<string, unknown>,
  prior: PriorMailEffect[],
  runId: string,
): string | undefined {
  const placeholder = `${text(args.subject)}\n${text(args.body)}`.match(PLACEHOLDER)?.[0];
  if (placeholder) {
    return `The email still contains the placeholder ${placeholder}. Replace it with real text (sign with the user's name if you know it, or leave the signature off), then call mail_send again.`;
  }
  for (const effect of prior) {
    const request = effect.request as Record<string, unknown> | null;
    if (!request || typeof request !== "object" || !sameEmail(args, request)) continue;
    const result = (effect.result ?? {}) as { error?: unknown; outcome?: unknown; note?: unknown };
    const sentOrMaybe =
      (effect.status === "completed" && !result.error) ||
      effect.status === "executing" ||
      effect.status === "uncertain" ||
      (effect.status === "denied" &&
        (result.outcome === "sent" ||
          result.outcome === "unknown" ||
          result.note === mailApprovalAgentNote(true)));
    if (sentOrMaybe) {
      return "This email was already sent in this conversation. Do not send it again or offer another approval for it; tell the user it was sent.";
    }
    if (effect.status === "denied" && effect.runId === runId && result.outcome !== "failed") {
      return "The user discarded this email. Do not offer it again; ask the user what they want to change.";
    }
  }
  return undefined;
}
