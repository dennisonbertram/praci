import type { NotificationDto } from "@rakazo/contracts";
import { NotificationToaster } from "@rakazo/ui-web";
import { useEffect, useRef } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { lookupBotApp } from "../lib/agent-app";
import { hasApprovalToasts } from "../lib/approval-toasts";
import { authClient } from "../lib/auth";
import { openChatBotId } from "../lib/docked-agent";
import { i18n } from "../lib/i18n";
import {
  approvalInOpenChat,
  attentionFromDto,
  deliverNotification,
  NOTIFICATION_SETTINGS_CHANGED,
  openNotificationLink,
  resultShownInOpenChat,
  syncApprovalToasts,
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

/** X on an approval toast: it stays closed, also after a reload, until the person asks again. */
const dismissApproval = (n: NotificationDto) => () =>
  void rpc.notifications.dismiss({ id: n.id }).catch(() => undefined);

const APPROVAL_POLL_MS = 2000;

/** Lets the toasts follow the approvals still waiting for an answer, however long ago they were sent. */
async function followUnansweredApprovals(
  openBotId: () => string | undefined,
  openPath: () => string,
) {
  const { notifications } = await rpc.notifications.pendingApprovals();
  syncApprovalToasts(notifications, {
    complete: true,
    onSeen: (n) => () => void markOpened(n),
    onDismiss: dismissApproval,
    // A bot chat or a group chat that is open already shows its own approval card.
    skip: (n) => approvalInOpenChat(n, openBotId(), openPath()),
  });
}

/** The sending bot's avatar; a failed lookup just means a toast without one. */
async function avatarFor(n: NotificationDto, userId: string | undefined) {
  if (!n.botId || !userId) return undefined;
  try {
    const found = await lookupBotApp(userId, n.botId);
    if (!found) return undefined;
    const { bot, app } = found;
    return <AgentAvatar app={app} color={bot.color} identity={bot.id} size={32} />;
  } catch {
    return undefined;
  }
}

/** Mounted once at the app root; the single path from server notifications to toasts and OS alerts. */
export function AppToaster() {
  const navigate = useNavigate();
  // The effect below runs once; the ref keeps its link opener on the router's current navigate.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const openLink = useRef(openNotificationLink((href) => navigateRef.current(href))).current;
  const userId = authClient.useSession().data?.user.id;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const openBotId = useMatch("/app/:botId")?.params.botId;
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
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
          // The open chat already shows its own failure or reply.
          resultShownInOpenChat(
            n,
            openChatBotId(openBotIdRef.current),
            document.visibilityState === "visible" && document.hasFocus(),
          )
            ? "skipped"
            : deliverNotification(
                {
                  ...attentionFromDto(n),
                  avatar: await avatarFor(n, userIdRef.current),
                  onSeen: () => void markOpened(n),
                  onDismiss: dismissApproval(n),
                },
                {
                  open: openLink,
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
    // A reload loses the in-memory toasts and an answer in another tab never reaches this one, so
    // the toasts are rebuilt from the server on load, on every change, and every 2 s while shown.
    const syncApprovals = () => {
      if (document.visibilityState !== "visible") return;
      void followUnansweredApprovals(
        () => openChatBotId(openBotIdRef.current),
        () => pathRef.current,
      ).catch(() => undefined);
    };
    syncApprovals();
    window.addEventListener("rakazo:notifications-changed", syncApprovals);
    const poll = setInterval(() => {
      if (hasApprovalToasts()) syncApprovals();
    }, APPROVAL_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("rakazo:notifications-changed", syncApprovals);
      window.removeEventListener(NOTIFICATION_SETTINGS_CHANGED, reload);
    };
  }, []);
  // Leaving a chat with an approval still waiting raises its toast again; the 2 s poll stopped once
  // the open chat hid the last toast, so nothing else would.
  const previousChat = useRef(pathname);
  useEffect(() => {
    if (previousChat.current !== pathname && /^\/app\/(g\/)?[^/]+$/.test(previousChat.current)) {
      announceChange();
    }
    previousChat.current = pathname;
  }, [pathname]);
  return (
    <NotificationToaster
      onOpen={openLink}
      formatTime={formatRelativeTime}
      dismissLabel={i18n._({ id: "Dismiss", message: "Dismiss" })}
    />
  );
}
