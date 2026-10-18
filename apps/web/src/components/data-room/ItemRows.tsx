import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { Button, cn, Spinner } from "@rakazo/ui-web";
import { FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { splitSnippet } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
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
// as the list pane narrows, Parties goes first, then Type and Date, which then go under the name.
// The menu stays.
const ROW_GRID =
  "grid items-center gap-2.5 px-4 md:px-7 @min-[800px]/bd:px-2 grid-cols-[minmax(200px,1fr)_28px] " +
  // Type is wide enough for "Investor document", and Parties fits beside an open preview.
  "@min-[500px]/list:grid-cols-[minmax(200px,1fr)_110px_90px_28px] " +
  "@min-[590px]/list:grid-cols-[minmax(180px,1fr)_120px_90px_110px_28px] " +
  // With room to spare, Type and Parties widen first, so "Acme Servo Supply (Mock)" fits.
  "@min-[820px]/list:grid-cols-[minmax(240px,1fr)_120px_100px_200px_28px]";
/** Without facets the name takes every column but the menu. */
const PLAIN_GRID =
  "grid items-center gap-2.5 px-4 md:px-7 @min-[800px]/bd:px-2 grid-cols-[minmax(0,1fr)_28px]";
/** As PLAIN_GRID, with a fixed status column so "Failed" lines up whatever the name's length. */
const STATUS_GRID =
  "grid items-center gap-2.5 px-4 md:px-7 @min-[800px]/bd:px-2 grid-cols-[minmax(0,1fr)_72px_28px]";
const hasStatus = (rows: Row[]) => rows.some(({ item }) => statusLabel(item.status));
const plainGrid = (status: boolean) => (status ? STATUS_GRID : PLAIN_GRID);
const DATE_CELL = "hidden @min-[500px]/list:block";
const TYPE_CELL = "hidden @min-[500px]/list:block";
const PARTIES_CELL = "hidden @min-[590px]/list:block";
/** Parties wrap to a second line (as long names do) rather than lose the end of a name. */
const PARTIES_VALUE =
  "hidden min-w-0 break-words text-muted-foreground @min-[590px]/list:line-clamp-2";
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
  snippets,
  o,
  facets,
  status,
}: {
  item: DataRoomApiItem;
  /** Search only: the text that matched, under the row. */
  snippets: string[];
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
        o.shownId === item.id && "bg-sidebar-accent hover:bg-sidebar-accent",
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
              // Only the name is bold, so the other columns keep their width and are not cut.
              o.shownId === item.id && "font-medium",
            )}
            title={item.name}
          >
            {item.name}
          </span>
          {folder ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{folder}</span>
          ) : null}
          {/* Where the Type and Date columns are hidden (a phone), they go under the name. */}
          {facets ? (
            <span
              data-testid="data-room-subline"
              className={cn(
                "truncate text-xs font-normal text-muted-foreground @min-[500px]/list:hidden",
                item.status === "failed" && "text-destructive",
              )}
            >
              {label || <TypeAndDate item={item} />}
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
            title={
              item.status === "failed"
                ? (item.error ?? undefined)
                : typeLabel(item.facets.docType) || undefined
            }
          >
            {label ||
              typeLabel(item.facets.docType) ||
              (isSettled(item.status) ? <NotTagged /> : null)}
          </span>
          <span className={cn(DATE_CELL, CELL)}>{dateText(item.facets.docDate)}</span>
          <span
            data-testid="data-room-parties"
            className={PARTIES_VALUE}
            title={item.facets.parties.join(", ")}
          >
            {item.facets.parties.join(", ")}
          </span>
        </>
      ) : null}
      <span>
        <ItemMenu item={item} onAction={o.onAction} canRetry={item.status === "failed"} />
      </span>
      {snippets.length ? (
        // Under the name (past its icon), across the whole row.
        <span className="col-span-full -mt-0.5 flex flex-col gap-1 ps-5.5 font-normal">
          {snippets.map((snippet) => (
            <Snippet key={snippet} text={snippet} />
          ))}
        </span>
      ) : null}
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
  rowClass = PLAIN_GRID,
}: {
  folders: DataRoomApiFolder[];
  onOpen: (id: string) => void;
  onAction: (action: ItemAction, folder: DataRoomApiFolder) => void;
  /** What a folder holds ("3 items"), so a parent never looks emptier than it is. */
  contents: (folder: DataRoomApiFolder) => string;
  tiles?: boolean;
  /** As rows: the file rows' grid, so the columns line up. */
  rowClass?: string;
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
          className={cn(rowClass, "border-b border-border py-1.5 text-sm hover:bg-muted/50")}
        >
          {/* Every column but the menu, so the icon, name and height match the file rows. */}
          <Button
            variant="ghost"
            onClick={() => onOpen(folder.id)}
            className="col-[1/-2] h-auto min-h-5 min-w-0 justify-start gap-2 rounded-sm p-0 text-start text-sm font-normal hover:bg-transparent"
          >
            <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate" title={folder.name}>
              {folder.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{contents(folder)}</span>
          </Button>
          <span>
            <ItemMenu item={folder} onAction={onAction} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The files as rows; search results too, with the text that matched under each. `lead` (the open
 * folder's sub-folders) goes under the column header, above the files, in the same grid.
 */
export function ListView({
  rows,
  o,
  lead,
}: {
  rows: Row[];
  o: RowInteraction;
  lead?: (rowClass: string) => ReactNode;
}) {
  const facets = hasFacets(rows);
  const status = hasStatus(rows);
  return (
    <div>
      <TableHead facets={facets} status={status} />
      {lead?.(facets ? ROW_GRID : plainGrid(status))}
      <ul aria-label={t`Items`} data-rows>
        {rows.map(({ item, snippets }) => (
          <ItemRow
            key={item.id}
            item={item}
            snippets={snippets}
            o={o}
            facets={facets}
            status={status}
          />
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
          {/* Type and date on lines of their own, two lines on every tile, so neither is cut short. */}
          <span
            data-testid="data-room-tile-meta"
            className={cn(
              "flex min-h-8 flex-col text-xs text-muted-foreground *:truncate",
              item.status === "failed" && "text-destructive",
            )}
          >
            {statusLabel(item.status) ? (
              <span>{statusLabel(item.status)}</span>
            ) : (
              <>
                <span>{typeLabel(item.facets.docType) || <NotTagged />}</span>
                <span>{dateText(item.facets.docDate)}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Read, but not tagged: AI reading was off (or "Not now") when it arrived. */
function NotTagged() {
  return (
    <span className="text-muted-foreground/70">
      <Trans>Not tagged</Trans>
    </span>
  );
}

/** "Invoice · Oct 3, 2026", for the line under a name where the columns do not fit. */
function TypeAndDate({ item }: { item: DataRoomApiItem }) {
  const type = typeLabel(item.facets.docType);
  const date = dateText(item.facets.docDate);
  if (!type && isSettled(item.status)) return <NotTagged />;
  return <>{[type, date].filter(Boolean).join(" · ")}</>;
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
