import type { InboxListOutput, InboxMessage, InboxTodo } from "@rakazo/contracts";
import { rpc } from "./api";
import { dateLocaleForUi, t } from "./i18n";

// Mail code uses the `mail-inbox` prefix because lib/inbox.ts is the home bot list.
// Grouping (groupInbox) and due-date math live in @rakazo/core, shared with the web page.

export const listMailInbox = (connectionId?: string) =>
  rpc<InboxListOutput>("inbox/list", connectionId ? { connectionId } : {});

// Refresh can wait out a rate-limit backoff (up to 30 s) and then sync (24 s seen), over the 8 s default.
const REFRESH_TIMEOUT_MS = 90_000;

export const refreshMailInbox = () =>
  rpc<{ ok: true }>("inbox/refresh", {}, { timeoutMs: REFRESH_TIMEOUT_MS });

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

/** "Today", a weekday within the next six days, otherwise month and day. */
export function todoDueLabel(dueOn: string, days: number): string {
  if (days === 0) return t("Today");
  const [year = 0, month = 1, day = 1] = dueOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    dateLocaleForUi(),
    days > 0 && days <= 6 ? { weekday: "short" } : { month: "short", day: "numeric" },
  );
}
