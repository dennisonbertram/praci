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
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
  state: () => { visible: boolean; focused: boolean };
  now: () => number;
  delay: (ms: number) => Promise<unknown>;
  /** Unique per call; lets a tab confirm its claim won. */
  token?: () => string;
  reportError?: (error: unknown) => void;
  /** Called after a toast is shown, so the caller can tell the server (skips phone push). */
  onShown?: (id: string) => void;
};

/** Background tabs wait this long so a focused tab claims the notification first. */
export const AWAY_DELAY_MS = 1500;
const KEY_PREFIX = "rakazo-delivered:";
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
  token: () => crypto.randomUUID(),
  reportError: (error) => console.error(error),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

const recordAge = (value: string | null, now: number) =>
  value ? now - Number.parseInt(value, 10) : Number.POSITIVE_INFINITY;

/** One key per id, so concurrent writes for different ids never overwrite each other. */
function pruneExpired(deps: Deps) {
  try {
    const storage = deps.storage;
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(KEY_PREFIX) && recordAge(storage.getItem(key), deps.now()) > RETAIN_MS) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Pruning is best effort.
  }
}

/**
 * Claims the id for this tab. Without locks the read-then-write is not atomic, so the claim
 * carries a unique token and is read back; the tab whose token survives wins.
 */
function claim(deps: Deps, id: string): boolean {
  const key = KEY_PREFIX + id;
  try {
    if (recordAge(deps.storage?.getItem(key) ?? null, deps.now()) <= RETAIN_MS) return false;
    pruneExpired(deps);
    const mine = `${deps.now()}:${deps.token?.() ?? "t"}`;
    deps.storage?.setItem(key, mine);
    return deps.storage ? deps.storage.getItem(key) === mine : true;
  } catch {
    return true; // Storage unavailable: deliver rather than lose the notification.
  }
}

function release(deps: Deps, id: string) {
  try {
    deps.storage?.removeItem(KEY_PREFIX + id);
  } catch {
    // Best effort.
  }
}

/**
 * Every delivery runs in one per-id critical section that claims a shared "delivered" entry
 * first, so exactly one tab shows a notification, even a late one.
 */
export async function deliverNotification(
  n: AttentionNotification,
  deps: Deps = defaultDeps(),
): Promise<DeliveryResult> {
  try {
    const away = !shouldToast(deps.state());
    let permission: NotificationPermission | undefined;
    if (away) {
      await deps.delay(AWAY_DELAY_MS);
      permission = await deps.requestPermission();
      if (permission !== "granted") return "skipped";
    }
    const critical = async (): Promise<DeliveryResult> => {
      // Decide now, not before the wait: the tab may have gained or lost focus.
      const present = shouldToast(deps.state());
      if (!present) {
        permission ??= await deps.requestPermission();
        if (permission !== "granted") return "skipped";
      }
      if (!claim(deps, n.id)) return "skipped";
      try {
        if (present) deps.toast(n);
        else deps.show(n.title, { body: n.body, tag: n.id });
      } catch {
        release(deps, n.id);
        return "failed";
      }
      if (!present) return "os";
      try {
        deps.onShown?.(n.id);
      } catch (error) {
        deps.reportError?.(error); // Already displayed: keep the claim so no tab repeats it.
      }
      return "toast";
    };
    return deps.locks
      ? await deps.locks.request(`rakazo-notification-${n.id}`, critical)
      : await critical();
  } catch {
    return "failed";
  }
}
