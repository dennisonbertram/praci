import type { InboxCategory, InboxPile, MailSignals } from "@rakazo/contracts";
import type { SenderMark } from "./inbox-triage.js";

/** A learned decision never covers spam: those verdicts are always the model's. */
export type LearnedPile = Exclude<InboxPile, "spam">;

/** Agreeing, conflict-free model verdicts from one sender before its pile is reused. */
export const LEARN_MIN_AGREEING = 3;

export interface PileInput {
  fromName: string | null;
  fromAddress: string;
  subject: string;
  /** Null when the message's headers have not been fetched yet. */
  signals: MailSignals | null;
  /** The user's mark on this sender (inbox_sender_feedback). */
  senderMark: SenderMark | null;
  /** True: the user wrote to this address. False: checked, never. Null: not checked yet. */
  priorContact: boolean | null;
  /** The user chose to skip the inbox for this sender (mail_sender_decisions.skipInboxAt). */
  skipInbox: boolean;
  /** The pile the model chose for this sender often enough to reuse (mail_sender_stats.learnedPile). */
  learnedPile: LearnedPile | null;
}

/** A null pile means the rules did not decide and the model should. Reasons are stable codes, not UI copy. */
export interface PileDecision {
  pile: InboxPile | null;
  reasons: string[];
}

const PILE_BY_CATEGORY: Record<InboxCategory, InboxPile> = {
  reply: "important",
  action: "important",
  billing: "important",
  scheduling: "important",
  security: "important",
  personal: "important",
  receipt: "updates",
  notification: "updates",
  fyi: "updates",
  newsletter: "newsletters",
  bulk: "newsletters",
  suspicious: "spam",
  spam: "spam",
  scam: "spam",
};

/** The pile for a model category; null for no category or one this version does not know. */
export function pileFromCategory(category: string | null): InboxPile | null {
  return category === null ? null : (PILE_BY_CATEGORY[category as InboxCategory] ?? null);
}

/**
 * The stored pile: the free rules win, except that a model verdict of spam, scam or suspicious always wins.
 * A user's Not spam choice (`notSpam`) overrides the model's spam verdict only; a rule pile of spam (Gmail's label) still counts.
 */
export function resolvePile(
  rulePile: string | null,
  category: string | null,
  notSpam = false,
): string | null {
  const modelPile = pileFromCategory(category);
  if (modelPile === "spam") return notSpam ? rulePile : "spam";
  return rulePile ?? modelPile;
}

// ponytail: a short hand-picked list. A brand it lacks is only missed here and still reaches the model.
const BRANDS = [
  "paypal",
  "apple",
  "google",
  "microsoft",
  "amazon",
  "docusign",
  "netflix",
  "dropbox",
  "coinbase",
  "fedex",
  "usps",
  "dhl",
  "chase",
  "wells fargo",
  "bank of america",
];

/** Subjects that look like a security alert, a bill or a direct ask: the model reads these. */
const SENSITIVE_SUBJECT =
  /security|sign[- ]?in|log[- ]?in|password|verification|verify|one[- ]time|invoice|\bbill\b|payment (due|failed|declined)|past due|overdue|action required|can you|could you|please reply|\?/i;

// ponytail: narrow on purpose. "Order now and save" must not match; an invoice never gets here (SENSITIVE_SUBJECT).
const TRANSACTIONAL_SUBJECT =
  /\b(receipt|your order|order (confirmation|#\s*\d+|number)|(has|was) shipped|has been delivered|(package|parcel|order) delivered|out for delivery)\b/i;

const NO_REPLY_LOCAL = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?)$/i;

const failed = (result: string | null) => result === "fail";

/** DMARC passed (so the passing DKIM or SPF aligns with the From domain) and nothing failed. */
const authPassed = (signals: MailSignals) =>
  !Object.values(signals.auth).some(failed) && signals.auth.dmarc === "pass";

function claimsBrandItIsNot(input: PileInput): boolean {
  // A look-alike such as apple-verify.example.test contains the brand, so a label must equal it.
  const labels = (input.fromAddress.split("@")[1] ?? "").toLowerCase().split(".");
  const text = `${input.fromName ?? ""} ${input.subject}`.toLowerCase();
  return BRANDS.some((brand) => {
    const claimed = new RegExp(`\\b${brand.replace(" ", "\\s*")}\\b`).test(text);
    return claimed && !labels.includes(brand.replace(" ", ""));
  });
}

/**
 * Free, deterministic sorting into piles: no model, no consent. The first stage that decides wins.
 */
export function classifyPile(input: PileInput): PileDecision {
  const { signals, senderMark, priorContact } = input;

  // 1. Safety.
  if (signals?.categories.spam) return { pile: "spam", reasons: ["gmail_spam"] };
  const authFailed = signals ? Object.values(signals.auth).some(failed) : false;
  // A sender the user marked important (for instance by choosing Not spam) is left to the model instead.
  if (authFailed && senderMark !== "important" && claimsBrandItIsNot(input))
    return { pile: "spam", reasons: ["auth_failed_brand"] };

  // 2. The user's own mark. A noise mark does not decide; it only stops prior contact from meaning important.
  // Failed authentication on a known or marked sender may be a forgery of them, so the model decides.
  if (authFailed && (senderMark === "important" || priorContact === true))
    return { pile: null, reasons: ["auth_failed"] };
  if (senderMark === "important") return { pile: "important", reasons: ["marked_important"] };

  // The user's skip-inbox decision for a sender settles the pile before prior contact is asked.
  // Failed authentication here may be a forgery of the sender, so it is left to the model.
  if (input.skipInbox && !authFailed) {
    const bulkLooking =
      signals !== null &&
      (signals.categories.promotions ||
        signals.listUnsubscribe.length > 0 ||
        signals.listId !== null ||
        signals.bulk);
    return { pile: bulkLooking ? "newsletters" : "updates", reasons: ["skip_inbox"] };
  }

  // 3. Prior contact blocks every bulk decision, and unknown counts as possible contact.
  if (!signals) return { pile: null, reasons: ["no_signals"] };
  if (priorContact === null) return { pile: null, reasons: ["prior_contact_unknown"] };
  const localPart = input.fromAddress.split("@")[0] ?? "";
  const noReply = NO_REPLY_LOCAL.test(localPart);
  if (priorContact) {
    const automated =
      signals.bulk ||
      signals.listId !== null ||
      signals.listUnsubscribe.length > 0 ||
      signals.autoSubmitted ||
      noReply;
    if (automated) return { pile: null, reasons: ["automated_prior_contact"] };
    return senderMark === "noise"
      ? { pile: null, reasons: ["prior_contact"] }
      : { pile: "important", reasons: ["prior_contact"] };
  }

  // 4. Headers and Gmail categories decide the clear cases.
  if (authFailed) return { pile: null, reasons: ["auth_failed"] };
  if (SENSITIVE_SUBJECT.test(input.subject)) return { pile: null, reasons: ["sensitive_subject"] };
  const updates = [
    signals.categories.updates && "updates_category",
    signals.categories.social && "updates_category",
    signals.autoSubmitted && "auto_submitted",
    noReply && "no_reply",
  ].filter((reason): reason is string => Boolean(reason));
  const newsletters = [
    (signals.categories.promotions || signals.categories.forums) && "promotions",
    signals.listUnsubscribe.length > 0 && "list_unsubscribe",
    signals.listId !== null && "list_id",
    signals.bulk && "bulk_precedence",
  ].filter((reason): reason is string => Boolean(reason));
  // Gmail files many newsletters under Updates, so that label alone is not a transactional sign.
  // Auto-submitted mail, social mail, receipts and no-reply senders without a List-Id are.
  const transactional = TRANSACTIONAL_SUBJECT.test(input.subject);
  const promoted = signals.categories.promotions || signals.categories.forums;
  const transactionalHint =
    signals.autoSubmitted ||
    signals.categories.social ||
    transactional ||
    (noReply && signals.listId === null && !promoted);
  if (newsletters.length && !transactionalHint)
    return { pile: "newsletters", reasons: newsletters };
  // A subject alone never decides: "I shipped the box" from a person still goes to the model.
  if (updates.length || (newsletters.length && transactional))
    return {
      pile: "updates",
      reasons: [...new Set([...updates, ...(transactional ? ["transactional_subject"] : [])])],
    };

  // 5. Learned sender decision. The same checks as above already ran: headers, safety and prior contact win.
  if (input.learnedPile && senderMark === null && authPassed(signals))
    return { pile: input.learnedPile, reasons: ["learned_sender"] };
  return { pile: null, reasons: [] };
}

export interface LearnVote {
  category: string | null;
  /** The pile came from the model (or from a learned decision), not from header rules. */
  modelDecided: boolean;
  signals: MailSignals | null;
  receivedAt: Date;
  notSpam: boolean;
  /** The header rules put this row in spam (Gmail's label). */
  ruleIsSpam: boolean;
}

export interface LearnContext {
  mark: SenderMark | null;
  priorContact: boolean | null;
  skipInbox: boolean;
  /** The user forgot the learned decision at this time; older mail does not count. */
  forgottenAt: Date | null;
  /** The stored decision, so a few verdicts that contradict it can clear it. */
  current: LearnedPile | null;
}

/**
 * What a sender's cached mail says about a learned pile. `{ pile, count }` replaces the stored decision
 * (a null pile clears it); `{ keep: true }` means no new evidence either way, so the stored one stays.
 */
export function learnSenderPile(
  votes: LearnVote[],
  ctx: LearnContext,
): { pile: LearnedPile | null; count: number } | { keep: true } {
  const none = { pile: null, count: 0 };
  if (ctx.mark !== null || ctx.priorContact !== false || ctx.skipInbox) return none;
  if (votes.some((vote) => vote.notSpam || vote.ruleIsSpam)) return none;
  const piles = votes
    .filter(
      (vote) =>
        vote.modelDecided &&
        vote.signals !== null &&
        authPassed(vote.signals) &&
        (ctx.forgottenAt === null || vote.receivedAt > ctx.forgottenAt),
    )
    .map((vote) => pileFromCategory(vote.category))
    .filter((pile): pile is InboxPile => pile !== null);
  const first = piles[0];
  if (first === undefined) return { keep: true };
  if (first === "spam" || piles.some((pile) => pile !== first)) return none;
  if (piles.length >= LEARN_MIN_AGREEING) return { pile: first, count: piles.length };
  return ctx.current !== null && ctx.current !== first ? none : { keep: true };
}
