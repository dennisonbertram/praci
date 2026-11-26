import { Trans, useLingui } from "@lingui/react/macro";
import type { ScratchpadItem } from "@rakazo/contracts";
import { Button, Checkbox, enqueueNotificationToast, Input } from "@rakazo/ui-web";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { rpc } from "../lib/rpc";
import { holdRemove, useHeldRemovals } from "../lib/scratchpad-removals";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";

/** "Waiting on Acme legal · due Fri"; a past-due date shows in the destructive colour. */
export function ScratchpadItemMeta({
  item,
  now = new Date(),
}: {
  item: Pick<ScratchpadItem, "waitingOn" | "dueAt">;
  now?: Date;
}) {
  const { t, i18n } = useLingui();
  if (!item.waitingOn && !item.dueAt) return null;
  const due = item.dueAt ? new Date(item.dueAt) : null;
  const days = due ? Math.abs(due.getTime() - now.getTime()) / 86_400_000 : 0;
  const dueText = due
    ? due.toLocaleDateString(
        i18n.locale || "en",
        days < 6 ? { weekday: "short" } : { month: "short", day: "numeric" },
      )
    : null;
  const waitingOn = item.waitingOn;
  const pastDue = due !== null && due.getTime() < now.getTime();
  return (
    <div className="mt-0.5 text-[12.5px] text-muted-foreground/80" dir="auto">
      {item.waitingOn ? t`Waiting on ${waitingOn}` : null}
      {item.waitingOn && dueText ? " · " : null}
      {dueText ? (
        <span className={pastDue ? "text-destructive" : undefined}>{t`due ${dueText}`}</span>
      ) : null}
    </div>
  );
}

export function ScratchpadSection({
  botId,
  refreshKey = 0,
  focusItemId,
  focusItemNonce = 0,
  onFocusHandled,
}: {
  botId: string;
  /** Changes when a run ends, so items the bot added in chat show up without a reload. */
  refreshKey?: number;
  /** An open-work row to bring into view, from an Activity row or the sidebar. */
  focusItemId?: string;
  /** Changes on every request, so choosing the same item again scrolls again. */
  focusItemNonce?: number;
  /** Called once the chosen row has been brought into view, so the request is not replayed. */
  onFocusHandled?: () => void;
}) {
  const { t } = useLingui();
  const [items, setItems] = useState<ScratchpadItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const everLoaded = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listGeneration = useRef(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const handledFocus = useRef<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  const { hiddenIds, restoredId, clearRestored } = useHeldRemovals(() => {
    void refresh().catch(() => undefined);
  });

  async function refresh(): Promise<boolean> {
    const generation = ++listGeneration.current;
    let list: ScratchpadItem[];
    try {
      list = await rpc.scratchpad.list({ botId, includeDone: true });
    } catch (cause) {
      if (generation !== listGeneration.current) return false;
      throw cause;
    }
    if (generation !== listGeneration.current) return false;
    everLoaded.current = true;
    setItems(list);
    setLoadFailed(false);
    return true;
  }

  async function load() {
    try {
      await refresh();
    } catch {
      if (!everLoaded.current) setLoadFailed(true);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      listGeneration.current += 1;
    };
  }, [botId]);

  // A background failure keeps what is shown, but never hides that nothing has loaded yet.
  useRefetchWhileOpen(
    true,
    () =>
      void refresh().catch(() => {
        if (!everLoaded.current) setLoadFailed(true);
      }),
  );

  // Bring a chosen row into view once the list has it, then fade its highlight.
  // An Undo brings the row back where it was; it stands out the same way a focused row does.
  useEffect(() => {
    if (!restoredId) return;
    if (!items.some((entry) => entry.id === restoredId)) return;
    setHighlightId(restoredId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2_000);
    clearRestored();
  }, [restoredId, items, clearRestored]);

  useEffect(() => {
    if (!focusItemId || hiddenIds.has(focusItemId)) return;
    if (!items.some((entry) => entry.id === focusItemId)) return;
    const key = `${focusItemId}:${focusItemNonce}`;
    if (handledFocus.current === key) return;
    handledFocus.current = key;
    const row = sectionRef.current?.querySelector<HTMLElement>(
      `[data-scratchpad-item="${focusItemId}"]`,
    );
    row?.scrollIntoView?.({ block: "center" });
    if (!row) return;
    setHighlightId(focusItemId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2_000);
    onFocusHandled?.();
  }, [focusItemId, focusItemNonce, items, hiddenIds, onFocusHandled]);

  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    void refresh().catch(() => undefined);
  }, [refreshKey]);

  async function addItem() {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await rpc.scratchpad.create({ botId, title });
      setDraft("");
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      try {
        await refresh();
      } catch {
        setError(t`Saved, but list refresh failed`);
      }
    } catch {
      setError(t`Could not add`);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(item: ScratchpadItem, status: ScratchpadItem["status"]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await rpc.scratchpad.update({ itemId: item.id, status });
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (status === "done") {
        const title = item.title;
        enqueueNotificationToast({
          id: `scratchpad-${item.id}-${Date.now()}`,
          title: t`Completed ${title}`,
          action: {
            label: t`Undo`,
            onClick: () => {
              void rpc.scratchpad
                .update({ itemId: item.id, status: item.status })
                .then(() => refresh())
                .catch((cause) => {
                  setError(errorText(cause, t`Could not update`));
                  void refresh().catch(() => undefined);
                });
            },
          },
        });
      }
      try {
        await refresh();
      } catch {
        setError(t`Saved, but list refresh failed`);
      }
    } catch (cause) {
      setError(errorText(cause, t`Could not update`));
      void refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const dueTime = (item: ScratchpadItem) =>
    item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const visible = hiddenIds.size > 0 ? items.filter((item) => !hiddenIds.has(item.id)) : items;
  const undone = visible.filter((item) => item.status !== "done");
  const pastDue = undone
    .filter((item) => item.status === "open" && dueTime(item) < now)
    .sort((a, b) => dueTime(a) - dueTime(b));
  const pastDueIds = new Set(pastDue.map((item) => item.id));
  const openItems = [
    ...pastDue,
    ...undone.filter((item) => item.status === "open" && !pastDueIds.has(item.id)),
    ...undone.filter((item) => item.status === "parked"),
  ];
  const doneItems = visible.filter((item) => item.status === "done");
  const doneCount = doneItems.length;

  return (
    <div ref={sectionRef} className="mt-6" data-testid="bot-scratchpad">
      <div className="mb-3 text-[13.5px] font-medium text-foreground">
        <Trans>Open work</Trans>
      </div>
      {loadFailed && openItems.length === 0 && doneItems.length === 0 ? (
        <div className="flex items-center gap-2 py-1 text-[13.5px]">
          <span className="text-destructive">
            <Trans>Could not load</Trans>
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : openItems.length === 0 ? (
        <div className="py-1 text-[13.5px] text-muted-foreground/80">
          <Trans>None yet</Trans>
        </div>
      ) : (
        openItems.map((item) => (
          <div
            key={item.id}
            data-scratchpad-item={item.id}
            className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 hover:bg-accent${highlightId === item.id ? " bg-accent" : ""}`}
          >
            <Checkbox
              aria-label={t`Complete`}
              checked={false}
              disabled={busy}
              onCheckedChange={() => void setStatus(item, "done")}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="text-start text-[14.5px] text-foreground" dir="auto">
                {item.title}
              </div>
              <ScratchpadItemMeta item={item} />
              {item.notes ? (
                <div className="mt-0.5 text-[12.5px] text-muted-foreground/80" dir="auto">
                  {item.notes}
                </div>
              ) : null}
            </div>
            {item.status === "parked" ? (
              <span className="shrink-0 text-[12px] text-muted-foreground/80">
                <Trans>Parked</Trans>
              </span>
            ) : null}
            {item.status === "open" ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={t`Park`}
                disabled={busy}
                onClick={() => void setStatus(item, "parked")}
                className="shrink-0 text-muted-foreground/70"
              >
                <Trans>Park</Trans>
              </Button>
            ) : item.status === "parked" ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={t`Reopen`}
                disabled={busy}
                onClick={() => void setStatus(item, "open")}
                className="shrink-0 text-muted-foreground/70"
              >
                <Trans>Reopen</Trans>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t`Remove`}
              disabled={busy}
              onClick={() => holdRemove(item)}
              className="shrink-0 text-muted-foreground/70"
            >
              <X />
            </Button>
          </div>
        ))
      )}
      {doneItems.length > 0 ? (
        <details className="group mt-3" data-testid="bot-scratchpad-done">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trans>Done ({doneCount})</Trans>
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform group-open:rotate-180"
            />
          </summary>
          {doneItems.map((item) => (
            <div key={item.id} className="flex w-full items-start gap-2 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-muted-foreground line-through" dir="auto">
                  {item.title}
                </div>
                {item.resolvedReason ? (
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground/80" dir="auto">
                    {item.resolvedReason}
                  </div>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => void setStatus(item, "open")}
                className="shrink-0 text-muted-foreground/70"
              >
                <Trans>Reopen</Trans>
              </Button>
            </div>
          ))}
        </details>
      ) : null}
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addItem();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t`Add item`}
          aria-label={t`New open-work item`}
          maxLength={200}
          className="min-w-0 flex-1"
        />
        <Button
          variant="secondary"
          className="rounded-full"
          disabled={busy || !draft.trim()}
          onClick={() => void addItem()}
        >
          <Trans>Add</Trans>
        </Button>
      </form>
      {error ? <div className="mt-2 text-[13px] text-destructive">{error}</div> : null}
    </div>
  );
}
