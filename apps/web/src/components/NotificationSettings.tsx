import { Trans, useLingui } from "@lingui/react/macro";
import type { NotificationPreferences } from "@rakazo/contracts";
import { Switch } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import type { BrowserNotificationPermission } from "../lib/browser-notifications";
import { requestBrowserNotificationPermission } from "../lib/browser-notifications";
import { NOTIFICATION_SETTINGS_CHANGED } from "../lib/notification-delivery";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const currentPermission = (): BrowserNotificationPermission | undefined =>
  typeof Notification === "undefined" ? undefined : Notification.permission;

/** One switch per channel the user can receive on. Phone and iMessage show only once a phone is registered or an iMessage number is linked. */
export function NotificationSettingsSection() {
  const { t } = useLingui();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState(currentPermission);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    rpc.notifications
      .preferences()
      .then((next) => live && setPrefs(next))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!prefs) return null;
  const save = async (channels: NotificationPreferences["channels"]) => {
    setPending(true);
    setError("");
    try {
      setPrefs(await rpc.notifications.updatePreferences({ channels }));
      window.dispatchEvent(new CustomEvent(NOTIFICATION_SETTINGS_CHANGED));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };
  const setBrowser = async (on: boolean) => {
    if (!on) return save({ browser: false });
    const granted = await requestBrowserNotificationPermission();
    setPermission(currentPermission());
    if (granted === "granted") await save({ browser: true });
  };
  const browserBlocked = permission === undefined || permission === "denied";

  return (
    <section className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Notifications</Trans>
      </h3>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        <li className="flex items-center gap-3">
          <Switch
            aria-label={t`Browser`}
            checked={permission === "granted" && prefs.channels.browser !== false}
            disabled={pending || browserBlocked}
            onCheckedChange={(on) => void setBrowser(on)}
          />
          <span className="text-[14px] text-foreground/75">
            <Trans>Browser</Trans>
          </span>
          {browserBlocked ? (
            <span className="text-[13px] text-muted-foreground">
              <Trans>Blocked</Trans>
            </span>
          ) : null}
        </li>
        {prefs.hasPhone ? (
          <li className="flex items-center gap-3">
            <Switch
              aria-label={t`Phone`}
              checked={prefs.channels.push !== false}
              disabled={pending}
              onCheckedChange={(on) => void save({ push: on })}
            />
            <span className="text-[14px] text-foreground/75">
              <Trans>Phone</Trans>
            </span>
          </li>
        ) : null}
        {prefs.hasImessage ? (
          <li className="flex items-center gap-3">
            <Switch
              aria-label={t`iMessage`}
              checked={prefs.channels.imessage !== false}
              disabled={pending}
              onCheckedChange={(on) => void save({ imessage: on })}
            />
            <span className="text-[14px] text-foreground/75">
              <Trans>iMessage</Trans>
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
