import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BotPage, PageChart } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import type { NodeViewProps } from "@tiptap/react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isNewerRemote, resolveRemotePage } from "../../lib/page-sync";
import { rpc } from "../../lib/rpc";
import { ChartCanvas } from "./message-cards";
import { PageChartNode, usePageChartRows } from "./page-chart-extension";
import { PAGE_EXTENSIONS } from "./page-extensions";

const SAVE_DELAY_MS = 800;

function ChartView({ node, deleteNode, editor }: NodeViewProps) {
  const chart = node.attrs.chart as PageChart;
  const rows = usePageChartRows(chart);
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
  return (
    <NodeViewWrapper className="group relative my-3 rounded-lg border border-border p-3">
      <div ref={ref}>
        {width > 0 ? <ChartCanvas spec={chart.spec} data={rows} width={width} /> : null}
      </div>
      {editor.isEditable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Delete chart`}
          className="absolute end-1 top-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={deleteNode}
        >
          <X size={14} />
        </Button>
      ) : null}
    </NodeViewWrapper>
  );
}

const PageChartView = PageChartNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ChartView);
  },
});

export type PageRemoteUpdate = { revision: number; updatedBy: "bot" | "user"; seq: number };

export function BotPagePanel({
  botId,
  remote,
}: {
  botId: string;
  /** The latest `page.updated` event for this bot. */
  remote: PageRemoteUpdate | null;
}) {
  const revision = useRef(0);
  const seenRevision = useRef(0);
  const baseline = useRef("");
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef(false);
  const stale = useRef(false);
  const [loaded, setLoaded] = useState<BotPage | null>(null);
  const [offerReload, setOfferReload] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: PAGE_EXTENSIONS.map((extension) =>
      extension === PageChartNode ? PageChartView : extension,
    ),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t`Page`,
        dir: "auto",
        class:
          "min-h-40 text-sm outline-none [&_a]:text-link [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:ps-5 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:ps-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_img]:max-w-full",
      },
    },
  });

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
    },
    [editor],
  );

  // Fetches the page; replaces the editor only if nothing was typed while the request was out.
  const fetchPage = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const before = editor.getMarkdown();
    const page = await rpc.pages.get({ botId });
    if (!page || editor.isDestroyed) return;
    if (editor.getMarkdown() !== before) {
      stale.current = true;
      setOfferReload(true);
      return;
    }
    show(page);
  }, [editor, botId, show]);

  // Saves the newest content, and again if more was typed while a request was out. Uses refs only,
  // so it also finishes after the editor is gone.
  const persist = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current) return;
    saving.current = true;
    try {
      while (!stale.current && latest.current !== baseline.current) {
        const content = latest.current;
        const result = await rpc.pages.save({ botId, content, baseRevision: revision.current });
        revision.current = result.page.revision;
        seenRevision.current = Math.max(seenRevision.current, result.page.revision);
        if (result.ok) {
          baseline.current = content;
          setError("");
        } else {
          stale.current = true;
          setOfferReload(true);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t`Could not save the page.`);
    } finally {
      saving.current = false;
    }
    // Someone else saved a newer revision while our request was out.
    if (!stale.current && seenRevision.current > revision.current) {
      if (latest.current !== baseline.current) {
        stale.current = true;
        setOfferReload(true);
      } else void fetchPage();
    }
  }, [botId, fetchPage]);

  useEffect(() => {
    if (!editor) return;
    let live = true;
    void rpc.pages
      .get({ botId })
      .then((page) => {
        if (!live || !page) return;
        setLoaded(page);
        show(page);
      })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : String(cause)));
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
  }, [editor, botId, show, persist]);

  useEffect(() => {
    if (!remote || !editor) return;
    seenRevision.current = Math.max(seenRevision.current, remote.revision);
    // A save in flight decides what to do with newer revisions when it returns.
    if (saving.current) return;
    if (!isNewerRemote({ loadedRevision: revision.current, remoteRevision: remote.revision }))
      return;
    if (resolveRemotePage({ dirty: editor.getMarkdown() !== baseline.current }) === "offer") {
      stale.current = true;
      setOfferReload(true);
      return;
    }
    void fetchPage().catch(() => undefined);
  }, [remote, editor, fetchPage, loaded]);

  if (!loaded)
    return error ? (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    ) : null;
  return (
    <div>
      {offerReload ? (
        <Button
          variant="secondary"
          size="sm"
          className="mb-3"
          onClick={() => void rpc.pages.get({ botId }).then((page) => page && show(page))}
        >
          <Trans>Page changed. Reload</Trans>
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
