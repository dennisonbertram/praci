// @vitest-environment jsdom

import type { ThreadScrollState } from "@rakazo/core";
import { openThreadWindow } from "@rakazo/core";
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { MobileSnapshot } from "./api";
import type { PinnedAround } from "./thread-actions";
import { applyMessageJump, commitSnap } from "./thread-actions";
import { ThreadJumpAnchor } from "./thread-jump";
import { ThreadScrollBehavior } from "./thread-scroll";
import { reconcileVisibleThreadSnapshot } from "./thread-snapshot";

describe("mobile search jump", () => {
  it.each(["botId", "groupId"] as const)(
    "publishes jumps within an unchanged, already-loaded %s thread",
    async (targetKey) => {
      const latest: MobileSnapshot = {
        threadId: "thread-1",
        cursor: 2,
        olderCursor: null,
        run: null,
        messages: [1, 2].map((seq) => ({
          id: `message-${seq}`,
          threadId: "thread-1",
          seq,
          role: "user" as const,
          blocks: [{ kind: "text" as const, text: `Message ${seq}` }],
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
      };
      const page = {
        threadId: latest.threadId,
        olderCursor: latest.olderCursor,
        messages: structuredClone(latest.messages),
      };
      const opened = openThreadWindow(latest, page);
      expect(opened.newerCursor).toBeNull();
      expect(reconcileVisibleThreadSnapshot(latest, opened.snapshot)).toBe(latest);
      const rpc = vi.fn(async (method: string) =>
        method === "threads/get" ? structuredClone(latest) : page,
      );
      let jump!: (target: { botId?: string; groupId?: string; messageId: string }) => Promise<void>;
      let renderedSnapshot: MobileSnapshot | null = null;
      const anchor = new ThreadJumpAnchor();

      function Probe() {
        const [snap, setSnap] = useState<MobileSnapshot | null>(latest);
        const [, setThreadScrollState] = useState<ThreadScrollState>({
          detached: false,
          unread: false,
          newCount: 0,
        });
        const pinnedAroundRef = useRef<PinnedAround | null>(null);
        const jumpScrollTarget = useRef<string | null>(null);
        const snapRef = useRef<MobileSnapshot | null>(latest);
        const streamResponsesRef = useRef(false);
        const deps = {
          rpc: rpc as never,
          liveSavedChatsScope: async () => ({}) as never,
          isIntegrationsScopeCurrent: () => true,
          snapshotOrigin: useRef(null),
          setShowingSaved: vi.fn(),
          historyEpoch: useRef(0),
          jumpGeneration: useRef(0),
          activeGroupId: useRef(targetKey === "groupId" ? "target-1" : undefined),
          activeBotId: useRef(targetKey === "botId" ? "target-1" : undefined),
          expandedHistoryThread: useRef<string | null>(null),
          pinnedAroundRef,
          jumpAnchor: useRef(anchor),
          jumpScrollTarget,
          newerLoadFailed: useRef(false),
          joinPinnedAfterLayout: useRef<number | null>(null),
          pinnedScrollMetrics: useRef({ offset: 0, viewport: 0, content: 0 }),
          setThreadScrollState,
          scrollBehavior: useRef(new ThreadScrollBehavior()),
          commitSnap: (next: MobileSnapshot | null) =>
            commitSnap({ snapRef, streamResponsesRef, setSnap }, next),
        };
        jump = (target) => applyMessageJump(deps, target);
        renderedSnapshot = snap;
        return (
          <div
            data-list={pinnedAroundRef.current ? "pinned" : "live"}
            data-target={jumpScrollTarget.current}
          />
        );
      }

      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const container = document.createElement("div");
      const root = createRoot(container);
      try {
        act(() => root.render(<Probe />));
        expect(container.querySelector('[data-list="live"]')).not.toBeNull();
        for (const seq of [1, 2]) {
          await act(() => jump({ [targetKey]: "target-1", messageId: `message-${seq}` }));
          expect(renderedSnapshot).toBe(latest);
          expect(container.querySelector('[data-list="pinned"]')?.getAttribute("data-target")).toBe(
            `message-${seq}`,
          );
          expect(anchor.onMessageLayout(`message-${seq}`, 200, seq - 1, 24)).toBe(176);
        }
      } finally {
        act(() => root.unmount());
        vi.unstubAllGlobals();
      }
    },
  );
});
