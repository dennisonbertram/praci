import { t } from "@lingui/core/macro";
import type { NotificationToastInput } from "@rakazo/ui-web";
import { enqueueNotificationToast, notificationToastManager } from "@rakazo/ui-web";

/**
 * Approval toasts stay until dismissed, so two or more would stack over the page. Two or more
 * pending approvals show as one "N need approval" toast that opens the newest; one shows as itself.
 */
const GROUP_ID = "approvals:group";
const pending = new Map<string, { toast: NotificationToastInput; botId: string | null }>();
const shown = new Set<string>();
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
      onSeen: newest.toast.onSeen,
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
      // Dismissing the group dismisses every approval in it.
      if (id === GROUP_ID) pending.clear();
      else pending.delete(id);
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

export function enqueueApprovalToast(toast: NotificationToastInput, botId: string | null) {
  pending.set(toast.id, { toast: { ...toast, timeout: 0 }, botId });
  sync();
}

/** The approval was answered, or its chat is open: its toast has nothing left to say. */
export function dismissApprovalToastsForBot(botId: string | null | undefined) {
  if (!botId) return;
  let changed = false;
  for (const [id, entry] of pending)
    if (entry.botId === botId) changed = pending.delete(id) || changed;
  if (changed) sync();
}
