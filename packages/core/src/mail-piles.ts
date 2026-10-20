import type { InboxCategory, InboxPile, MailSignals } from "@rakazo/contracts";
import type { SenderMark } from "./inbox-triage.js";

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

/** The stored pile: the free rules win, except that a model verdict of spam, scam or suspicious always wins. */
export function resolvePile(rulePile: string | null, category: string | null): string | null {
  const modelPile = pileFromCategory(category);
  return modelPile === "spam" ? "spam" : (rulePile ?? modelPile);
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

const NO_REPLY_LOCAL = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?)$/i;

const failed = (result: string | null) => result === "fail";

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
 * Stage 5 of the plan, the learned sender decision, is not built yet (phase 6).
 */
export function classifyPile(input: PileInput): PileDecision {
  const { signals, senderMark, priorContact } = input;

  // 1. Safety.
  if (signals?.categories.spam) return { pile: "spam", reasons: ["gmail_spam"] };
  const authFailed = signals ? Object.values(signals.auth).some(failed) : false;
  if (authFailed && claimsBrandItIsNot(input))
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
  if (updates.length) return { pile: "updates", reasons: [...new Set(updates)] };
  const newsletters = [
    (signals.categories.promotions || signals.categories.forums) && "promotions",
    signals.listUnsubscribe.length > 0 && "list_unsubscribe",
    signals.listId !== null && "list_id",
    signals.bulk && "bulk_precedence",
  ].filter((reason): reason is string => Boolean(reason));
  if (newsletters.length) return { pile: "newsletters", reasons: newsletters };

  // 5. Learned sender decision: phase 6.
  return { pile: null, reasons: [] };
}
