import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { Button, cn, Spinner } from "@rakazo/ui-web";
import { FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { splitSnippet } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { sourceLabel } from "./FilterBar";
import { dateText, isSettled, statusLabel, typeLabel } from "./format";
import { type ItemAction, ItemMenu } from "./ItemMenu";
import type { Row } from "./use-data-room-list";

/** What the list tells the page about pointer, keyboard and menu use. */
export type RowInteraction = {
  /** The item the preview shows, highlighted in the list. */
  shownId: string | undefined;
  /** An arrow key moved to this row: show it, as a click would, but never close the preview. */
  onSelect: (item: DataRoomApiItem) => void;
  onToggle: (item: DataRoomApiItem) => void;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  folderPath: (id: string | null) => string;
  /** The folder the page shows; rows elsewhere (All items) name their folder. */
  openFolderId?: string;
};

/** True while an arrow key moves the focus, so only that focus (not a click or Tab) selects. */
let arrowMove = false;
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const rows = Array.from(
    event.currentTarget.closest("[data-rows]")?.querySelectorAll<HTMLElement>("[data-row]") ?? [],
  );
  arrowMove = true;
  rows[rows.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
  arrowMove = false;
}

function rowProps(item: DataRoomApiItem, o: RowInteraction) {
  return {
    "data-row": "",
    "data-item-id": item.id,
    tabIndex: 0,
    onClick: () => o.onToggle(item),
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (arrowMove && event.target === event.currentTarget) o.onSelect(item);
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

/** A document icon (red when the file failed), or a spinner while the file is being read. */
function Marker({ item }: { item: DataRoomApiItem }) {
  if (item.status === "failed") {
    const Icon = fileIcon(item);
    return (
      <Icon role="img" aria-label={t`Failed`} className="size-3.5 shrink-0 text-destructive" />
    );
  }
  if (!isSettled(item.status)) {
    return (
      <Spinner
        role="presentation"
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
    );
  }
  const Icon = fileIcon(item);
  return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />;
}

const SHEET = /^text\/(csv|tab-separated-values)$|spreadsheet|ms-excel/;
const fileIcon = ({ mimeType, name }: DataRoomApiItem) =>
  mimeType.startsWith("image/")
    ? FileImage
    : SHEET.test(mimeType) || /\.(csv|tsv|xlsx?)$/i.test(name)
      ? FileSpreadsheet
      : FileText;

/** True when some row has a type, document date or party, so those columns are worth their width. */
export const hasFacets = (rows: Row[]) =>
  rows.some(({ item: { facets } }) => facets.docType || facets.docDate || facets.parties.length);

// One grid template for the header and every row. Name never goes below 200px and takes the rest;
// as the list pane narrows, Parties goes first, then Type, then Date. The menu stays.
const ROW_GRID =
  "grid items-center gap-2.5 px-2 grid-cols-[minmax(200px,1fr)_28px] " +
  "@min-[400px]/list:grid-cols-[minmax(200px,1fr)_90px_28px] " +
  "@min-[500px]/list:grid-cols-[minmax(200px,1fr)_84px_90px_28px] " +
  "@min-[620px]/list:grid-cols-[minmax(200px,1fr)_84px_90px_110px_28px] " +
  // With room to spare, Type and Parties widen first, so "Acme Servo Supply (Mock)" fits.
  "@min-[820px]/list:grid-cols-[minmax(240px,1fr)_120px_100px_200px_28px]";
/** Without facets the name takes every column but the menu. */
const PLAIN_GRID = "grid items-center gap-2.5 px-2 grid-cols-[minmax(0,1fr)_28px]";
/** As PLAIN_GRID, with a fixed status column so "Failed" lines up whatever the name's length. */
const STATUS_GRID = "grid items-center gap-2.5 px-2 grid-cols-[minmax(0,1fr)_72px_28px]";
const hasStatus = (rows: Row[]) => rows.some(({ item }) => statusLabel(item.status));
const plainGrid = (status: boolean) => (status ? STATUS_GRID : PLAIN_GRID);
const DATE_CELL = "hidden @min-[400px]/list:block";
const TYPE_CELL = "hidden @min-[500px]/list:block";
const PARTIES_CELL = "hidden @min-[620px]/list:block";
const CELL = "min-w-0 truncate text-muted-foreground";

function TableHead({ facets, status }: { facets: boolean; status: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-testid="data-room-head"
      className={cn(
        facets ? ROW_GRID : plainGrid(status),
        "sticky top-0 z-10 bg-background py-2 text-xs text-muted-foreground",
      )}
    >
      <span>
        <Trans>Name</Trans>
      </span>
      {facets ? (
        <>
          <span className={TYPE_CELL}>
            <Trans>Type</Trans>
          </span>
          <span className={DATE_CELL}>
            <Trans>Date</Trans>
          </span>
          <span className={PARTIES_CELL}>
            <Trans>Parties</Trans>
          </span>
        </>
      ) : status ? (
        <span>
          <Trans>Status</Trans>
        </span>
      ) : null}
      <span />
    </div>
  );
}

function ItemRow({
  item,
  o,
  facets,
  status,
}: {
  item: DataRoomApiItem;
  o: RowInteraction;
  facets: boolean;
  status: boolean;
}) {
  const label = statusLabel(item.status);
  const folder = item.folderId === (o.openFolderId ?? null) ? "" : o.folderPath(item.folderId);
  return (
    <li
      aria-current={o.shownId === item.id}
      {...rowProps(item, o)}
      className={cn(
        facets ? ROW_GRID : plainGrid(status),
        "cursor-pointer border-b border-border py-1.5 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        // Clearly stronger than the hover tint, so the chosen row stays obvious.
        o.shownId === item.id && "bg-sidebar-accent font-medium hover:bg-sidebar-accent",
      )}
    >
      <span data-testid="data-room-name" className="flex min-w-0 items-center gap-2">
        <Marker item={item} />
        <span className="flex min-w-0 flex-col">
          {/* Two lines before cutting, so long names that share a start can still be told apart. */}
          <span
            className={cn(
              "line-clamp-2 break-words",
              !isSettled(item.status) && item.status !== "failed" && "text-muted-foreground",
            )}
            title={item.name}
          >
            {item.name}
          </span>
          {folder ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{folder}</span>
          ) : null}
          {/* Where the Type column is hidden (a phone), "Failed" goes under the name instead. */}
          {facets && item.status === "failed" ? (
            <span className="text-xs font-normal text-destructive @min-[500px]/list:hidden">
              {label}
            </span>
          ) : null}
        </span>
      </span>
      {!facets && status ? (
        <span
          data-testid="data-room-status"
          className={cn(CELL, item.status === "failed" && "text-destructive")}
          title={item.status === "failed" ? (item.error ?? undefined) : undefined}
        >
          {label}
        </span>
      ) : null}
      {facets ? (
        <>
          <span
            className={cn(TYPE_CELL, CELL, item.status === "failed" && "text-destructive")}
            title={item.status === "failed" ? (item.error ?? undefined) : undefined}
          >
            {label || typeLabel(item.facets.docType)}
          </span>
          <span className={cn(DATE_CELL, CELL)}>{dateText(item.facets.docDate)}</span>
          <span className={cn(PARTIES_CELL, CELL)} title={item.facets.parties.join(", ")}>
            {item.facets.parties.join(", ")}
          </span>
        </>
      ) : null}
      <span>
        <ItemMenu item={item} onAction={o.onAction} canRetry={item.status === "failed"} />
      </span>
    </li>
  );
}

/** Shared by the file tiles and the sub-folder tiles, so a grid reads as one set of tiles. */
const TILE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-3";
/** The icon area at the top of every tile: no fill of its own, so file and folder tiles match. */
const ICON_AREA = "grid h-20 place-items-center rounded-md [&>svg]:size-6";
const TILE =
  "relative flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card p-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The open folder's sub-folders, above its files, so a folder that holds only folders never looks
 * empty. As rows in the list, as tiles (`tiles`) in the grid.
 */
export function SubfolderList({
  folders,
  onOpen,
  onAction,
  contents,
  tiles = false,
}: {
  folders: DataRoomApiFolder[];
  onOpen: (id: string) => void;
  onAction: (action: ItemAction, folder: DataRoomApiFolder) => void;
  /** What a folder holds ("3 items"), so a parent never looks emptier than it is. */
  contents: (folder: DataRoomApiFolder) => string;
  tiles?: boolean;
}) {
  if (!folders.length) return null;
  if (tiles) {
    return (
      <ul aria-label={t`Sub-folders`} className={cn(TILE_GRID, "pb-0")}>
        {folders.map((folder) => (
          <li key={folder.id} className="relative flex">
            <Button
              variant="ghost"
              onClick={() => onOpen(folder.id)}
              className={cn(TILE, "h-auto w-full items-stretch font-medium whitespace-normal")}
            >
              <span className={ICON_AREA}>
                <Folder aria-hidden="true" className="size-6 text-muted-foreground" />
              </span>
              <span className="line-clamp-3 min-h-15 text-start break-words" title={folder.name}>
                {folder.name}
              </span>
              <span className="min-h-4 text-start text-xs font-normal text-muted-foreground">
                {contents(folder)}
              </span>
            </Button>
            <ItemMenu item={folder} onAction={onAction} className="absolute top-3 right-3" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul aria-label={t`Sub-folders`} className="flex flex-col">
      {folders.map((folder) => (
        <li
          key={folder.id}
          className="grid grid-cols-[minmax(0,1fr)_28px] items-center gap-2.5 border-b border-border pe-2"
        >
          <Button
            variant="ghost"
            onClick={() => onOpen(folder.id)}
            className="h-auto w-full justify-start rounded-none px-2 py-2 font-normal"
          >
            <Folder aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="min-w-0 truncate" title={folder.name}>
              {folder.name}
            </span>
            <span className="ms-auto shrink-0 text-xs text-muted-foreground">
              {contents(folder)}
            </span>
          </Button>
          <ItemMenu item={folder} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}

/** `lead` (the open folder's sub-folders) goes under the column header, above the files. */
export function ListView({ rows, o, lead }: { rows: Row[]; o: RowInteraction; lead?: ReactNode }) {
  const facets = hasFacets(rows);
  const status = hasStatus(rows);
  return (
    <div>
      <TableHead facets={facets} status={status} />
      {lead}
      <ul aria-label={t`Items`} data-rows>
        {rows.map(({ item }) => (
          <ItemRow key={item.id} item={item} o={o} facets={facets} status={status} />
        ))}
      </ul>
    </div>
  );
}

export function GridView({ rows, o }: { rows: Row[]; o: RowInteraction }) {
  return (
    <ul aria-label={t`Items`} data-rows className={TILE_GRID}>
      {rows.map(({ item }) => (
        <li
          key={item.id}
          {...rowProps(item, o)}
          aria-current={o.shownId === item.id}
          className={cn(
            TILE,
            o.shownId === item.id && "border-primary bg-sidebar-accent ring-1 ring-primary",
          )}
        >
          <span className={ICON_AREA}>
            <Marker item={item} />
          </span>
          <ItemMenu
            item={item}
            onAction={o.onAction}
            canRetry={item.status === "failed"}
            className="absolute top-3 right-3"
          />
          {/* Three lines kept for every name, so tiles are one height and long names still differ. */}
          <span className="line-clamp-3 min-h-15 font-medium break-words" title={item.name}>
            {item.name}
          </span>
          {/* Always one line tall, so a "Failed" line never makes one tile taller than the rest. */}
          <span
            className={cn(
              "min-h-4 truncate text-xs text-muted-foreground",
              item.status === "failed" && "text-destructive",
            )}
          >
            {statusLabel(item.status) ||
              [typeLabel(item.facets.docType), dateText(item.facets.docDate)]
                .filter(Boolean)
                .join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A search snippet as text and <mark> elements. The snippet is never parsed as HTML. */
export function Snippet({ text }: { text: string }) {
  useHideAmounts();
  return (
    <p className="text-sm text-foreground/80">
      {splitSnippet(maskCurrencyWhenHidden(text)).map((part, index) =>
        part.mark ? (
          // The padding keeps the tint past the last letter's edge, so "November" looks fully marked.
          <mark
            key={index}
            className="rounded-sm bg-warning/25 px-0.5 text-inherit box-decoration-clone"
          >
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
    <ul aria-label={t`Results`} data-rows className="flex flex-col">
      {rows.map(({ item, snippets }) => (
        <li
          key={item.id}
          {...rowProps(item, o)}
          aria-current={o.shownId === item.id}
          className={cn(
            "flex cursor-pointer flex-col gap-1.5 border-b border-border px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            // Clearly stronger than the hover tint, so the chosen row stays obvious.
            o.shownId === item.id && "bg-sidebar-accent font-medium hover:bg-sidebar-accent",
          )}
        >
          <div className="flex items-center gap-2 text-sm">
            <Marker item={item} />
            <span className="line-clamp-2 min-w-0 flex-1 font-medium break-words" title={item.name}>
              {item.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {[o.folderPath(item.folderId), sourceLabel(item.source)].filter(Boolean).join(" · ")}
            </span>
            <ItemMenu item={item} onAction={o.onAction} canRetry={item.status === "failed"} />
          </div>
          {snippets.map((snippet) => (
            <Snippet key={snippet} text={snippet} />
          ))}
        </li>
      ))}
    </ul>
  );
}
