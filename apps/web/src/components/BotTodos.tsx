import { Trans, useLingui } from "@lingui/react/macro";
import type { WaitingOnYouItem } from "@rakazo/contracts";
import { isWaitingOnSelf } from "@rakazo/contracts";
import { Button, Checkbox } from "@rakazo/ui-web";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../lib/rpc";
import { useCompleteTodo } from "../lib/use-complete-todo";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { ScratchpadItemMeta } from "../pages/ScratchpadSection";

/** Rows shown before "Show N more", so a long list does not push the page's own content below the fold. */
const VISIBLE = 3;

/**
 * Open to-dos the person's bots saved for them, or that are past due. `hideDueBetween` leaves out
 * items already drawn on a calendar grid.
 */
export function BotTodos({ hideDueBetween }: { hideDueBetween?: { from: Date; to: Date } }) {
  const { t } = useLingui();
  const headingId = useId();
  const [items, setItems] = useState<WaitingOnYouItem[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [all, setAll] = useState(false);
  const request = useRef(0);
  const { complete, pendingIds, error } = useCompleteTodo((itemId) => {
    // A read that started before this completion would put the row back.
    request.current += 1;
    setItems((all) => all.filter((entry) => entry.id !== itemId));
  });
  const hasLoaded = useRef(false);
  const refetch = useCallback(async () => {
    const current = ++request.current;
    try {
      const next = await rpc.scratchpad.waitingOnYou({});
      if (current !== request.current) return;
      hasLoaded.current = true;
      setItems(next);
      setLoadFailed(false);
    } catch {
      if (current === request.current && !hasLoaded.current) setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    void refetch();
    return () => {
      request.current += 1;
    };
  }, [refetch]);
  useRefetchWhileOpen(true, () => void refetch());

  const shown = items.filter((item) => {
    if (!hideDueBetween || !item.dueAt) return true;
    const due = new Date(item.dueAt);
    return due < hideDueBetween.from || due >= hideDueBetween.to;
  });
  if (shown.length === 0 && !loadFailed) return null;
  const rows = all ? shown : shown.slice(0, VISIBLE);
  const hidden = shown.length - rows.length;

  return (
    <section
      aria-labelledby={headingId}
      className="mb-3 rounded-xl border border-border px-3.5 py-1"
    >
      <h2 id={headingId} className="py-2 text-xs font-semibold text-muted-foreground">
        <Trans>Waiting on you</Trans>
      </h2>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loadFailed && shown.length === 0 ? (
        <div className="flex items-center gap-2 pb-2 text-sm">
          <span className="text-destructive">
            <Trans>Could not load</Trans>
          </span>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}
      <ul>
        {rows.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2.5 border-t border-border py-1.5 pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            <Checkbox
              aria-label={item.title}
              checked={false}
              disabled={pendingIds.has(item.id)}
              onCheckedChange={() => complete(item.id)}
              className="mt-0.5 pointer-coarse:mt-0 pointer-coarse:size-6"
            />
            <div className="min-w-0 flex-1">
              <Link to={`/app/${item.botId}`} dir="auto" className="rk-tap text-sm hover:underline">
                {item.title}
              </Link>
              <span className="ms-2 text-xs text-muted-foreground/80">{item.botName}</span>
              {/* The heading already says it waits on the person; only someone else is named. */}
              <ScratchpadItemMeta
                item={{
                  dueAt: item.dueAt,
                  waitingOn: isWaitingOnSelf(item.waitingOn) ? null : item.waitingOn,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-2.5 text-muted-foreground"
          onClick={() => setAll(true)}
        >
          {t`Show ${hidden} more`}
        </Button>
      ) : null}
    </section>
  );
}
