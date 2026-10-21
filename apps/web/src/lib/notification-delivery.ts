import type { NotificationDto } from "@rakazo/contracts";
import type { NotificationToastInput } from "@rakazo/ui-web";
import { enqueueNotificationToast } from "@rakazo/ui-web";
import { requestBrowserNotificationPermission } from "./browser-notifications";
import { maskCurrencyWhenHidden } from "./hide-amounts-preference";

/** Dispatched on `window` after the channel switches change, so the app root reloads them. */
export const NOTIFICATION_SETTINGS_CHANGED = "rakazo:notification-settings-changed";

/** The toast and OS text for a stored notification; amounts stay hidden while Hide money is on. */
export function attentionFromDto(n: NotificationDto): AttentionNotification {
  return {
    id: n.id,
    title: maskCurrencyWhenHidden(n.title),
    body: n.body ? maskCurrencyWhenHidden(n.body) : undefined,
    href: n.link ?? undefined,
    createdAt: n.createdAt,
  };
}

/**
 * A run result for the chat on screen: the composer error or the reply already shows it, so no
 * toast repeats it. A finished run only counts while the tab is in front; otherwise the person is
 * away and still wants the alert.
 */
export function resultShownInOpenChat(
  n: Pick<NotificationDto, "botId" | "kind">,
  openBotId: string | undefined,
  tabInFront: boolean,
): boolean {
  if (!openBotId || n.botId !== openBotId) return false;
  return n.kind === "failed" || (n.kind === "done" && tabInFront);
}

/** An `attention` notification; `info` only puts a dot on the sidebar and never reaches here. */
export type AttentionNotification = NotificationToastInput;

/** Present (visible tab with focus) -> in-app toast; otherwise -> OS notification. */
export function shouldToast(state: { visible: boolean; focused: boolean }): boolean {
  return state.visible && state.focused;
}

export type DeliveryResult = "toast" | "os" | "skipped" | "failed";

export type DeliveryDeps = {
  toast: (n: AttentionNotification) => void;
  requestPermission: () => Promise<NotificationPermission> | undefined;
  show: (title: string, options: NotificationOptions) => void;
  state: () => { visible: boolean; focused: boolean };
  delay: (ms: number) => Promise<unknown>;
  /** Server check: was this notification already shown or seen on another device or tab? */
  wasShown?: (id: string) => Promise<boolean> | boolean;
  /** Called after a toast is shown, so the caller can tell the server (skips phone push). Failures are reported, not treated as delivery failures. */
  onShown?: (id: string) => Promise<void> | void;
  /** The user's Browser switch; false skips the OS notification. Toasts are unaffected. */
  browserEnabled?: () => Promise<boolean> | boolean;
  reportError?: (error: unknown) => void;
};

/** Background tabs wait this long so a focused tab can toast first. */
export const AWAY_DELAY_MS = 1500;

const defaultDeps = (): DeliveryDeps => ({
  toast: enqueueNotificationToast,
  requestPermission: () => requestBrowserNotificationPermission(),
  show: (title, options) => {
    const shown = new Notification(title, options);
    shown.onclick = () => window.focus();
  },
  state: () => ({ visible: document.visibilityState === "visible", focused: document.hasFocus() }),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  reportError: (error) => console.error(error),
});

/**
 * Only the focused tab toasts (at most one tab can be), so toasts need no coordination.
 * Other tabs wait, then re-check focus, ask the server whether it was already shown, and
 * show an OS notification tagged with the id; the browser collapses same-tag notifications.
 */
export async function deliverNotification(
  n: AttentionNotification,
  overrides: Partial<DeliveryDeps> = {},
): Promise<DeliveryResult> {
  try {
    const deps = { ...defaultDeps(), ...overrides };
    // The toast is on screen, so the result is "toast" even if onShown fails; that is reported.
    const toast = async (): Promise<DeliveryResult> => {
      deps.toast(n);
      try {
        await deps.onShown?.(n.id);
      } catch (error) {
        deps.reportError?.(error);
      }
      return "toast";
    };
    if (shouldToast(deps.state())) return toast();
    await deps.delay(AWAY_DELAY_MS);
    if (await deps.wasShown?.(n.id)) return "skipped";
    if (shouldToast(deps.state())) return toast();
    if ((await deps.browserEnabled?.()) === false) return "skipped";
    if ((await deps.requestPermission()) !== "granted") return "skipped";
    deps.show(n.title, { body: n.body, tag: n.id });
    return "os";
  } catch {
    return "failed";
  }
}
