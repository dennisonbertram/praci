import type { ThreadScrollState } from "@rakazo/core";
import { leaveThreadWindow, openThreadWindow, withLiveStreamingProgress } from "@rakazo/core";
import type { MobileMessagePage, MobileSnapshot } from "./api";
import type { SavedChatsScope } from "./saved-chats";
import type { ThreadJumpAnchor } from "./thread-jump";
import type { ThreadScrollBehavior } from "./thread-scroll";
import { reconcileVisibleThreadSnapshot } from "./thread-snapshot";

type Ref<T> = { current: T };

export type PinnedAround = {
  botId?: string;
  groupId?: string;
  messageId: string;
  threadId: string;
  newerCursor: number | null;
  coveredThroughSeq?: number;
  probeSeq?: number;
};

/** Publish a snapshot to the screen, keeping the ref and the visible copy in step. */
export function commitSnap(
  deps: {
    snapRef: Ref<MobileSnapshot | null>;
    streamResponsesRef: Ref<boolean>;
    setSnap: (update: (previous: MobileSnapshot | null) => MobileSnapshot | null) => void;
  },
  next: MobileSnapshot | null,
) {
  deps.snapRef.current = next;
  const visible = withLiveStreamingProgress(next, deps.streamResponsesRef.current);
  deps.setSnap((previous) => reconcileVisibleThreadSnapshot(previous, visible));
}

/** Leave a pinned search/jump window and return the list to the live thread. */
export function showLatest(deps: {
  pinnedAroundRef: Ref<Pick<PinnedAround, "newerCursor"> | null>;
  joinPinnedAfterLayout: Ref<number | null>;
  jumpScrollTarget: Ref<string | null>;
  jumpAnchor: Ref<ThreadJumpAnchor>;
  expandedHistoryThread: Ref<string | null>;
  scrollBehavior: Ref<ThreadScrollBehavior>;
  setThreadScrollState: (state: ThreadScrollState) => void;
  snapRef: Ref<MobileSnapshot | null>;
  commitSnap: (next: MobileSnapshot | null) => void;
}) {
  const pinned = deps.pinnedAroundRef.current;
  deps.pinnedAroundRef.current = null;
  deps.joinPinnedAfterLayout.current = null;
  deps.jumpScrollTarget.current = null;
  deps.jumpAnchor.current.release();
  deps.expandedHistoryThread.current = null;
  // The live list mounts at the latest message.
  deps.scrollBehavior.current.jumpToLatest();
  // Clearing the pinned refs must render even when the snapshot and scroll flags are unchanged.
  deps.setThreadScrollState(deps.scrollBehavior.current.state());
  deps.commitSnap(
    deps.snapRef.current && pinned
      ? leaveThreadWindow(deps.snapRef.current, pinned.newerCursor)
      : deps.snapRef.current,
  );
}

/** Open the thread around a searched message and pin the list to it. */
export async function applyMessageJump(
  deps: {
    rpc: <T>(method: string, input: unknown) => Promise<T>;
    liveSavedChatsScope: () => Promise<SavedChatsScope | null>;
    isIntegrationsScopeCurrent: (scope: SavedChatsScope) => boolean;
    snapshotOrigin: Ref<SavedChatsScope | null>;
    setShowingSaved: (showing: boolean) => void;
    historyEpoch: Ref<number>;
    jumpGeneration: Ref<number>;
    activeGroupId: Ref<string | undefined>;
    activeBotId: Ref<string | undefined>;
    expandedHistoryThread: Ref<string | null>;
    pinnedAroundRef: Ref<PinnedAround | null>;
    jumpAnchor: Ref<ThreadJumpAnchor>;
    jumpScrollTarget: Ref<string | null>;
    newerLoadFailed: Ref<boolean>;
    joinPinnedAfterLayout: Ref<number | null>;
    pinnedScrollMetrics: Ref<{ offset: number; viewport: number; content: number }>;
    scrollBehavior: Ref<ThreadScrollBehavior>;
    setThreadScrollState: (state: ThreadScrollState) => void;
    commitSnap: (next: MobileSnapshot | null) => void;
  },
  target: { botId?: string; groupId?: string; messageId: string },
) {
  const threadTarget = target.groupId ? { groupId: target.groupId } : { botId: target.botId! };
  const epoch = deps.historyEpoch.current;
  deps.jumpGeneration.current += 1;
  const jumpId = deps.jumpGeneration.current;
  const scope = await deps.liveSavedChatsScope();
  if (!scope || !deps.isIntegrationsScopeCurrent(scope)) return;
  const [snap, page] = await Promise.all([
    deps.rpc<MobileSnapshot>("threads/get", threadTarget),
    deps.rpc<MobileMessagePage>("threads/messages", {
      ...threadTarget,
      around: { messageId: target.messageId },
    }),
  ]);
  // The epoch check drops a jump that raced a conversation clear (or a bot switch); the
  // generation check drops an older same-thread jump that finished after a newer one.
  if (
    epoch !== deps.historyEpoch.current ||
    jumpId !== deps.jumpGeneration.current ||
    !deps.isIntegrationsScopeCurrent(scope)
  )
    return;
  if (target.groupId && deps.activeGroupId.current !== target.groupId) return;
  if (target.botId && deps.activeBotId.current !== target.botId) return;
  const targetInPage = page.messages.some((message) => message.id === target.messageId);
  const opened = targetInPage ? openThreadWindow(snap, page) : null;
  deps.expandedHistoryThread.current = targetInPage ? page.threadId : null;
  deps.pinnedAroundRef.current = opened
    ? {
        ...threadTarget,
        messageId: target.messageId,
        threadId: page.threadId,
        newerCursor: opened.newerCursor,
      }
    : null;
  deps.jumpAnchor.current.begin(targetInPage ? target.messageId : null);
  deps.jumpScrollTarget.current = targetInPage ? target.messageId : null;
  deps.newerLoadFailed.current = false;
  deps.joinPinnedAfterLayout.current = null;
  deps.pinnedScrollMetrics.current = { offset: 0, viewport: 0, content: 0 };
  // Publish the jump refs even when the opened snapshot is already visible.
  deps.setThreadScrollState(deps.scrollBehavior.current.state());
  deps.snapshotOrigin.current = scope;
  deps.commitSnap(opened?.snapshot ?? snap);
  deps.setShowingSaved(false);
}
