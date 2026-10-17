import { MAIL_SENT_EVENT } from "./outbox";
import { rpc } from "./rpc";

export type InboxMessageOutput = Awaited<ReturnType<typeof rpc.inbox.get>>;

/** Fired on `window` after mail is archived or marked outside the Inbox page, so its list reloads. */
export const INBOX_CHANGED_EVENT = "rakazo:inbox-changed";

const MAX_ENTRIES = 40;
// Keyed by message id (globally unique). Holds the in-flight promise until it settles, then the value.
// Switching spaces reloads the page (no in-app event exists), which resets this module.
const promises = new Map<string, Promise<InboxMessageOutput>>();
const values = new Map<string, InboxMessageOutput>();
const PREFETCH_PAUSE_MS = 30_000;
// After a failed load, background prefetches stop for a while; opening a message still loads.
let pausedUntil = 0;

/** Forgets every loaded message, so the next open shows the conversation as it is now. */
export function clearInboxMessages(): void {
  promises.clear();
  values.clear();
}

// A sent reply joins its conversation, and an archive or mark changes a message's state.
if (typeof window !== "undefined") {
  window.addEventListener(MAIL_SENT_EVENT, clearInboxMessages);
  window.addEventListener(INBOX_CHANGED_EVENT, clearInboxMessages);
}

export function peekInboxMessage(messageId: string): InboxMessageOutput | undefined {
  return values.get(messageId);
}

export function loadInboxMessage(messageId: string): Promise<InboxMessageOutput> {
  const existing = promises.get(messageId);
  if (existing) return existing;
  const promise = rpc.inbox.get({ messageId }).then(
    (message) => {
      values.set(messageId, message);
      return message;
    },
    (cause) => {
      promises.delete(messageId);
      pausedUntil = Date.now() + PREFETCH_PAUSE_MS;
      throw cause;
    },
  );
  promises.set(messageId, promise);
  if (promises.size > MAX_ENTRIES) {
    const oldest = promises.keys().next().value;
    if (oldest !== undefined) {
      promises.delete(oldest);
      values.delete(oldest);
    }
  }
  return promise;
}

export function prefetchInboxMessage(messageId: string): void {
  if (Date.now() < pausedUntil) return;
  loadInboxMessage(messageId).catch(() => {});
}
