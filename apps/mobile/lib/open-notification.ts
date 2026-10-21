import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { loadSessionToken, selectedSpaceId, selectSpace } from "./api";
import {
  notificationResponseRoute,
  notificationSpaceId,
  notificationSurface,
} from "./notification-open";
import { closeSettingsSheet } from "./settings-sheet";
import { markSurfaceSeen } from "./unseen-notifications";

const openedResponses = new Set<string>();

/** Expo's request identifier is the scheduled request. These pushes use the
 * thread id for that value, so a later delivery of the same thread shares it.
 * The payload delivery id is the occurrence. */
function occurrenceKey(response: Notifications.NotificationResponse): string | null {
  const identifier = response.notification.request.identifier;
  if (!identifier) return null;
  const data = response.notification.request.content.data;
  const deliveryId =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).deliveryId
      : undefined;
  const occurrence = typeof deliveryId === "string" ? deliveryId.trim() : "";
  return occurrence ? `${identifier}\0${occurrence}` : identifier;
}

function clearNotificationResponseIfCurrent(response: Notifications.NotificationResponse): void {
  const last = Notifications.getLastNotificationResponse();
  const key = occurrenceKey(response);
  if (last && key && key === occurrenceKey(last)) Notifications.clearLastNotificationResponse();
}

export async function openNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): Promise<boolean> {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return false;
  }
  const key = occurrenceKey(response);
  if (!key || openedResponses.has(key)) return false;
  const target = notificationResponseRoute(response, Notifications.DEFAULT_ACTION_IDENTIFIER);
  const surface = notificationSurface(response.notification.request.content.data);
  if (!target && !surface) return false;
  // Claim before the session read so a cold-start hook and the tap listener
  // cannot both open the same response.
  openedResponses.add(key);
  try {
    if (!(await loadSessionToken())) {
      // Expo keeps this tap as the last response. Leaving it there would open
      // the thread on a later cold start, after sign-in, with no new tap.
      // A newer delivery can become last while this session read is in flight.
      clearNotificationResponseIfCurrent(response);
      openedResponses.delete(key);
      return false;
    }
    closeSettingsSheet();
    // Threads switch space themselves. Pages open in the current space, so move to the
    // notification's space first; otherwise the wrong space's page opens and is cleared.
    const spaceId = notificationSpaceId(response.notification.request.content.data);
    const opensThread =
      target &&
      "pathname" in target &&
      (target.pathname === "/thread" || target.pathname === "/group-thread");
    if (spaceId && !opensThread) {
      if (spaceId !== selectedSpaceId() && !(await selectSpace(spaceId))) {
        openedResponses.delete(key);
        return false;
      }
    }
    if (target && "kind" in target) await Linking.openURL(target.url);
    else if (target) router.push(target);
    if (surface) void markSurfaceSeen(surface);
    clearNotificationResponseIfCurrent(response);
    return true;
  } catch {
    openedResponses.delete(key);
    return false;
  }
}

/** Opens the thread for a notification tap, including the tap that cold-started the app. */
export function useNotificationResponses(enabled: boolean): void {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openNotificationResponse(response);
    });
    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !lastResponse) return;
    void openNotificationResponse(lastResponse);
  }, [enabled, lastResponse]);
}
