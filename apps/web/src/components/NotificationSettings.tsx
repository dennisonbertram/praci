import { Trans, useLingui } from "@lingui/react/macro";
import type { NotificationPreferences } from "@rakazo/contracts";
import { Label, Switch } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
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
  const id = useId();

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
  const channels = prefs?.channels ?? {};

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-xl border border-border px-4 py-4"
    >
      <h3 id={`${id}-heading`} className="mb-3 text-[15px] font-medium text-foreground">
        <Trans>Notifications</Trans>
      </h3>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        <li>
          <div className="flex items-center gap-3 pointer-coarse:min-h-11">
            <Switch
              id={`${id}-browser`}
              aria-label={t`Browser notifications`}
              checked={!!prefs && permission === "granted" && channels.browser !== false}
              disabled={!prefs || pending || browserBlocked}
              onCheckedChange={(on) => void setBrowser(on)}
            />
            <Label
              htmlFor={`${id}-browser`}
              className="text-[14px] font-normal text-foreground/75 pointer-coarse:flex-1 pointer-coarse:self-stretch"
            >
              <Trans>Browser notifications</Trans>
            </Label>
          </div>
          {prefs && browserBlocked ? (
            <span className="mt-1 block ps-11 text-[13px] text-muted-foreground">
              {permission === undefined ? (
                <Trans>Not supported here</Trans>
              ) : (
                <Trans>Blocked. Allow notifications for this site in your browser settings.</Trans>
              )}
            </span>
          ) : null}
        </li>
        {prefs?.hasPhone ? (
          <li className="flex items-center gap-3 pointer-coarse:min-h-11">
            <Switch
              id={`${id}-phone`}
              aria-label={t`Phone`}
              checked={channels.push !== false}
              disabled={pending}
              onCheckedChange={(on) => void save({ push: on })}
            />
            <Label
              htmlFor={`${id}-phone`}
              className="text-[14px] font-normal text-foreground/75 pointer-coarse:self-stretch pointer-coarse:flex-1"
            >
              <Trans>Phone</Trans>
            </Label>
          </li>
        ) : null}
        {prefs?.hasImessage ? (
          <li className="flex items-center gap-3 pointer-coarse:min-h-11">
            <Switch
              id={`${id}-imessage`}
              aria-label={t`iMessage`}
              checked={channels.imessage !== false}
              disabled={pending}
              onCheckedChange={(on) => void save({ imessage: on })}
            />
            <Label
              htmlFor={`${id}-imessage`}
              className="text-[14px] font-normal text-foreground/75 pointer-coarse:self-stretch pointer-coarse:flex-1"
            >
              <Trans>iMessage</Trans>
            </Label>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
