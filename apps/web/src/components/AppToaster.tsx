import type { NotificationDto } from "@rakazo/contracts";
import { NotificationToaster } from "@rakazo/ui-web";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { i18n } from "../lib/i18n";
import { deliverNotification } from "../lib/notification-delivery";
import { followNotifications } from "../lib/notification-stream";
import { rpc } from "../lib/rpc";

/** The server already reports `shownAt`/`seenAt`; look the notification up again to see them. */
async function wasShown(n: NotificationDto): Promise<boolean> {
  const since = new Date(Date.parse(n.createdAt) - 1).toISOString();
  const { notifications } = await rpc.notifications.list({ since });
  const current = notifications.find((c) => c.id === n.id);
  return Boolean(current?.shownAt || current?.seenAt);
}

/** Mounted once at the app root; the single path from server notifications to toasts and OS alerts. */
export function AppToaster() {
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    void followNotifications(
      {
        subscribe: (signal) => rpc.notifications.subscribe(undefined, { signal }),
        list: (since) => rpc.notifications.list({ since }),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        deliver: (n) =>
          void deliverNotification(
            {
              id: n.id,
              title: n.title,
              body: n.body ?? undefined,
              href: n.link ?? undefined,
              onSeen: () =>
                void rpc.notifications.markSeen({ surface: n.surface }).catch(() => undefined),
            },
            {
              onShown: async (id) => {
                await rpc.notifications.markShown({ id });
              },
              wasShown: () => wasShown(n),
            },
          ),
      },
      controller.signal,
    );
    return () => controller.abort();
  }, []);
  return (
    <NotificationToaster
      onOpen={navigate}
      dismissLabel={i18n._({ id: "Dismiss", message: "Dismiss" })}
    />
  );
}
