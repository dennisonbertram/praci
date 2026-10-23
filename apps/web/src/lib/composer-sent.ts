import { parseRecipient, splitEntries } from "./recipients";

/** A message the Inbox composer sent, as much of it as a card needs to recognise its own draft. */
export type ComposerSent = { connectionId: string; subject: string; to: string };

const listeners = new Set<(sent: ComposerSent) => void>();

export function announceComposerSent(sent: ComposerSent): void {
  for (const listener of [...listeners]) listener(sent);
}

export function onComposerSent(listener: (sent: ComposerSent) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const addresses = (to: string | readonly string[]) =>
  (typeof to === "string" ? splitEntries(to) : [...to])
    .map((entry) => parseRecipient(entry).address.toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");

/** Whether the composer's send is the draft a failed card kept: same account, subject and To. */
export function isSameDraft(
  mail: { connectionId?: string; subject: string; to: readonly string[] },
  sent: ComposerSent,
): boolean {
  return (
    Boolean(mail.connectionId) &&
    mail.connectionId === sent.connectionId &&
    mail.subject === sent.subject &&
    addresses(mail.to) === addresses(sent.to)
  );
}
