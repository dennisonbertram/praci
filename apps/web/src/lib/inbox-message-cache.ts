import { rpc } from "./rpc";

export type InboxMessageOutput = Awaited<ReturnType<typeof rpc.inbox.get>>;

const MAX_ENTRIES = 40;
// Keyed by message id (globally unique). Holds the in-flight promise until it settles, then the value.
// Switching spaces reloads the page (no in-app event exists), which resets this module.
const promises = new Map<string, Promise<InboxMessageOutput>>();
const values = new Map<string, InboxMessageOutput>();

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
  loadInboxMessage(messageId).catch(() => {});
}
