import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { cn, Spinner } from "@rakazo/ui-web";
import { FileText, Mail, Upload } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { splitSnippet } from "../../lib/data-room";
import { sourceLabel } from "./FilterBar";
import { dateText, statusLabel } from "./format";
import { type ItemAction, ItemMenu } from "./ItemMenu";
import type { Row } from "./use-data-room-list";

/** What the list tells the page about pointer, keyboard and menu use. */
export type RowInteraction = {
  /** The item the preview shows, highlighted in the list. */
  shownId: string | undefined;
  onHover: (item: DataRoomApiItem) => void;
  onLeave: () => void;
  onFocusItem: (item: DataRoomApiItem) => void;
  onToggle: (item: DataRoomApiItem) => void;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  folderPath: (id: string | null) => string;
};

function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const rows = Array.from(
    event.currentTarget.closest("[data-rows]")?.querySelectorAll<HTMLElement>("[data-row]") ?? [],
  );
  rows[rows.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
}

function rowProps(item: DataRoomApiItem, o: RowInteraction) {
  return {
    "data-row": "",
    "data-item-id": item.id,
    tabIndex: 0,
    onClick: () => o.onToggle(item),
    onMouseEnter: () => o.onHover(item),
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) o.onFocusItem(item);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(event);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        o.onToggle(item);
      }
    },
  };
}

function SourceIcon({ source }: { source: string }) {
  const Icon = source === "upload" ? Upload : source === "gmail" ? Mail : FileText;
  return (
    <span className="grid place-items-center text-muted-foreground" title={sourceLabel(source)}>
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{sourceLabel(source)}</span>
    </span>
  );
}

/** A document icon, or the state marker while a file is being read or has failed. */
function Marker({ item }: { item: DataRoomApiItem }) {
  if (item.status === "failed") {
    return (
      <span
        role="img"
        aria-label={t`Failed`}
        title={item.error ?? t`Failed`}
        className="grid size-3.5 shrink-0 place-items-center"
      >
        <span className="size-2 rounded-full bg-destructive" />
      </span>
    );
  }
  if (item.status !== "ready") {
    return (
      <Spinner
        role="presentation"
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
    );
  }
  return <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />;
}

// One grid template for the header and every row. Name never goes below 200px and takes the rest;
// as the list pane narrows, Parties goes first, then Type, then Date. The source icon and menu stay.
const ROW_GRID =
  "grid items-center gap-2.5 px-2 grid-cols-[minmax(200px,1fr)_28px_28px] " +
  "@min-[400px]/list:grid-cols-[minmax(200px,1fr)_90px_28px_28px] " +
  "@min-[500px]/list:grid-cols-[minmax(200px,1fr)_84px_90px_28px_28px] " +
  "@min-[620px]/list:grid-cols-[minmax(200px,1fr)_84px_90px_110px_28px_28px]";
const DATE_CELL = "hidden @min-[400px]/list:block";
const TYPE_CELL = "hidden @min-[500px]/list:block";
const PARTIES_CELL = "hidden @min-[620px]/list:block";
const CELL = "min-w-0 truncate text-muted-foreground";

function TableHead() {
  return (
    <div
      aria-hidden="true"
      data-testid="data-room-head"
      className={cn(ROW_GRID, "sticky top-0 z-10 bg-background py-2 text-xs text-muted-foreground")}
    >
      <span>
        <Trans>Name</Trans>
      </span>
      <span className={TYPE_CELL}>
        <Trans>Type</Trans>
      </span>
      <span className={DATE_CELL}>
        <Trans>Date</Trans>
      </span>
      <span className={PARTIES_CELL}>
        <Trans>Parties</Trans>
      </span>
      <span />
      <span />
    </div>
  );
}

function ItemRow({ item, o }: { item: DataRoomApiItem; o: RowInteraction }) {
  const label = statusLabel(item.status);
  return (
    <li
      aria-current={o.shownId === item.id}
      {...rowProps(item, o)}
      className={cn(
        ROW_GRID,
        "cursor-pointer border-b border-border py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        o.shownId === item.id && "bg-sidebar-accent",
      )}
    >
      <span data-testid="data-room-name" className="flex min-w-0 items-center gap-2">
        <Marker item={item} />
        <span
          className={cn(
            "min-w-0 truncate",
            item.status !== "ready" && item.status !== "failed" && "text-muted-foreground",
          )}
          title={item.name}
        >
          {item.name}
        </span>
      </span>
      <span
        className={cn(TYPE_CELL, CELL, item.status === "failed" && "text-destructive")}
        title={item.status === "failed" ? (item.error ?? undefined) : undefined}
      >
        {item.status === "ready" ? item.facets.docType : label}
      </span>
      <span className={cn(DATE_CELL, CELL)}>{dateText(item.facets.docDate)}</span>
      <span className={cn(PARTIES_CELL, CELL)} title={item.facets.parties.join(", ")}>
        {item.facets.parties.join(", ")}
      </span>
      <span>
        <SourceIcon source={item.source} />
      </span>
      <span>
        <ItemMenu item={item} onAction={o.onAction} />
      </span>
    </li>
  );
}

export function ListView({ rows, o }: { rows: Row[]; o: RowInteraction }) {
  return (
    <div>
      <TableHead />
      <ul aria-label={t`Items`} data-rows onMouseLeave={o.onLeave}>
        {rows.map(({ item }) => (
          <ItemRow key={item.id} item={item} o={o} />
        ))}
      </ul>
    </div>
  );
}

export function GridView({ rows, o }: { rows: Row[]; o: RowInteraction }) {
  return (
    <ul
      aria-label={t`Items`}
      data-rows
      onMouseLeave={o.onLeave}
      className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-3"
    >
      {rows.map(({ item }) => (
        <li
          key={item.id}
          {...rowProps(item, o)}
          aria-current={o.shownId === item.id}
          className={cn(
            "flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card p-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            o.shownId === item.id && "bg-sidebar-accent",
          )}
        >
          <span className="grid h-20 place-items-center rounded-md bg-muted">
            <Marker item={item} />
          </span>
          <span className="truncate font-medium" title={item.name}>
            {item.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {item.status === "ready"
              ? [item.facets.docType, dateText(item.facets.docDate)].filter(Boolean).join(" · ")
              : statusLabel(item.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A search snippet as text and <mark> elements. The snippet is never parsed as HTML. */
export function Snippet({ text }: { text: string }) {
  return (
    <p className="text-sm text-foreground/80">
      {splitSnippet(text).map((part, index) =>
        part.mark ? (
          <mark key={index} className="rounded-sm bg-warning/25 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function ResultsView({ rows, o }: { rows: Row[]; o: RowInteraction }): ReactNode {
  return (
    <ul aria-label={t`Results`} data-rows onMouseLeave={o.onLeave} className="flex flex-col">
      {rows.map(({ item, snippets }) => (
        <li
          key={item.id}
          {...rowProps(item, o)}
          aria-current={o.shownId === item.id}
          className={cn(
            "flex cursor-pointer flex-col gap-1.5 border-b border-border px-3 py-2.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            o.shownId === item.id && "bg-sidebar-accent",
          )}
        >
          <div className="flex items-center gap-2 text-sm">
            <Marker item={item} />
            <span className="min-w-0 flex-1 truncate font-medium" title={item.name}>
              {item.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {[o.folderPath(item.folderId), sourceLabel(item.source)].filter(Boolean).join(" · ")}
            </span>
            <ItemMenu item={item} onAction={o.onAction} />
          </div>
          {snippets.map((snippet) => (
            <Snippet key={snippet} text={snippet} />
          ))}
        </li>
      ))}
    </ul>
  );
}
