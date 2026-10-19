import { enqueueNotificationToast, type NotificationToastInput } from "@rakazo/ui-web";
import { requestBrowserNotificationPermission } from "./browser-notifications";

/** An `attention` notification; `info` only puts a dot on the sidebar and never reaches here. */
export type AttentionNotification = NotificationToastInput;

/** Present (visible tab with focus) -> in-app toast; otherwise -> OS notification. */
export function shouldToast(state: { visible: boolean; focused: boolean }): boolean {
  return state.visible && state.focused;
}

export type DeliveryResult = "toast" | "os" | "skipped" | "failed";

type Deps = {
  toast: (n: AttentionNotification) => void;
  requestPermission: () => Promise<NotificationPermission> | undefined;
  show: (title: string, options: NotificationOptions) => void;
  locks?: Pick<LockManager, "request">;
  storage?: Pick<Storage, "getItem" | "setItem">;
  state: () => { visible: boolean; focused: boolean };
  now: () => number;
  delay: (ms: number) => Promise<unknown>;
  /** Called after a toast is shown, so the caller can tell the server (skips phone push). */
  onShown?: (id: string) => void;
};

/** Background tabs wait this long so a focused tab claims the notification first. */
export const AWAY_DELAY_MS = 1500;
const STORAGE_KEY = "rakazo-delivered-notifications";
const RETAIN_MS = 24 * 60 * 60 * 1000;

const defaultDeps = (): Deps => ({
  toast: enqueueNotificationToast,
  requestPermission: () => requestBrowserNotificationPermission(),
  show: (title, options) => {
    const shown = new Notification(title, options);
    shown.onclick = () => window.focus();
  },
  locks: typeof navigator === "undefined" ? undefined : navigator.locks,
  storage: typeof localStorage === "undefined" ? undefined : localStorage,
  state: () => ({ visible: document.visibilityState === "visible", focused: document.hasFocus() }),
  now: () => Date.now(),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

function readRecord(deps: Deps): Record<string, number> {
  try {
    const parsed = JSON.parse(deps.storage?.getItem(STORAGE_KEY) ?? "{}");
    const cutoff = deps.now() - RETAIN_MS;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, number>).filter(([, at]) => at > cutoff),
    );
  } catch {
    return {};
  }
}

function writeRecord(deps: Deps, record: Record<string, number>) {
  try {
    deps.storage?.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable: the lock still serialises tabs, but a late tab may repeat it.
  }
}

/**
 * Every delivery runs in one per-id critical section that checks and records a shared
 * "delivered" entry first, so exactly one tab shows a notification, even a late one.
 */
export async function deliverNotification(
  n: AttentionNotification,
  deps: Deps = defaultDeps(),
): Promise<DeliveryResult> {
  try {
    const present = shouldToast(deps.state());
    if (!present) {
      await deps.delay(AWAY_DELAY_MS);
      if ((await deps.requestPermission()) !== "granted") return "skipped";
    }
    const critical = async (): Promise<DeliveryResult> => {
      const record = readRecord(deps);
      if (record[n.id]) return "skipped";
      writeRecord(deps, { ...record, [n.id]: deps.now() });
      try {
        if (present) {
          deps.toast(n);
          deps.onShown?.(n.id);
          return "toast";
        }
        deps.show(n.title, { body: n.body, tag: n.id });
        return "os";
      } catch {
        const { [n.id]: _undo, ...rest } = readRecord(deps);
        writeRecord(deps, rest);
        return "failed";
      }
    };
    return deps.locks
      ? await deps.locks.request(`rakazo-notification-${n.id}`, critical)
      : await critical();
  } catch {
    return "failed";
  }
}
