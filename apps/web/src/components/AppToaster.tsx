import type { NotificationDto } from "@rakazo/contracts";
import { BotAvatar, NotificationToaster } from "@rakazo/ui-web";
import { useEffect, useRef } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { lookupAgentApp } from "../lib/agent-app";
import { authClient } from "../lib/auth";
import { i18n } from "../lib/i18n";
import {
  attentionFromDto,
  deliverNotification,
  failureShownInOpenChat,
  NOTIFICATION_SETTINGS_CHANGED,
} from "../lib/notification-delivery";
import { followNotifications } from "../lib/notification-stream";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { AgentAvatar } from "./integrations/AgentAvatar";

const announceChange = () => window.dispatchEvent(new CustomEvent("rakazo:notifications-changed"));

/** The server already reports `shownAt`/`seenAt`; look the notification up again to see them. */
async function wasShown(n: NotificationDto): Promise<boolean> {
  const since = new Date(Date.parse(n.createdAt) - 1).toISOString();
  const { notifications } = await rpc.notifications.list({ since });
  const current = notifications.find((c) => c.id === n.id);
  return Boolean(current?.shownAt || current?.seenAt);
}

/** Opening a toast clears only that thread's (or that one) notification, not the whole surface. */
const markOpened = (n: NotificationDto) =>
  rpc.notifications
    .markSeen(
      n.threadId ? { surface: n.surface, threadId: n.threadId } : { surface: n.surface, id: n.id },
    )
    .then(announceChange, () => undefined);

/** The sending bot's avatar; a failed lookup just means a toast without one. */
async function avatarFor(n: NotificationDto, userId: string | undefined) {
  if (!n.botId || !userId) return undefined;
  try {
    const bot = (await rpc.bots.list()).find((b) => b.id === n.botId);
    if (!bot) return undefined;
    const app = await lookupAgentApp(userId, bot);
    return <AgentAvatar app={app} color={bot.color} identity={bot.id} size={32} />;
  } catch {
    return undefined;
  }
}

/** Mounted once at the app root; the single path from server notifications to toasts and OS alerts. */
export function AppToaster() {
  const navigate = useNavigate();
  const userId = authClient.useSession().data?.user.id;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const openBotId = useMatch("/app/:botId")?.params.botId;
  const openBotIdRef = useRef(openBotId);
  openBotIdRef.current = openBotId;
  useEffect(() => {
    const controller = new AbortController();
    // The browser switch, loaded once and reloaded when the settings change.
    let browserOn: Promise<boolean> | undefined;
    const loadBrowserOn = () =>
      rpc.notifications.preferences().then(
        (prefs) => prefs.channels.browser !== false,
        () => true,
      );
    const reload = () => {
      browserOn = undefined;
    };
    window.addEventListener(NOTIFICATION_SETTINGS_CHANGED, reload);
    void followNotifications(
      {
        subscribe: (signal) => rpc.notifications.subscribe(undefined, { signal }),
        list: (args) => rpc.notifications.list(args),
        changed: announceChange,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        deliver: async (n) =>
          // The open chat already shows its own failure above the composer.
          failureShownInOpenChat(n, openBotIdRef.current)
            ? "skipped"
            : deliverNotification(
                {
                  ...attentionFromDto(n),
                  avatar: await avatarFor(n, userIdRef.current),
                  onSeen: () => void markOpened(n),
                },
                {
                  onShown: async (id) => {
                    await rpc.notifications.markShown({ id });
                    announceChange();
                  },
                  wasShown: () => wasShown(n),
                  browserEnabled: () => {
                    browserOn ??= loadBrowserOn();
                    return browserOn;
                  },
                },
              ),
      },
      controller.signal,
    );
    return () => {
      controller.abort();
      window.removeEventListener(NOTIFICATION_SETTINGS_CHANGED, reload);
    };
  }, []);
  return (
    <NotificationToaster
      onOpen={navigate}
      formatTime={formatRelativeTime}
      dismissLabel={i18n._({ id: "Dismiss", message: "Dismiss" })}
    />
  );
}
