import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type { NotificationSignal } from "@rakazo/contracts";
import { followRealtimeTopic } from "./realtime-follow.js";

type Owner = { spaceId: string; userId: string };

/** One topic per user and space. Payloads carry ids only; clients fetch the notification. */
export const notificationTopic = ({ spaceId, userId }: Owner) =>
  `notifications:${spaceId}:${userId}`;

export interface NotificationEvents {
  /** Call after the notification's transaction committed. Failures never reach the caller. */
  notify(owner: Owner, signal: NotificationSignal): Promise<void>;
  follow(owner: Owner, signal?: AbortSignal): AsyncGenerator<NotificationSignal>;
}

export function createNotificationEvents(realtime?: RealtimeFanout): NotificationEvents {
  return {
    async notify(owner, signal) {
      await realtime?.publish(notificationTopic(owner), JSON.stringify(signal)).catch(() => {});
    },
    follow(owner, signal) {
      return followRealtimeTopic(
        realtime,
        notificationTopic(owner),
        (payload) => JSON.parse(payload) as NotificationSignal,
        signal,
      );
    },
  };
}
