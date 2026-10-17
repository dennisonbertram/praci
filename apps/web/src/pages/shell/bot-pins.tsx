import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BotPins, PinItem, PinList } from "@rakazo/contracts";
import {
  addItem,
  BOT_PINS_ITEM_TEXT_MAX,
  BOT_PINS_MAX_ITEMS,
  deleteItem,
  editItem,
  setItemDone,
} from "@rakazo/contracts";
import { Button, Card, Checkbox, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { RefreshCw, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";

/** Loads the bot's pins and reloads whenever `reloadKey` changes (the latest `pins.updated` seq). */
export function useBotPins(botId: string | undefined, reloadKey: number) {
  const [state, setState] = useState<{ botId: string; pins: BotPins } | null>(null);
  useEffect(() => {
    if (!botId) return;
    let live = true;
    rpc.pins
      .get({ botId })
      .then((pins) => live && setState(pins ? { botId, pins } : null))
      .catch((cause) => console.error("Could not load pins", cause));
    return () => {
      live = false;
    };
  }, [botId, reloadKey]);
  const pins = state && state.botId === botId ? state.pins : null;
  const setPins = (next: BotPins) => setState({ botId: next.botId, pins: next });
  return [pins, setPins] as const;
}

/** While amounts are hidden, every figure in a pin is masked and its unit kept: "$•••", "••• mo". */
export const maskPinFigures = (text: string) => text.replace(/\d(?:[\d,.\s]*\d)?/g, "•••");

export function PinsStrip({ pins, onPins }: { pins: BotPins; onPins: (pins: BotPins) => void }) {
  const hidden = useHideAmounts();
  const shown = (text: string) => (hidden ? maskPinFigures(text) : text);
  const [refreshing, setRefreshing] = useState(false);
  if (pins.stats.length === 0) return null;
  const updated = pins.refreshedAt ? formatRelativeTime(pins.refreshedAt) : "";
  const refresh = async () => {
    setRefreshing(true);
    try {
      onPins((await rpc.pins.refresh({ botId: pins.botId })).pins);
    } catch (cause) {
      console.error("Could not refresh pins", cause);
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div
      data-testid="pins-strip"
      className="rk-scroll flex shrink-0 items-stretch gap-2 overflow-x-auto border-b border-border px-3 py-2 md:px-[22px]"
    >
      {pins.stats.map((stat) => (
        <Card key={stat.id} size="sm" className="shrink-0 px-3.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span dir="auto">{stat.label}</span>
            {stat.error ? (
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" aria-label={stat.error} />}
                  className="text-warning"
                >
                  <TriangleAlert size={12} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{stat.error}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="text-[22px] font-semibold leading-tight tabular-nums" dir="auto">
            {shown(stat.value)}
          </div>
          {stat.detail ? (
            <div className="text-[11px] text-muted-foreground" dir="auto">
              {shown(stat.detail)}
            </div>
          ) : null}
        </Card>
      ))}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Refresh`}
              disabled={refreshing}
              className="shrink-0 self-center text-muted-foreground"
              onClick={() => void refresh()}
            />
          }
        >
          <RefreshCw size={14} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
        </TooltipTrigger>
        {pins.refreshedAt ? (
          <TooltipContent>
            <Trans>Updated {updated}</Trans>
          </TooltipContent>
        ) : null}
      </Tooltip>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onText,
  onDelete,
}: {
  item: PinItem;
  onToggle: (done: boolean) => void;
  onText: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const finished = useRef(false);
  const deleteLabel = t`Delete ${item.text}`;
  const end = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const text = (draft ?? "").trim();
    setDraft(null);
    if (!save) return;
    if (!text) onDelete();
    else if (text !== item.text) onText(text);
  };
  return (
    <li className="group flex items-start gap-2 py-1">
      <Checkbox
        className="mt-0.5"
        checked={item.done}
        aria-label={item.text}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      {draft === null ? (
        <button
          type="button"
          dir="auto"
          className={`min-w-0 flex-1 break-words text-start text-sm ${
            item.done ? "text-muted-foreground line-through" : ""
          }`}
          onClick={() => {
            finished.current = false;
            setDraft(item.text);
          }}
        >
          {item.text}
        </button>
      ) : (
        <input
          ref={(el) => el?.focus()}
          dir="auto"
          aria-label={item.text}
          maxLength={BOT_PINS_ITEM_TEXT_MAX}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => end(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") end(true);
            if (event.key === "Escape") end(false);
          }}
          className="min-w-0 flex-1 rounded-sm border border-border bg-background px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={deleteLabel}
        className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onDelete}
      >
        <X size={12} aria-hidden="true" />
      </Button>
    </li>
  );
}

const SAVE_RETRY_MS = 1500;

export function PinsList({ pins, onPins }: { pins: BotPins; onPins: (pins: BotPins) => void }) {
  const [added, setAdded] = useState("");
  const [lost, setLost] = useState(false);
  const [failed, setFailed] = useState(false);
  const adding = useRef(false);
  const latest = useRef(pins);
  latest.current = pins;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const list = pins.list;
  if (!list) return null;

  // Saves run one at a time and apply the change to the newest items and revision.
  const change = (edit: (list: PinList) => PinList) => {
    const saved = queue.current.then(async () => {
      const current = latest.current;
      if (!current.list) return false;
      const request = {
        botId: current.botId,
        list: edit(current.list),
        baseRevision: current.revision,
      };
      try {
        // A thrown error is a network or server failure; a conflict comes back as ok: false.
        const result = await rpc.pins.save(request).catch(async (cause) => {
          console.error("Could not save the list, retrying", cause);
          await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_MS));
          return rpc.pins.save(request);
        });
        latest.current = result.pins;
        onPins(result.pins);
        setLost(!result.ok);
        setFailed(false);
        return true;
      } catch (cause) {
        console.error("Could not save the list", cause);
        setFailed(true);
        return false;
      }
    });
    queue.current = saved.then(() => {});
    return saved;
  };
  // The draft stays in the box until the save succeeds.
  const commitAdded = async () => {
    const text = added.trim();
    if (!text) return setAdded("");
    if (adding.current) return;
    adding.current = true;
    const id = crypto.randomUUID().slice(0, 12);
    if (await change((l) => addItem(l, id, text))) setAdded("");
    adding.current = false;
  };

  return (
    <div data-testid="pins-list" className="flex min-w-0 flex-col gap-2">
      <h2 className="text-sm font-semibold" dir="auto">
        {list.title}
      </h2>
      <ul>
        {list.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onToggle={(done) => change((l) => setItemDone(l, item.id, done))}
            onText={(text) => change((l) => editItem(l, item.id, text))}
            onDelete={() => change((l) => deleteItem(l, item.id))}
          />
        ))}
      </ul>
      {list.items.length < BOT_PINS_MAX_ITEMS ? (
        <input
          dir="auto"
          aria-label={t`Add item`}
          placeholder={t`Add item`}
          maxLength={BOT_PINS_ITEM_TEXT_MAX}
          value={added}
          onChange={(event) => setAdded(event.target.value)}
          onBlur={() => void commitAdded()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commitAdded();
          }}
          className="rounded-sm bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : null}
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          <Trans>Couldn't save. Try again.</Trans>
        </p>
      ) : null}
      {lost ? (
        <p role="status" className="text-xs text-muted-foreground">
          <Trans>The bot changed this list. Your last edit wasn't saved.</Trans>
        </p>
      ) : null}
    </div>
  );
}
