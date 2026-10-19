import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type { BoardEvent } from "@rakazo/contracts";
import { followRealtimeTopic } from "./realtime-follow.js";

/** A transient "this board changed" signal. Clients refetch the list on any frame. */
export interface BoardEvents {
  notify(spaceId: string, change?: { boardId?: string; ticketId?: string }): Promise<void>;
  follow(spaceId: string, signal?: AbortSignal): AsyncGenerator<BoardEvent>;
}

export function boardEventTopic(spaceId: string): string {
  return `board:${spaceId}`;
}

/**
 * Build the board notifier and the subscription stream. Without a realtime
 * fanout the notifier does nothing and the stream stays open and empty.
 */
export function createBoardEvents(realtime?: RealtimeFanout): BoardEvents {
  return {
    async notify(spaceId, change) {
      const payload: BoardEvent = {
        spaceId,
        ...(change?.boardId ? { boardId: change.boardId } : {}),
        ...(change?.ticketId ? { ticketId: change.ticketId } : {}),
        createdAt: new Date().toISOString(),
      };
      await realtime
        ?.publish(boardEventTopic(spaceId), JSON.stringify(payload))
        .catch(() => undefined);
    },
    follow(spaceId, signal) {
      return followRealtimeTopic(
        realtime,
        boardEventTopic(spaceId),
        (payload): BoardEvent => {
          let change: { boardId?: string; ticketId?: string } = {};
          try {
            change = JSON.parse(payload) as typeof change;
          } catch {
            change = {};
          }
          return {
            spaceId,
            ...(change.boardId ? { boardId: change.boardId } : {}),
            ...(change.ticketId ? { ticketId: change.ticketId } : {}),
            createdAt: new Date().toISOString(),
          };
        },
        signal,
      );
    },
  };
}
