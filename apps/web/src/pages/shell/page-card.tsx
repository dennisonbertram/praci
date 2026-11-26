import { Trans } from "@lingui/react/macro";
import type { SidebarPagesState } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { SIDEBAR_PAGES_CHANGED_EVENT } from "../../lib/sidebar-pages-event";
import { listSidebarPages } from "../../lib/sidebar-pages-list";
import { errorText } from "../../lib/user-error";

/**
 * The card an agent leaves in the chat when it creates a page. It opens the page and lets the
 * owner add it to, or remove it from, the sidebar. The sidebar list also says whether the page
 * still exists and what it is called now.
 */
export function PageCard({
  botId,
  pageId,
  title,
}: {
  botId: string;
  pageId: string;
  title: string;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<SidebarPagesState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      void listSidebarPages()
        .then((next) => active && setState(next))
        .catch(() => undefined);
    load();
    window.addEventListener(SIDEBAR_PAGES_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(SIDEBAR_PAGES_CHANGED_EVENT, load);
    };
  }, []);

  const added = state?.pages.find((page) => "pageId" in page && page.pageId === pageId);
  const addable = state?.botPages.flatMap((group) => group.pages).find((p) => p.id === pageId);
  const gone = state !== null && !added && !addable;
  const current = (added && "title" in added ? added.title : addable?.title) ?? title;

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await (added
        ? rpc.sidebarPages.remove({ pageId })
        : rpc.sidebarPages.add({ pageId }));
      setState(next);
      window.dispatchEvent(new Event(SIDEBAR_PAGES_CHANGED_EVENT));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-card"
      className="w-[340px] max-w-full rounded-[18px] border border-border bg-muted px-[18px] py-4"
    >
      {gone ? (
        <>
          <div className="text-[15px] font-medium text-muted-foreground" dir="auto">
            {title}
          </div>
          <div className="mt-1 text-[13.5px] text-muted-foreground">
            <Trans>This page is no longer available.</Trans>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => navigate(`/app/pages/${botId}/${pageId}`)}
            className="block w-full text-start text-[15px] font-medium text-foreground hover:underline"
            dir="auto"
          >
            {current}
          </button>
          {state ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggle()}
              className="mt-2 block text-start text-[13.5px] text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {added ? <Trans>Remove from sidebar</Trans> : <Trans>Add to sidebar</Trans>}
            </button>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
