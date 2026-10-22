import { useEffect, useState } from "react";
import { NOTIFICATION_SETTINGS_CHANGED } from "./notification-delivery";
import { rpc } from "./rpc";

/** True once the account is known to deliver nowhere: browser off or blocked, and no phone or iMessage on. */
export function useNotificationsOff(enabled: boolean) {
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      rpc.notifications
        .preferences()
        .then((prefs) => {
          const { channels } = prefs;
          const browser =
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            channels.browser !== false;
          const phone = prefs.hasPhone && channels.push !== false;
          const imessage = prefs.hasImessage && channels.imessage !== false;
          if (live) setOff(!(browser || phone || imessage));
        })
        .catch(() => {});
    void load();
    window.addEventListener(NOTIFICATION_SETTINGS_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(NOTIFICATION_SETTINGS_CHANGED, load);
    };
  }, [enabled]);
  return off;
}
