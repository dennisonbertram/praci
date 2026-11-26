import { createHash } from "node:crypto";
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
export function mailApprovalAgentNote(
  send: boolean,
  outcome?: Outcome,
  edited = true,
  sentAs?: { to: string[]; from?: string | undefined },
): string {
  const what = send ? "email" : "draft";
  const did = edited
    ? `edited this ${what} on the approval card`
    : `used the approval card for this ${what}`;
  if (outcome === "sent" || outcome === "saved") {
    const who = sentAs?.to.length
      ? `This email was sent to ${sentAs.to.join(", ")}${sentAs.from ? ` from ${sentAs.from}` : ""}. `
      : "";
    return send
      ? `${who}The user ${edited ? "edited this email and sent it" : "sent this email"} themselves from the approval card. Do not send it again.`
      : "The user edited this email and saved it as a draft themselves from the approval card. Do not save it again.";
  }
  if (outcome === "failed") {
    return `The user ${did}, but their ${send ? "send" : "save"} failed and nothing was ${send ? "sent" : "saved"}. Do not tell them it was ${send ? "sent" : "saved"}. Tell them in your next message that it failed and that the card keeps the draft to open in the composer.`;
  }
  return `The user ${did} and the outcome of their ${send ? "send" : "save"} is ${outcome === "unknown" ? "unknown" : "not known yet"}. Do not ${send ? "send" : "save"} it again; they should check ${send ? "Sent" : "Drafts"}.`;
}

/** The note an unsettled claim carries: nothing is known yet about the person's own send. */
const claimNotes = () => [
  mailApprovalAgentNote(true),
  mailApprovalAgentNote(true, undefined, false),
  mailApprovalAgentNote(false),
];

/**
 * A mail effect the person answered by sending or saving it themselves from the card, as opposed to
 * one they refused. Older rows stay "denied" with an outcome, so this reads the result, not the status.
 */
export function isCardMailSend(result: unknown): boolean {
  const stored = (result ?? {}) as { note?: unknown; outcome?: unknown };
  return stored.outcome !== undefined || claimNotes().includes(stored.note as string);
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
 * What the agent reads when an approved send or draft failed. It says which step failed, so the
 * agent does not blame the original message, and that the card keeps the draft for the person.
 */
export function failedMailToAgent(name: "mail_send" | "mail_draft", error: string) {
  const send = name === "mail_send";
  return {
    error: `The ${send ? "send" : "draft save"} failed (${error.slice(0, 200)}). Nothing was ${send ? "sent" : "saved"}. The approval card keeps the draft with an Open in composer button. Tell the user the ${send ? "send" : "save"} failed and the draft is kept; do not say the original message was missing.`,
  };
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
      OR: claimNotes().map((note) => ({ result: { path: ["note"], equals: note } })),
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
      // A draft approval the person sent now carries the send note.
      const send =
        claimNote === mailApprovalAgentNote(true) ||
        claimNote === mailApprovalAgentNote(true, undefined, false);
      const row = await deps.prisma.composeSend.findUnique({
        where: {
          spaceId_userId_clientId: {
            spaceId: effect.spaceId,
            userId: effect.run.userId,
            clientId: mailApprovalComposeClientId(effect.id),
          },
        },
        select: {
          id: true,
          state: true,
          draftId: true,
          threadId: true,
          providerMessageId: true,
          updatedAt: true,
        },
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
      const cardBlock = (block: unknown): block is { mail?: Partial<MailApproval> } =>
        block !== null &&
        typeof block === "object" &&
        (block as { kind?: unknown }).kind === "ask" &&
        (block as { approvalEffectId?: unknown }).approvalEffectId === effect.id;
      const card = messages.find(
        (message) => Array.isArray(message.blocks) && message.blocks.some(cardBlock),
      );
      const shown = (card?.blocks as unknown[] | undefined)?.find(cardBlock)?.mail;
      // A cleared thread has no card; the effect's note is still settled so it leaves the scan.
      await deps.events.setMailApprovalOutcome({
        spaceId: effect.spaceId,
        threadId: card?.threadId ?? effect.run.threadId,
        ...(card ? { messageId: card.id } : {}),
        effectId: effect.id,
        outcome,
        ...(row
          ? {
              providerIds: {
                ...(row.threadId ? { threadId: row.threadId } : {}),
                ...(row.providerMessageId ? { messageId: row.providerMessageId } : {}),
                ...(row.draftId ? { draftId: row.draftId } : {}),
              },
            }
          : {}),
        note: mailApprovalAgentNote(send, outcome, true, {
          to: shown?.to ?? [],
          from: shown?.account,
        }),
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

const bodyHash = (value: unknown): string =>
  createHash("sha256").update(text(value).replace(/\s+/g, " ")).digest("hex");

/**
 * Two mail_send calls are the same email when they answer the same message, or go to the same
 * people about the same thing, with the same text. A corrected body is a new email.
 */
function sameEmail(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (bodyHash(a.body) !== bodyHash(b.body)) return false;
  return sameThread(a, b);
}

function sameThread(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const replyA = text(a.replyToId);
  const replyB = text(b.replyToId);
  if (replyA || replyB) return replyA === replyB;
  return addresses(a.to) === addresses(b.to) && baseSubject(a.subject) === baseSubject(b.subject);
}

/** How long a matching sent email counts as a possible accident rather than a follow-up. */
export const MAIL_DUPLICATE_WINDOW_MS = 15 * 60_000;

const comparable = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/(…|\.\.\.)$/, "")
    .trim()
    .toLowerCase();

/**
 * Whether a message in Sent is this email: the same people, and text that starts the same. The
 * cached message keeps only the provider's snippet, so that is all there is to compare.
 */
export function sentCopyMatches(
  sent: { toAddresses: readonly string[]; snippet: string },
  mail: { to?: unknown; body?: unknown },
): boolean {
  const snippet = comparable(sent.snippet);
  return (
    snippet.length > 0 &&
    addresses(sent.toAddresses) === addresses(mail.to) &&
    comparable(text(mail.body)).startsWith(snippet)
  );
}

/** Whether a message in Sent went to any of these lowercased addresses about the same thing. */
export function sentToSameSubject(
  sent: { toAddresses: readonly string[]; ccAddresses: readonly string[]; subject: string },
  mail: { recipients: readonly string[]; subject: string },
): boolean {
  return (
    baseSubject(sent.subject) === baseSubject(mail.subject) &&
    addresses([...sent.toAddresses, ...sent.ccAddresses])
      .split(",")
      .some((address) => mail.recipients.includes(address))
  );
}

/**
 * Whether this mail_send repeats an email that already went out moments ago, in any run: from a
 * sent call in this conversation (exact text, right away), or from Sent (any path, once synced,
 * such as the composer or a reply batch). The card then warns; only a person's press can send it.
 */
export async function recentlySentSameEmail(
  prisma: Pick<PrismaClient, "externalEffect" | "cachedMailMessage">,
  scope: { spaceId: string; userId: string; threadId: string },
  args: Record<string, unknown>,
  now: Date,
): Promise<boolean> {
  if (!text(args.body) || addresses(args.to) === "") return false;
  const since = new Date(now.getTime() - MAIL_DUPLICATE_WINDOW_MS);
  const effects = await prisma.externalEffect.findMany({
    where: {
      spaceId: scope.spaceId,
      kind: "mail_send",
      status: "completed",
      updatedAt: { gte: since },
      run: { threadId: scope.threadId },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { request: true, result: true },
  });
  const sentCall = effects.some(
    (effect) =>
      !(effect.result as { error?: unknown } | null)?.error &&
      sameEmail(args, effect.request as Record<string, unknown>),
  );
  if (sentCall) return true;
  const sent = await prisma.cachedMailMessage.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      fromSelf: true,
      receivedAt: { gte: since },
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: { toAddresses: true, subject: true, snippet: true },
  });
  return sent.some(
    (message) =>
      baseSubject(message.subject) === baseSubject(args.subject) && sentCopyMatches(message, args),
  );
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
  tool = "mail_send",
): string | undefined {
  const placeholder = `${text(args.subject)}\n${text(args.body)}`.match(PLACEHOLDER)?.[0];
  if (placeholder) {
    return `The email still contains the placeholder ${placeholder}. Replace it with real text (sign with the user's name if you know it, or leave the signature off), then call ${tool} again.`;
  }
  // Only this run's own earlier calls count: a later request may legitimately send a follow-up.
  for (const effect of prior) {
    if (effect.runId !== runId) continue;
    const request = effect.request as Record<string, unknown> | null;
    if (!request || typeof request !== "object" || !sameThread(args, request)) continue;
    const result = (effect.result ?? {}) as { error?: unknown; outcome?: unknown; note?: unknown };
    // The user's own edited send on the approval card: the agent cannot know its text, so any
    // new call about the same thing in this run is refused.
    const cardSend =
      result.outcome === "sent" ||
      result.outcome === "unknown" ||
      result.note === mailApprovalAgentNote(true) ||
      result.note === mailApprovalAgentNote(true, undefined, false);
    if (cardSend) {
      return result.outcome === "sent"
        ? "The user already sent this email from the approval card. Do not send it again or offer another approval for it; tell the user it was sent."
        : "The user sent an edited version from the approval card and it may not have gone out. Do not send it again; tell the user it may not have been sent and to check Sent.";
    }
    if (!sameEmail(args, request)) continue;
    if (effect.status === "completed" && !result.error) {
      return "This email was already sent in this conversation. Do not send it again or offer another approval for it; tell the user it was sent.";
    }
    if (effect.status === "executing" || effect.status === "uncertain") {
      return "This email may already have been sent, but the outcome is uncertain. Do not send it again or offer another approval for it; tell the user it may not have been sent and to check Sent.";
    }
    if (effect.status === "denied" && result.outcome !== "failed") {
      return "The user discarded this email. Do not offer it again; ask the user what they want to change.";
    }
  }
  return undefined;
}
