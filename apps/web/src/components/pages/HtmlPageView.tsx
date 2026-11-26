import { Trans } from "@lingui/react/macro";
import type { BotPage, PageData } from "@rakazo/contracts";
import { htmlPageSourcesFor } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { SandboxedHtmlViewer } from "../SandboxedHtmlViewer";

/**
 * An HTML page, shown read-only in the same sandbox as other bot HTML. The page script receives its
 * sources as "praci-data" message events: after it loads, and again whenever its data changes.
 * `changeTick` and `refreshTick` count page.updated/page.data events and "Refresh" clicks.
 */
export function HtmlPageView({
  botId,
  pageId,
  title,
  changeTick,
  dataTick,
  refreshTick,
  onSources,
}: {
  botId: string;
  pageId: string;
  title: string;
  changeTick: number;
  dataTick: number;
  refreshTick: number;
  onSources?: (hasSources: boolean) => void;
}) {
  const [page, setPage] = useState<BotPage | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [pageLoadFailed, setPageLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const reportSources = useRef(onSources);
  reportSources.current = onSources;
  const handledRefresh = useRef(refreshTick);

  useEffect(() => {
    let live = true;
    void (async () => {
      let nextPage: BotPage | null;
      try {
        nextPage = await rpc.pages.get({ botId, pageId });
      } catch (cause) {
        if (live && (cause as { code?: string } | null)?.code === "NOT_FOUND") {
          setPage(null);
          setPageLoadFailed(true);
        } else if (live && !page) setPageLoadFailed(true);
        return;
      }
      if (!live) return;
      setPageLoadFailed(false);
      // A missing page keeps what it last showed; the panel list handles deletion.
      if (!nextPage) return;
      setPage(nextPage);

      const dataRequest =
        handledRefresh.current === refreshTick
          ? rpc.pages.data({ botId, pageId })
          : rpc.pages.refresh({ botId, pageId });
      const [nextData, sources] = await Promise.allSettled([
        dataRequest,
        rpc.pages.sources({ botId, pageId }),
      ]);
      // A failed refresh stays pending, so the next update asks for it again.
      if (nextData.status === "fulfilled") handledRefresh.current = refreshTick;
      if (!live) return;
      if (nextData.status === "fulfilled") setData(nextData.value);
      if (sources.status === "fulfilled") reportSources.current?.(sources.value.length > 0);
    })();
    return () => {
      live = false;
    };
  }, [botId, pageId, changeTick, dataTick, refreshTick, retryTick]);

  if (!page) {
    return pageLoadFailed ? (
      <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
        <span>
          <Trans>Could not load the page.</Trans>
        </span>
        <Button size="sm" variant="secondary" onClick={() => setRetryTick((tick) => tick + 1)}>
          <Trans>Retry</Trans>
        </Button>
      </div>
    ) : null;
  }
  // Data for another revision of this page never reaches the frame.
  const sources = htmlPageSourcesFor(page, data);
  return (
    <div className="h-[70vh] min-h-96 overflow-hidden rounded-lg border border-border">
      <SandboxedHtmlViewer html={page.content} title={title} data={sources} />
    </div>
  );
}
