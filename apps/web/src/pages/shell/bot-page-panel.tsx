import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  BotPage,
  BotPageSummary,
  GtmPageBlock,
  PageChart,
  PageData,
  PageLiveBlock,
  PageMetricBlock as PageMetricBlockSpec,
  PageTableBlock as PageTableBlockSpec,
} from "@rakazo/contracts";
import { BOT_PAGE_MAX_PAGES, BOT_PAGE_TITLE_MAX } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import type { NodeViewProps } from "@tiptap/react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArtifactShareDialog } from "../../components/ArtifactShareDialog";
import { GtmBlock, GtmBlockContext } from "../../components/gtm/GtmBlock";
import { PageHeader } from "../../components/PageHeader";
import { HtmlPageView } from "../../components/pages/HtmlPageView";
import {
  PageChartFrame,
  PageMetricBlock,
  PageTableBlock,
} from "../../components/pages/PageLiveBlocks";
import { PageSourcesDialog } from "../../components/pages/PageSourcesDialog";
import { isNewerRemote, resolveRemotePage } from "../../lib/page-sync";
import { rpc } from "../../lib/rpc";
import { SIDEBAR_PAGES_CHANGED_EVENT } from "../../lib/sidebar-pages-event";
import { errorText } from "../../lib/user-error";
import { ChartCanvas } from "./message-cards";
import { PageChartNode, usePageChartRows } from "./page-chart-extension";
import { PAGE_EXTENSIONS } from "./page-extensions";
import { PageGtmNode } from "./page-gtm-extension";
import { chartKey, liveKey, mapLiveBlocks, PageLiveContext, usePageLive } from "./page-live";
import { PageMetricNode, PageTableNode } from "./page-live-extensions";

const SAVE_DELAY_MS = 800;

/** Deletes the block, then focuses the editor so Ctrl+Z / Cmd+Z restores it. */
const deleteAndFocus = ({ deleteNode, editor }: Pick<NodeViewProps, "deleteNode" | "editor">) => {
  deleteNode();
  editor.view.focus();
};

function LiveDelete({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t`Delete block`}
      className="absolute end-1 bottom-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
      onClick={onClick}
    >
      <X size={14} />
    </Button>
  );
}

function ChartView({ node, deleteNode, editor }: NodeViewProps) {
  const chart = node.attrs.chart as PageChart;
  const rows = usePageChartRows(chart);
  const live = usePageLive();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const canvas = (
    <div ref={ref}>
      {width > 0 ? <ChartCanvas spec={chart.spec} data={rows} width={width} /> : null}
    </div>
  );
  return (
    <NodeViewWrapper className="group relative my-3 rounded-lg border border-border p-3">
      {chart.source ? (
        <PageChartFrame data={live.blocks.get(chartKey(chart))}>{canvas}</PageChartFrame>
      ) : (
        canvas
      )}
      {editor.isEditable ? (
        chart.source ? (
          <LiveDelete onClick={() => deleteAndFocus({ deleteNode, editor })} />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Delete chart`}
            className="absolute end-1 top-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
            onClick={() => deleteAndFocus({ deleteNode, editor })}
          >
            <X size={14} />
          </Button>
        )
      ) : null}
    </NodeViewWrapper>
  );
}

const PageChartView = PageChartNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ChartView);
  },
});

function MetricView({ node, deleteNode, editor }: NodeViewProps) {
  const block = node.attrs.block as PageMetricBlockSpec;
  const live = usePageLive();
  return (
    <NodeViewWrapper className="group relative my-3 min-w-0" contentEditable={false}>
      <PageMetricBlock block={block} data={live.blocks.get(liveKey("pageMetric", block))} />
      {editor.isEditable ? (
        <LiveDelete onClick={() => deleteAndFocus({ deleteNode, editor })} />
      ) : null}
    </NodeViewWrapper>
  );
}

function TableView({ node, deleteNode, editor }: NodeViewProps) {
  const block = node.attrs.block as PageTableBlockSpec;
  const live = usePageLive();
  return (
    <NodeViewWrapper className="group relative my-3 min-w-0" contentEditable={false}>
      <PageTableBlock block={block} data={live.blocks.get(liveKey("pageTable", block))} />
      {editor.isEditable ? (
        <LiveDelete onClick={() => deleteAndFocus({ deleteNode, editor })} />
      ) : null}
    </NodeViewWrapper>
  );
}

const PageMetricView = PageMetricNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MetricView);
  },
});

const PageTableView = PageTableNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TableView);
  },
});

function GtmView({ node, deleteNode, editor, getPos }: NodeViewProps) {
  const data = useContext(GtmBlockContext);
  const move = (direction: -1 | 1) => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const { doc, tr } = editor.state;
    const neighbor = direction < 0 ? doc.resolve(pos).nodeBefore : doc.nodeAt(pos + node.nodeSize);
    if (!neighbor) return;
    const target = direction < 0 ? pos - neighbor.nodeSize : pos + neighbor.nodeSize;
    editor.view.dispatch(
      tr
        .delete(pos, pos + node.nodeSize)
        .insert(target, node)
        .scrollIntoView(),
    );
  };
  return (
    <NodeViewWrapper
      className="group relative my-3 min-w-0"
      contentEditable={false}
      data-gtm-block={node.attrs.block?.type}
    >
      {editor.isEditable ? (
        <div className="mb-1 flex justify-end gap-1 text-muted-foreground">
          <span data-drag-handle className="flex cursor-grab items-center px-1" aria-hidden="true">
            <GripVertical size={14} />
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t`Move up`} onClick={() => move(-1)}>
            <ArrowUp size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t`Move down`} onClick={() => move(1)}>
            <ArrowDown size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t`Delete block`} onClick={deleteNode}>
            <X size={14} />
          </Button>
        </div>
      ) : null}
      {data ? (
        <GtmBlock
          block={node.attrs.block as GtmPageBlock}
          overview={data.overview}
          onChange={data.onChange}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

const PageGtmView = PageGtmNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(GtmView);
  },
});

/** `pageId` is missing on events from before a bot could have several pages. */
export type PageRemoteUpdate = {
  pageId?: string;
  revision: number;
  updatedBy: "bot" | "user";
  seq: number;
};

/** `pageId` is missing on events that name no page. */
export type PageDataUpdate = { pageId?: string; seq: number };

/** Edits one page. Remount it (key) to switch pages: each page keeps its own editor state. */
function PageEditor({
  botId,
  pageId,
  remote,
  dataTick = 0,
  refreshTick = 0,
  onSources,
  onPageChange,
  onReview,
}: {
  botId: string;
  /** Opens where a pending source is approved; set only on the full-width page. */
  onReview?: () => void;
  /** Without one, the bot's first page. */
  pageId?: string;
  remote: PageRemoteUpdate | null;
  /** Changes when the page's live data should be fetched again. */
  dataTick?: number;
  /** Changes when the user asked to rerun the page's sources. */
  refreshTick?: number;
  /** Whether the page has data sources, for the options menu. */
  onSources?: (has: boolean) => void;
  onPageChange?: (page: BotPage | null) => void;
}) {
  const reportPage = useRef(onPageChange);
  reportPage.current = onPageChange;
  const reportSources = useRef(onSources);
  reportSources.current = onSources;
  const revision = useRef(0);
  const seenRevision = useRef(0);
  const baseline = useRef("");
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef(false);
  const stale = useRef(false);
  const dataRequest = useRef(0);
  const pageRequest = useRef(0);
  const refreshSequence = useRef(0);
  const refreshInFlight = useRef(false);
  const [loaded, setLoaded] = useState<BotPage | null>();
  const [offerReload, setOfferReload] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingState, setSavingState] = useState(false);
  const [liveBlocks, setLiveBlocks] = useState<ReadonlyMap<string, PageLiveBlock>>(new Map());
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: PAGE_EXTENSIONS.map((extension) =>
      extension === PageChartNode
        ? PageChartView
        : extension === PageGtmNode
          ? PageGtmView
          : extension === PageMetricNode
            ? PageMetricView
            : extension === PageTableNode
              ? PageTableView
              : extension,
    ),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t`Page`,
        dir: "auto",
        class:
          "min-h-40 text-sm outline-none [&_a]:text-link [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:ps-5 [&_table]:w-full [&_table:not([data-slot=table])_td]:border [&_table:not([data-slot=table])_td]:border-border [&_table:not([data-slot=table])_td]:p-1 [&_table:not([data-slot=table])_th]:border [&_table:not([data-slot=table])_th]:border-border [&_table:not([data-slot=table])_th]:p-1 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:ps-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_img]:max-w-full",
      },
    },
  });

  // Live data follows the saved revision: blocks pair with the saved document in order, so data
  // for another revision waits until that revision is shown or saved. Until then the last data
  // stays, matched to blocks by what they show.
  const applyData = useCallback(
    (data: PageData | null) => {
      setLiveLoaded(true);
      if (
        !data ||
        !("blocks" in data) ||
        !editor ||
        editor.isDestroyed ||
        data.revision !== revision.current
      )
        return;
      const doc = editor.markdown?.parse(baseline.current);
      if (doc) setLiveBlocks(mapLiveBlocks(doc, data.blocks));
    },
    [editor],
  );

  const loadData = useCallback(async () => {
    const request = ++dataRequest.current;
    const refreshAtStart = refreshSequence.current;
    try {
      const [data, sources] = await Promise.all([
        rpc.pages.data({ botId, pageId }),
        rpc.pages.sources({ botId, pageId }),
      ]);
      if (request !== dataRequest.current || refreshAtStart !== refreshSequence.current) return;
      applyData(data);
      reportSources.current?.(sources.length > 0);
    } catch {
      // Blocks keep their last data; a live block never blocks the page.
      if (request === dataRequest.current && refreshAtStart === refreshSequence.current)
        setLiveLoaded(true);
    }
  }, [botId, pageId, applyData]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    refreshSequence.current++;
    setRefreshing(true);
    try {
      const data = await rpc.pages.refresh({ botId, pageId });
      applyData(data);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [botId, pageId, applyData]);

  const show = useCallback(
    (page: BotPage) => {
      if (!editor) return;
      editor.commands.setContent(page.content, { contentType: "markdown", emitUpdate: false });
      baseline.current = editor.getMarkdown();
      latest.current = baseline.current;
      revision.current = page.revision;
      seenRevision.current = Math.max(seenRevision.current, page.revision);
      stale.current = false;
      setOfferReload(false);
      setError("");
      setSaveError("");
      setLoaded(page);
      reportPage.current?.(page);
      void loadData();
    },
    [editor, loadData],
  );

  // Fetches the page; replaces the editor only if nothing was typed while the request was out.
  const fetchPage = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const request = ++pageRequest.current;
    const before = editor.getMarkdown();
    let page: BotPage | null;
    try {
      page = await rpc.pages.get({ botId, pageId });
    } catch (cause) {
      if (request !== pageRequest.current || editor.isDestroyed) return;
      if ((cause as { code?: string } | null)?.code === "NOT_FOUND") {
        setLoaded(null);
        setError(errorText(cause, t`Could not load the page.`));
        reportPage.current?.(null);
      }
      throw cause;
    }
    if (request !== pageRequest.current) return;
    if (editor.isDestroyed) return;
    if (!page) {
      setLoaded(null);
      reportPage.current?.(null);
      return;
    }
    if (editor.getMarkdown() !== before) {
      stale.current = true;
      setOfferReload(true);
      return;
    }
    show(page);
  }, [editor, botId, pageId, show]);

  // Saves the newest content, and again if more was typed while a request was out. Uses refs only,
  // so it also finishes after the editor is gone.
  const persist = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current) return;
    if (latest.current === baseline.current) {
      setSaveError("");
      return;
    }
    saving.current = true;
    setSavingState(true);
    try {
      while (!stale.current && latest.current !== baseline.current) {
        const content = latest.current;
        const result = await rpc.pages.save({
          botId,
          pageId,
          content,
          baseRevision: revision.current,
        });
        revision.current = result.page.revision;
        seenRevision.current = Math.max(seenRevision.current, result.page.revision);
        if (result.ok) {
          baseline.current = content;
          setError("");
          setSaveError("");
          reportPage.current?.(result.page);
          void loadData();
        } else {
          stale.current = true;
          setOfferReload(true);
        }
      }
    } catch (cause) {
      setSaveError(errorText(cause, t`Could not save the page.`));
    } finally {
      saving.current = false;
      setSavingState(false);
    }
    // Someone else saved a newer revision while our request was out.
    if (!stale.current && seenRevision.current > revision.current) {
      if (latest.current !== baseline.current) {
        stale.current = true;
        setOfferReload(true);
      } else void fetchPage();
    }
  }, [botId, pageId, fetchPage, loadData]);

  useEffect(() => {
    if (!editor) return;
    let live = true;
    void rpc.pages
      .get({ botId, pageId })
      .then((page) => {
        if (!live) return;
        if (page) show(page);
        else {
          setLoaded(null);
          reportPage.current?.(null);
        }
      })
      .catch((cause) => live && setError(errorText(cause)));
    const onUpdate = () => {
      latest.current = editor.getMarkdown();
      clearTimeout(timer.current);
      if (latest.current !== baseline.current && !stale.current) {
        timer.current = setTimeout(() => void persist(), SAVE_DELAY_MS);
      }
    };
    editor.on("update", onUpdate);
    return () => {
      live = false;
      editor.off("update", onUpdate);
      void persist();
    };
  }, [editor, botId, pageId, show, persist]);

  useEffect(() => {
    if (!remote || !editor || loaded === undefined) return;
    seenRevision.current = Math.max(seenRevision.current, remote.revision);
    // A save in flight decides what to do with newer revisions when it returns.
    if (saving.current) return;
    if (
      loaded !== null &&
      !isNewerRemote({ loadedRevision: revision.current, remoteRevision: remote.revision })
    )
      return;
    if (resolveRemotePage({ dirty: editor.getMarkdown() !== baseline.current }) === "offer") {
      stale.current = true;
      setOfferReload(true);
      return;
    }
    void fetchPage().catch(() => undefined);
  }, [remote, editor, fetchPage, loaded]);

  // Reload drops the draft for the page as it is saved now.
  const reload = useCallback(async () => {
    setConflictBusy(true);
    try {
      const page = await rpc.pages.get({ botId, pageId });
      if (page) show(page);
      else {
        setError("");
        setLoaded(null);
        reportPage.current?.(null);
      }
    } catch (cause) {
      setError(errorText(cause, t`Could not load the page.`));
    } finally {
      setConflictBusy(false);
    }
  }, [botId, pageId, show]);

  // Keep mine saves the draft on top of the revision that was just read, so the conflict ends.
  const keepMine = useCallback(async () => {
    setConflictBusy(true);
    try {
      const page = await rpc.pages.get({ botId, pageId });
      if (!page) {
        setError(t`Could not load the page.`);
        return;
      }
      revision.current = page.revision;
      seenRevision.current = Math.max(seenRevision.current, page.revision);
      stale.current = false;
      setOfferReload(false);
      latest.current = editor && !editor.isDestroyed ? editor.getMarkdown() : latest.current;
      // What is saved now is the server's text, not the text this tab opened with: a draft that
      // undid back to the old page still differs from it, so it is written.
      baseline.current = page.content;
      void persist();
    } catch (cause) {
      setError(errorText(cause, t`Could not load the page.`));
    } finally {
      setConflictBusy(false);
    }
  }, [botId, pageId, editor, persist]);

  // A tick that was already set when this editor mounted is old news: show() fetches on load.
  const handledTicks = useRef({ data: dataTick, refresh: refreshTick });
  useEffect(() => {
    if (handledTicks.current.data === dataTick) return;
    handledTicks.current.data = dataTick;
    void loadData();
  }, [dataTick, loadData]);
  useEffect(() => {
    if (handledTicks.current.refresh === refreshTick) return;
    handledTicks.current.refresh = refreshTick;
    void refresh();
  }, [refreshTick, refresh]);

  const liveContext = useMemo(
    () => ({
      loaded: liveLoaded,
      refreshing,
      blocks: liveBlocks,
      refresh: () => void refresh(),
      onReview,
    }),
    [liveLoaded, refreshing, liveBlocks, refresh, onReview],
  );

  if (!loaded)
    return error ? (
      <div>
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button variant="secondary" size="sm" disabled={conflictBusy} onClick={() => void reload()}>
          <Trans>Retry</Trans>
        </Button>
      </div>
    ) : null;
  return (
    <div>
      {offerReload ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            <Trans>Page changed.</Trans>
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={conflictBusy}
            onClick={() => void reload()}
          >
            <Trans>Reload</Trans>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={conflictBusy}
            onClick={() => void keepMine()}
          >
            <Trans>Keep mine</Trans>
          </Button>
        </div>
      ) : null}
      {error ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        </div>
      ) : null}
      {saveError ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
          {!offerReload ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={savingState}
              onClick={() => void persist()}
            >
              <Trans>Retry</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
      <PageLiveContext.Provider value={liveContext}>
        <EditorContent editor={editor} />
      </PageLiveContext.Provider>
    </div>
  );
}

function nextTitle(pages: BotPageSummary[]): string {
  const taken = new Set(pages.map((page) => page.title.toLowerCase()));
  let title = t`New page`;
  for (let n = 2; taken.has(title.toLowerCase()); n++) title = t`New page ${n}`;
  return title;
}

/** The bot's page: a row of page titles when there are several, and the active page's editor. */
const announcePagesChanged = () =>
  window.dispatchEvent(new CustomEvent(SIDEBAR_PAGES_CHANGED_EVENT));

export function BotPagePanel({
  botId,
  remote,
  dataRemote = null,
  onPageChange,
  fixedPageId,
  onTitle,
  onMissing,
  onReview,
}: {
  /** Opens where a pending source is approved; used by the full-width page only. */
  onReview?: () => void;
  botId: string;
  /** Shows only this page: no switcher, no new or delete. Used by the full-width page. */
  fixedPageId?: string;
  /** The open page's title, so a full-width page can use it as its heading. */
  onTitle?: (title: string) => void;
  /** The fixed page is gone (deleted, or not this bot's). */
  onMissing?: () => void;
  /** The latest `page.updated` event for this bot. */
  remote: PageRemoteUpdate | null;
  /** The latest `page.data` event for this bot. */
  dataRemote?: PageDataUpdate | null;
  onPageChange?: (page: BotPage | null) => void;
}) {
  const [pages, setPages] = useState<BotPageSummary[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(fixedPageId);
  const [renaming, setRenaming] = useState(false);
  // Escape cancels the name; Enter and blur both commit, so only one of them renames.
  const renameCancelled = useRef(false);
  const renameCommitting = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hasSources, setHasSources] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [shared, setShared] = useState<{ url: string | null; artifactId: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [dataTick, setDataTick] = useState(0);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  const loadPages = useCallback(async () => {
    const list = await rpc.pages.list({ botId });
    setPages(list);
    if (fixedPageId) {
      if (!list.some((page) => page.id === fixedPageId)) {
        announcePagesChanged();
        onMissingRef.current?.();
      }
      return;
    }
    // Keep the open page; otherwise open the first.
    setActiveId((current) => (list.some((page) => page.id === current) ? current : list[0]?.id));
  }, [botId, fixedPageId]);

  useEffect(() => {
    let live = true;
    void loadPages().catch((cause) => live && setError(errorText(cause)));
    return () => {
      live = false;
    };
  }, [loadPages]);

  // A page this list does not know yet (the bot added one) reloads the list.
  const remoteId = remote?.pageId;
  const remoteSeq = remote?.seq;
  useEffect(() => {
    if (remoteSeq === undefined || !remoteId) return;
    if (!pages.some((page) => page.id === remoteId)) void loadPages().catch(() => undefined);
  }, [remoteSeq, remoteId, pages, loadPages]);

  // A page.data event for the open page (or one naming no page) reloads its live data.
  const dataSeq = dataRemote?.seq;
  const dataPageId = dataRemote?.pageId;
  useEffect(() => {
    if (dataSeq === undefined) return;
    if (!dataPageId || dataPageId === activeIdRef.current) setDataTick((n) => n + 1);
  }, [dataSeq, dataPageId]);

  const reportPage = (page: BotPage | null) => {
    if (page && !pages.some((entry) => entry.id === page.id))
      void loadPages().catch(() => undefined);
    onPageChange?.(page);
  };

  const active = pages.find((page) => page.id === activeId);
  const activeTitle = active?.title ?? "";
  useEffect(() => {
    if (activeTitle) onTitle?.(activeTitle);
  }, [activeTitle, onTitle]);
  // Only an event for the open page (or an old event without a page id) reloads it.
  const editorRemote = remote && (!remote.pageId || remote.pageId === activeId) ? remote : null;

  const run = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  const create = () =>
    run(async () => {
      const page = await rpc.pages.create({ botId, title: nextTitle(pages) });
      await loadPages();
      announcePagesChanged();
      setActiveId(page.id);
      startRename();
    });

  const startRename = () => {
    renameCancelled.current = false;
    renameCommitting.current = false;
    setRenaming(true);
  };

  const rename = (title: string) =>
    run(async () => {
      if (active && title.trim() && title.trim() !== active.title) {
        const renamed = await rpc.pages.rename({ botId, pageId: active.id, title });
        setPages((list) => list.map((page) => (page.id === renamed.id ? renamed : page)));
        announcePagesChanged();
      }
      setRenaming(false);
    }).finally(() => {
      renameCommitting.current = false;
    });

  const commitRename = (title: string) => {
    if (renameCommitting.current) return;
    renameCommitting.current = true;
    void rename(title);
  };

  const share = () =>
    run(async () => {
      if (!active) return;
      const status = await rpc.pages.shareStatus({ botId, pageId: active.id });
      if (status) setShared({ url: null, artifactId: status.artifactId });
      else await makeShareLink(active.id);
    });

  const makeShareLink = async (pageId: string) => {
    const result = await rpc.pages.share({ botId, pageId });
    if (result) setShared({ url: result.url, artifactId: result.artifactId });
  };

  const replaceShare = async () => {
    if (!active) return;
    setShareBusy(true);
    await run(() => makeShareLink(active.id));
    setShareBusy(false);
  };

  const stopSharing = async () => {
    if (!shared) return;
    setShareBusy(true);
    await run(async () => {
      await rpc.artifactShares.revoke({ artifactId: shared.artifactId });
      setShared(null);
    });
    setShareBusy(false);
  };

  const remove = () =>
    run(async () => {
      if (active) await rpc.pages.remove({ botId, pageId: active.id });
      setDeleting(false);
      setActiveId(undefined);
      await loadPages();
      announcePagesChanged();
    });

  const renameForm =
    renaming && active ? (
      <form
        className="min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          commitRename(String(new FormData(event.currentTarget).get("title") ?? ""));
        }}
      >
        <Input
          name="title"
          autoFocus
          aria-label={t`Page title`}
          defaultValue={active.title}
          maxLength={BOT_PAGE_TITLE_MAX}
          // Typing replaces the title, so "New page" never ends up as a prefix.
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            renameCancelled.current = true;
            setRenaming(false);
          }}
          // Leaving the field keeps the typed name, so a name never needs Enter.
          onBlur={(event) => {
            if (!renameCancelled.current) commitRename(event.currentTarget.value);
          }}
        />
      </form>
    ) : null;

  const optionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={t`Page options`}>
            <MoreHorizontal size={16} />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {hasSources ? (
          <DropdownMenuItem onClick={() => setRefreshTick((n) => n + 1)}>
            <Trans>Refresh</Trans>
          </DropdownMenuItem>
        ) : null}
        {hasSources ? (
          <DropdownMenuItem onClick={() => setSourcesOpen(true)}>
            <Trans>Sources</Trans>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => void share()}>
          <Trans>Share</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={startRename}>
          <Trans>Rename</Trans>
        </DropdownMenuItem>
        {pages.length > 1 && !fixedPageId ? (
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div>
      {fixedPageId ? (
        <PageHeader
          title={renameForm ?? activeTitle}
          actions={pages.length > 0 ? optionsMenu : null}
        />
      ) : pages.length > 0 ? (
        <div className="mb-3 flex items-center gap-1">
          {renameForm ?? (
            <div className="min-w-0 flex-1">
              {pages.length > 1 ? (
                <Tabs value={activeId} onValueChange={(next) => setActiveId(String(next))}>
                  <TabsList
                    aria-label={t`Pages`}
                    className="justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {pages.map((page) => (
                      <TabsTrigger key={page.id} value={page.id} className="flex-none px-3">
                        {page.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : null}
            </div>
          )}
          {optionsMenu}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={t`New page`}
            disabled={pages.length >= BOT_PAGE_MAX_PAGES}
            onClick={() => void create()}
          >
            <Plus size={16} />
          </Button>
        </div>
      ) : null}
      {error && pages.length > 0 ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {active?.kind === "html" ? (
        <HtmlPageView
          key={active.id}
          botId={botId}
          pageId={active.id}
          title={active.title}
          changeTick={editorRemote?.seq ?? 0}
          dataTick={dataTick}
          refreshTick={refreshTick}
          onSources={setHasSources}
        />
      ) : pages.length === 0 || activeId ? (
        <PageEditor
          key={activeId ?? "first"}
          botId={botId}
          pageId={activeId}
          remote={editorRemote}
          dataTick={dataTick}
          refreshTick={refreshTick}
          onSources={setHasSources}
          onPageChange={reportPage}
          onReview={fixedPageId ? onReview : undefined}
        />
      ) : null}
      {pages.length === 0 && error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <PageSourcesDialog
        botId={botId}
        pageId={activeId}
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        onChanged={() => setDataTick((n) => n + 1)}
      />
      {shared ? (
        <ArtifactShareDialog
          name={activeTitle}
          url={shared.url}
          busy={shareBusy}
          error={error || null}
          onReplace={() => void replaceShare()}
          onStop={() => void stopSharing()}
          onClose={() => setShared(null)}
        />
      ) : null}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              <Trans>Delete {activeTitle}?</Trans>
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
