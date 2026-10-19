import { enqueueNotificationToast, type NotificationToastInput } from "@rakazo/ui-web";
import { requestBrowserNotificationPermission } from "./browser-notifications";

/** An `attention` notification; `info` only puts a dot on the sidebar and never reaches here. */
export type AttentionNotification = NotificationToastInput;

/** Present (visible tab with focus) -> in-app toast; otherwise -> OS notification. */
export function shouldToast(state: { visible: boolean; focused: boolean }): boolean {
  return state.visible && state.focused;
}

type Deps = {
  toast: (n: AttentionNotification) => void;
  requestPermission: () => Promise<NotificationPermission> | undefined;
  show: (title: string, options: NotificationOptions) => void;
  locks?: Pick<LockManager, "request">;
  state: () => { visible: boolean; focused: boolean };
};

const LOCK_HOLD_MS = 10_000;

const defaultDeps = (): Deps => ({
  toast: enqueueNotificationToast,
  requestPermission: () => requestBrowserNotificationPermission(),
  show: (title, options) => {
    const shown = new Notification(title, options);
    shown.onclick = () => window.focus();
  },
  locks: typeof navigator === "undefined" ? undefined : navigator.locks,
  state: () => ({ visible: document.visibilityState === "visible", focused: document.hasFocus() }),
});

export async function deliverNotification(
  n: AttentionNotification,
  deps: Deps = defaultDeps(),
): Promise<"toast" | "os" | "skipped"> {
  if (shouldToast(deps.state())) {
    deps.toast(n);
    return "toast";
  }
  if ((await deps.requestPermission()) !== "granted") return "skipped";
  const show = () => deps.show(n.title, { body: n.body, tag: n.id });
  if (!deps.locks) {
    show();
    return "os";
  }
  // One tab shows it; the tag collapses any duplicate that slips through.
  const locks = deps.locks;
  return new Promise((resolve) => {
    void locks.request(`rakazo-notification-${n.id}`, { ifAvailable: true }, async (lock) => {
      if (!lock) return resolve("skipped");
      show();
      resolve("os");
      await new Promise((release) => setTimeout(release, LOCK_HOLD_MS));
    });
  });
}
