import { runThreadSubscription } from "@rakazo/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../lib/rpc";
import type { PageDataUpdate, PageRemoteUpdate } from "./shell/bot-page-panel";
import { BotPagePanel } from "./shell/bot-page-panel";

/**
 * One bot page, full width, opened from the sidebar. The page header holds the title and the options menu.
 * No chat is open here, so this view keeps its own subscription to the bot's thread for the page events
 * that say the bot saved the page or refreshed its live data.
 */
function BotPageViewBody({ botId, pageId }: { botId: string; pageId: string }) {
  const navigate = useNavigate();
  const review = useCallback(() => navigate(`/app/${botId}`), [navigate, botId]);
  const missing = useCallback(() => navigate("/app", { replace: true }), [navigate]);

  const [remote, setRemote] = useState<PageRemoteUpdate | null>(null);
  const [dataRemote, setDataRemote] = useState<PageDataUpdate | null>(null);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const [headReady, setHeadReady] = useState(false);
  const snapshot = useRef<{ threadId: string; cursor: number } | null>(null);
  const announcedHead = useRef(false);
  const checkedStart = useRef(false);

  // The page and the thread's cursor load separately: a save that landed between them leaves no
  // event to replay, so once the head is known this view asks for the page and its live data once.
  const headArrived = () => {
    if (announcedHead.current) return;
    announcedHead.current = true;
    setHeadReady(true);
    // One synthetic data event makes the panel load the page's live data again.
    setDataRemote({ pageId, seq: -1 });
  };

  useEffect(() => {
    const abort = new AbortController();
    void runThreadSubscription({
      signal: abort.signal,
      loadInitial: async () => {
        const head = await rpc.threads.head({ botId });
        snapshot.current = head;
        if (head) headArrived();
        return head;
      },
      loadHead: async () => {
        const head = await rpc.threads.head({ botId });
        snapshot.current = head;
        if (head) headArrived();
        return head;
      },
      refresh: async () => {},
      currentSnapshot: () => snapshot.current,
      subscribe: (cursor) => rpc.threads.subscribe({ botId, cursor }, { signal: abort.signal }),
      applyEvent: (event) => {
        const head = snapshot.current;
        if (head) snapshot.current = { ...head, cursor: Math.max(head.cursor, event.seq) };
      },
      onEvent: (event) => {
        if (event.type === "page.updated") {
          const { pageId: changedId, revision, updatedBy } = event.payload as PageRemoteUpdate;
          setRemote({ pageId: changedId, revision, updatedBy, seq: event.seq });
        }
        if (event.type === "page.data") {
          const { pageId: changedId } = event.payload as { pageId?: string };
          setDataRemote({ pageId: changedId, seq: event.seq });
        }
      },
    });
    return () => abort.abort();
  }, [botId]);

  useEffect(() => {
    if (!headReady || loadedRevision === null || checkedStart.current) return;
    checkedStart.current = true;
    void rpc.pages
      .get({ botId, pageId })
      .then((page) => {
        if (page && page.revision > loadedRevision)
          setRemote({
            pageId: page.id,
            revision: page.revision,
            updatedBy: page.updatedBy,
            seq: 0,
          });
      })
      .catch(() => undefined);
  }, [headReady, loadedRevision, botId, pageId]);

  return (
    <div className="@container rk-scroll min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 md:px-7">
      <div className="mx-auto max-w-5xl">
        <BotPagePanel
          key={pageId}
          botId={botId}
          fixedPageId={pageId}
          remote={remote}
          dataRemote={dataRemote}
          onPageChange={(page) => setLoadedRevision(page?.revision ?? null)}
          onReview={review}
          onMissing={missing}
        />
      </div>
    </div>
  );
}

export function BotPageView(props: { botId: string; pageId: string }) {
  return <BotPageViewBody key={props.botId} {...props} />;
}
