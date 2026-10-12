// Pure helpers for the `emails` message block: grouping, default urgency and a text fallback.
import type { EmailCard, EmailUrgency } from "@rakazo/contracts";

export const EMAIL_URGENCY_ORDER: readonly EmailUrgency[] = [
  "today",
  "within_3_days",
  "this_week",
  "later",
];

const DAY_MS = 86_400_000;

/** Non-empty groups in urgency order, each newest first. */
export function groupEmailCards(emails: readonly EmailCard[]) {
  return EMAIL_URGENCY_ORDER.flatMap((urgency) => {
    const group = emails
      .filter((email) => email.urgency === urgency)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    return group.length > 0 ? [{ urgency, emails: group }] : [];
  });
}

/**
 * Urgency from triage when the model gives none. A due date wins (overdue counts as today, in UTC
 * days); otherwise priority; untriaged mail is Later.
 */
export function triageUrgency(
  triage: { priority: string | null; dueOn: string | Date | null },
  now: Date,
): EmailUrgency {
  if (triage.dueOn) {
    const due = new Date(triage.dueOn);
    const days = Math.floor(
      (Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) -
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
        DAY_MS,
    );
    if (days <= 0) return "today";
    if (days <= 3) return "within_3_days";
    return days <= 7 ? "this_week" : "later";
  }
  if (triage.priority === "critical") return "today";
  return triage.priority === "important" ? "within_3_days" : "later";
}

/** Plain list for surfaces without cards. Backslash-escapes Markdown, since mail text is untrusted. */
export function emailCardsText(emails: readonly EmailCard[]): string {
  const plain = (value: string) => value.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, "\\$&");
  return groupEmailCards(emails)
    .flatMap((group) => group.emails)
    .map((email) => `${plain(email.from)}: ${plain(email.subject)}`)
    .join("\n");
}
