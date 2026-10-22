import { t } from "@lingui/core/macro";
import type { NotificationToastInput } from "@rakazo/ui-web";
import { enqueueNotificationToast, notificationToastManager } from "@rakazo/ui-web";

/**
 * Approval toasts stay until dismissed, so two or more would stack over the page. Two or more
 * pending approvals show as one "N need approval" toast that opens the newest; one shows as itself.
 */
const GROUP_ID = "approvals:group";
/** Where an approval waits: the chat link, and the bot whose chat holds its card (a page agent or one email's agent). */
export type ApprovalChat = { href?: string; botId?: string | null };
const pending = new Map<string, { toast: NotificationToastInput; chat: ApprovalChat }>();
/** Approvals the person dismissed: a later rebuild from the server must not show them again. */
const dismissed = new Set<string>();
const shown = new Set<string>();
/** The approval whose group toast was just opened: opening clears it alone, dismissing clears all. */
let openedId: string | undefined;
/** True while this module closes toasts itself, so their `onClose` does not count as the person's dismissal. */
let syncing = false;

function wanted(): NotificationToastInput[] {
  const entries = [...pending.values()];
  const newest = entries.at(-1);
  if (!newest) return [];
  if (entries.length === 1) return [newest.toast];
  return [
    {
      id: GROUP_ID,
      title: t`${entries.length} need approval`,
      href: newest.toast.href,
      onSeen: () => {
        openedId = newest.toast.id;
        newest.toast.onSeen?.();
      },
      timeout: 0,
    },
  ];
}

function sync() {
  const next = wanted();
  syncing = true;
  try {
    const keep = new Set(next.map((toast) => toast.id));
    for (const id of [...shown]) {
      if (keep.has(id)) continue;
      notificationToastManager.close(id);
      shown.delete(id);
    }
  } finally {
    syncing = false;
  }
  for (const toast of next) {
    const { id, title, body, timeout: _timeout, onClose: _onClose, ...data } = toast;
    const onClose = () => {
      if (syncing) return;
      shown.delete(id);
      const gone = id !== GROUP_ID ? [id] : openedId ? [openedId] : [...pending.keys()];
      // Dismissing the group dismisses every approval in it.
      for (const goneId of gone) {
        pending.delete(goneId);
        dismissed.add(goneId);
      }
      openedId = undefined;
      sync();
    };
    if (shown.has(id)) {
      notificationToastManager.update(id, { title, description: body, data, onClose });
      continue;
    }
    shown.add(id);
    enqueueNotificationToast({ ...toast, onClose });
  }
}

/** Chats that show their own cards while mounted (an email's agent panel). */
const openBots = new Set<string>();

/** Marks a bot's chat as on screen, so its approvals raise no toast. Returns the undo. */
export function markApprovalChatOpen(botId: string) {
  openBots.add(botId);
  dismissApprovalToasts({ botId });
  return () => void openBots.delete(botId);
}

export function enqueueApprovalToast(toast: NotificationToastInput, chat: ApprovalChat = {}) {
  if (dismissed.has(toast.id) || (chat.botId && openBots.has(chat.botId))) return;
  pending.set(toast.id, { toast: { ...toast, timeout: 0 }, chat: { href: toast.href, ...chat } });
  sync();
}

/**
 * The approvals in that chat were answered, or the chat is open: their toasts have nothing left to say.
 * A chat is named by its link or by its bot; the bot also covers a link that points somewhere else.
 */
export function dismissApprovalToasts(chat: string | ApprovalChat) {
  const ref = typeof chat === "string" ? { href: chat } : chat;
  let changed = false;
  for (const [id, entry] of pending)
    if ((ref.href && entry.chat.href === ref.href) || (ref.botId && entry.chat.botId === ref.botId))
      changed = pending.delete(id) || changed;
  if (changed) sync();
}

/** Keeps only the approvals the server still reports unanswered; the others were answered elsewhere. */
export function retainApprovalToasts(unansweredIds: ReadonlySet<string>) {
  let changed = false;
  for (const id of [...pending.keys()])
    if (!unansweredIds.has(id)) changed = pending.delete(id) || changed;
  if (changed) sync();
}

export const hasApprovalToast = (id: string) => pending.has(id) || dismissed.has(id);
export const hasApprovalToasts = () => pending.size > 0;
