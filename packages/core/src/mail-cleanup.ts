import type { CleanupKind, CleanupSender, InboxMark, InboxPile } from "@rakazo/contracts";

/** A sender needs this many window messages before the cleanup screen preselects it. */
export const CLEANUP_MIN_MESSAGES = 3;
/** Preselected senders have a read rate below this. */
export const CLEANUP_MAX_READ_RATE = 0.2;

export const senderKey = (connectionId: string, address: string) =>
  `${connectionId}:${address.toLowerCase()}`;

export interface CleanupCandidate {
  messageCount: number;
  readCount: number;
  /** The sender stat's flag for the newest message. */
  bulk: boolean;
  /** The pile of the sender's newest inbox message. */
  newestPile: InboxPile | null;
  /** True: the user wrote to this address. False: checked, never. Null: not checked, which never preselects. */
  priorContact: boolean | null;
  mark: InboxMark | null;
  spamLike: boolean;
  skipInbox: boolean;
}

/** Bulk, rarely read, never written to, not marked important, not spam-like, not already skipped. */
export function isCleanupPreselected(sender: CleanupCandidate): boolean {
  const bulk =
    sender.bulk || sender.newestPile === "updates" || sender.newestPile === "newsletters";
  return (
    bulk &&
    sender.messageCount >= CLEANUP_MIN_MESSAGES &&
    sender.readCount / sender.messageCount < CLEANUP_MAX_READ_RATE &&
    sender.priorContact === false &&
    sender.mark !== "important" &&
    !sender.spamLike &&
    !sender.skipInbox
  );
}

/** Most unopened mail first, then the larger sender, then address. */
export function rankCleanupSenders<T extends CleanupSender>(senders: T[]): T[] {
  return [...senders].sort(
    (a, b) =>
      b.messageCount - b.readCount - (a.messageCount - a.readCount) ||
      b.messageCount - a.messageCount ||
      a.address.localeCompare(b.address),
  );
}

/** Conversations each choice would touch for the selected senders. */
export function cleanupChoiceCounts(
  senders: CleanupSender[],
  selected: ReadonlySet<string>,
): Record<CleanupKind, number> {
  const counts: Record<CleanupKind, number> = {
    archive: 0,
    skip_inbox: 0,
    unsubscribe: 0,
    spam: 0,
  };
  for (const sender of senders) {
    if (!selected.has(senderKey(sender.connectionId, sender.address))) continue;
    counts.archive += sender.inboxThreads;
    counts.spam += sender.inboxThreads;
    if (!sender.spamLike) counts.skip_inbox += sender.inboxThreads;
    if (["one_click", "link", "mailto"].includes(sender.unsubscribe))
      counts.unsubscribe += sender.inboxThreads;
  }
  return counts;
}
