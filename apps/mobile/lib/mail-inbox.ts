import type {
  CleanupArchiveInput,
  CleanupArchiveOutput,
  CleanupListOutput,
  InboxBulkResult,
  InboxListOutput,
  InboxMessage,
  InboxMoveInput,
  InboxMoveOutput,
  InboxPile,
  InboxTodo,
  MailActionsListOutput,
  MailActionUndoOutput,
  UnsubscribeInput,
  UnsubscribeOutput,
} from "@rakazo/contracts";
import { bulkInChunks } from "@rakazo/core";
import { rpc } from "./api";
import { dateLocaleForUi, t } from "./i18n";

// Mail code uses the `mail-inbox` prefix because lib/inbox.ts is the home bot list.
// Grouping (groupInbox) and due-date math live in @rakazo/core, shared with the web page.

export const listMailInbox = (connectionId?: string, pile?: InboxPile) =>
  rpc<InboxListOutput>("inbox/list", {
    ...(connectionId ? { connectionId } : {}),
    ...(pile ? { pile } : {}),
  });

/** Archives whole threads, 50 per call; spam-pile mail only with `allowSpam`, which the Spam pile sets. */
export const archiveMailMessages = (messageIds: string[], allowSpam = false) =>
  bulkInChunks(messageIds, (slice) =>
    rpc<InboxBulkResult>("inbox/archiveMany", {
      messageIds: slice,
      ...(allowSpam ? { allowSpam } : {}),
    }),
  );

/** Reports spam, clears the spam flag or trashes whole threads, 50 per call; the batch ids undo them. */
export async function moveMailMessages(op: InboxMoveInput["op"], messageIds: string[]) {
  const batchIds: string[] = [];
  const result = await bulkInChunks(messageIds, async (slice) => {
    const out = await rpc<InboxMoveOutput>("inbox/moveMany", { op, messageIds: slice });
    batchIds.push(out.batchId);
    return out;
  });
  return { ...result, batchIds };
}

export const listCleanup = (connectionId?: string) =>
  rpc<CleanupListOutput>("inbox/cleanup/list", connectionId ? { connectionId } : {});

export const cleanupArchive = (input: CleanupArchiveInput) =>
  rpc<CleanupArchiveOutput>("inbox/cleanup/archive", input);

export const forgetCleanupSender = (connectionId: string, address: string, learned?: boolean) =>
  rpc<{ ok: true }>("inbox/cleanup/forget", { connectionId, address, ...(learned && { learned }) });

export const unsubscribeSender = (input: UnsubscribeInput) =>
  rpc<UnsubscribeOutput>("inbox/unsubscribe", input);

export const listMailActions = () => rpc<MailActionsListOutput>("inbox/actions/list", {});

export const undoMailAction = (batchId: string) =>
  rpc<MailActionUndoOutput>("inbox/actions/undo", { batchId });

// Refresh can wait out a rate-limit backoff (up to 30 s) and then sync (24 s seen), over the 8 s default.
const REFRESH_TIMEOUT_MS = 90_000;

export const refreshMailInbox = () =>
  rpc<{ ok: true }>("inbox/refresh", { waitMs: 8_000 }, { timeoutMs: REFRESH_TIMEOUT_MS });

export const getMailMessage = (messageId: string) => rpc<InboxMessage>("inbox/get", { messageId });

export const listMailTodos = (connectionId?: string) =>
  rpc<{ enabled: boolean; todos: InboxTodo[] }>(
    "inbox/todos/list",
    connectionId ? { connectionId } : {},
  );

export const completeMailTodo = (id: string) =>
  rpc<InboxTodo>("inbox/todos/setDone", { id, done: true });

/** The only way to create the Inbox agent; it returns the same bot every time. */
export const ensureMailAgent = () => rpc<{ id: string; name: string }>("inbox/agent");

/** Opens the agent made for this message's conversation, creating it on the first ask. */
export const askMailThreadAgent = (messageId: string) =>
  rpc<{ id: string; name: string }>("inbox/askAgent", { messageId });

/** "Today", a weekday within the next six days, otherwise month and day. */
export function todoDueLabel(dueOn: string, days: number): string {
  if (days === 0) return t("Today");
  const [year = 0, month = 1, day = 1] = dueOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    dateLocaleForUi(),
    days > 0 && days <= 6 ? { weekday: "short" } : { month: "short", day: "numeric" },
  );
}
