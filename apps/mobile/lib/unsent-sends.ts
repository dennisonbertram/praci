import { router } from "expo-router";
import { AccessibilityInfo, Alert, AppState } from "react-native";
import {
  captureApiRequestContext,
  currentApiBase,
  isServerReachable,
  rpc,
  selectedSpaceId,
  subscribeServerReachable,
} from "./api";
import { artifactCacheSession } from "./artifact-cache-session";
import { t } from "./i18n";
import { integrationsCacheScope } from "./integrations-cache";
import type { NotificationRoute } from "./notification-open";
import { outboxDisk } from "./outbox-disk";
import {
  currentSessionGeneration,
  loadSessionToken,
  loadVerifiedIntegrationsScope,
} from "./session";
import { closeSettingsSheet } from "./settings-sheet";
import type { OutboxScope, SendAttempt } from "./thread-feedback";
import {
  configureUnsentSends,
  isSendAttemptInScope,
  isThreadMounted,
  restoreUnsentSends,
  sendWaitingMessages,
} from "./thread-feedback";
import { errorText } from "./user-error";

let activeScope: (OutboxScope & { generation: number }) | null = null;
function scope() {
  return activeScope &&
    activeScope.generation === currentSessionGeneration() &&
    activeScope.apiBase === currentApiBase()
    ? activeScope
    : null;
}
export function unsentSendRoute(attempt: SendAttempt): NotificationRoute | null {
  const space = attempt.spaceId ? { spaceId: attempt.spaceId } : {};
  const botId = attempt.payload.initialBotTarget;
  if (botId) {
    return {
      pathname: "/thread",
      params: { botId, ...space },
    };
  }
  const groupId = attempt.payload.originThreadKey;
  return groupId ? { pathname: "/group-thread", params: { groupId, ...space } } : null;
}
export async function prepareUnsentSends(): Promise<void> {
  const generation = currentSessionGeneration();
  const apiBase = currentApiBase();
  const spaceId = selectedSpaceId();
  if (!scope() || activeScope?.spaceId !== spaceId) {
    const saved = await loadVerifiedIntegrationsScope();
    const verified =
      saved?.apiBase === apiBase && (spaceId || saved.selectionId === null)
        ? saved
        : await integrationsCacheScope();
    const cacheSession = await artifactCacheSession(await loadSessionToken());
    if (
      generation !== currentSessionGeneration() ||
      apiBase !== currentApiBase() ||
      spaceId !== selectedSpaceId()
    )
      throw new Error(t("Failed to send message"));
    activeScope = {
      apiBase,
      spaceId: spaceId ?? verified.spaceId,
      userId: verified.userId,
      cacheSession,
      generation,
    };
  }
  restoreUnsentSends();
}
// Configure the wipe before bootstrap can replace credentials or the saved server.
configureUnsentSends({
  request: async <T>(
    proc: string,
    body: unknown,
    options: Parameters<typeof rpc>[2],
    spaceId: string | null,
  ) => {
    const generation = currentSessionGeneration();
    const context = await captureApiRequestContext();
    if (generation !== currentSessionGeneration()) throw new Error("Session changed");
    const headers = { ...context.headers };
    if (spaceId) headers["x-rakazo-space-id"] = spaceId;
    else delete headers["x-rakazo-space-id"];
    return rpc<T>(proc, body, { ...options, requestContext: { ...context, headers } });
  },
  serverReachable: isServerReachable,
  scope,
  disk: outboxDisk,
  errorText: (error) => errorText(error, t("Failed to send message")),
  notDelivered: (attempt) => {
    const route = unsentSendRoute(attempt);
    const buttons = [
      { text: t("Not now"), style: "cancel" as const },
      ...(route
        ? [
            {
              text: t("Open conversation"),
              onPress: () => {
                if (!isSendAttemptInScope(attempt)) return;
                closeSettingsSheet();
                if (attempt.spaceId && attempt.spaceId !== selectedSpaceId()) {
                  router.dismissTo("/");
                  router.push(route);
                } else if (isThreadMounted(attempt.payload.originThreadKey)) {
                  router.dismissTo(route);
                } else router.push(route);
              },
            },
          ]
        : []),
    ];
    Alert.alert(t("Failed to send message"), attempt.error, buttons);
  },
  announceFailure: () => AccessibilityInfo.announceForAccessibility(t("Failed to send message")),
});
export function startUnsentSends(): () => void {
  let stopped = false;
  const retry = (force = false) =>
    void prepareUnsentSends()
      .then(() => {
        if (!stopped) return sendWaitingMessages(force);
      })
      .catch(() => undefined);
  retry();
  const reachable = subscribeServerReachable(() => {
    if (isServerReachable()) retry();
  });
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") retry(true);
  });
  return () => {
    stopped = true;
    reachable();
    appState.remove();
  };
}
