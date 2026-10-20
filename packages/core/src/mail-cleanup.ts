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

/** The selected senders a choice applies to: skip inbox leaves out spam-like senders, unsubscribe those with no way to. */
export function cleanupTargets(
  kind: CleanupKind,
  senders: CleanupSender[],
  selected: ReadonlySet<string>,
): CleanupSender[] {
  return senders.filter(
    (sender) =>
      selected.has(senderKey(sender.connectionId, sender.address)) &&
      (kind === "skip_inbox"
        ? !sender.spamLike
        : kind === "unsubscribe"
          ? ["one_click", "link", "mailto"].includes(sender.unsubscribe)
          : true),
  );
}

/** Conversations each choice would touch for the selected senders. */
export function cleanupChoiceCounts(
  senders: CleanupSender[],
  selected: ReadonlySet<string>,
): Record<CleanupKind, number> {
  const count = (kind: CleanupKind) =>
    cleanupTargets(kind, senders, selected).reduce((sum, sender) => sum + sender.inboxThreads, 0);
  return {
    archive: count("archive"),
    skip_inbox: count("skip_inbox"),
    unsubscribe: count("unsubscribe"),
    spam: count("spam"),
  };
}
