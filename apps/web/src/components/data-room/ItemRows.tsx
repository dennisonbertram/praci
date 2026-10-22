import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  cn,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { FileArchive, FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { dataRoomThumbnailUrl, splitSnippet } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import {
  canRetryItem,
  dateText,
  isSettled,
  isStuck,
  stageLabel,
  statusLabel,
  typeLabel,
} from "./format";
import type { ItemAction } from "./ItemMenu";
import { ItemMenu, ItemMenuItems } from "./ItemMenu";
import type { SendTarget } from "./SendToAgent";
import type { Row, SortField } from "./use-data-room-list";

/** What the list tells the page about pointer, keyboard and menu use. */
export type RowInteraction = {
  /** The item the preview shows, highlighted in the list. */
  shownId: string | undefined;
  /** An arrow key moved to this row: show it, as a click would, but never close the preview. */
  onSelect: (item: DataRoomApiItem) => void;
  onToggle: (item: DataRoomApiItem) => void;
  /** Escape on the shown row closes the side preview (focus stays on the row after Enter). */
  onClosePreview?: () => void;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  folderPath: (id: string | null) => string;
  /** The folder the page shows; rows elsewhere (All items) name their folder. */
  openFolderId?: string;
  /** The agents a file can be sent to, most recent first; without them there is no such menu. */
  agents?: SendTarget[];
  onSendToAgent?: (item: DataRoomApiItem, agent: SendTarget) => void;
  /** Ticked rows (list view); without `onCheck` the list has no checkboxes. */
  checked?: ReadonlySet<string>;
  onCheck?: (item: DataRoomApiItem) => void;
  /** The header box: tick (or untick) every row the list shows. */
  onCheckAll?: (on: boolean) => void;
};

/** A file's row or tile, with the item menu on a right-click (or a long press on touch). */
function FileContext({
  item,
  o,
  render,
  children,
}: {
  item: DataRoomApiItem;
  o: RowInteraction;
  render: ReactElement<{ children?: ReactNode }>;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      {/* React events bubble out of the portal into the row, which would pin it. */}
      <ContextMenuContent onClick={(event) => event.stopPropagation()}>
        <ItemMenuItems
          menu="context"
          item={item}
          onAction={o.onAction}
          canRetry={canRetryItem(item)}
          agents={o.agents}
          onSendToAgent={o.onSendToAgent}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

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

/**
 * Only the first row is a Tab stop and the arrow keys move between rows, so a page of 50 rows is
 * one stop, not 100. ponytail: Shift+Tab back into the list lands on the first row, not the last one used.
 */
function rowProps(item: DataRoomApiItem, o: RowInteraction, first: boolean) {
  return {
    "data-row": "",
    "data-item-id": item.id,
    tabIndex: first ? 0 : -1,
    onClick: (event: React.MouseEvent) =>
      o.onCheck && (event.metaKey || event.ctrlKey) ? o.onCheck(item) : o.onToggle(item),
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (arrowMove && event.target === event.currentTarget) o.onSelect(item);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(event);
      } else if (event.key === "Escape" && o.onClosePreview && o.shownId === item.id) {
        o.onClosePreview();
      } else if (event.key === "x" && o.onCheck) {
        // The keyboard route to a tick, as in the inbox: the checkbox itself is not a Tab stop.
        o.onCheck(item);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        // Enter on the row whose preview is open keeps it; Escape or the close button closes it.
        if (o.shownId !== item.id) o.onToggle(item);
      }
    },
  };
}

/** A document icon (red when the file failed), or a spinner while the file is being read. */
function Marker({ item }: { item: DataRoomApiItem }) {
  if (item.status === "failed" || isStuck(item)) {
    const Icon = fileIcon(item);
    return (
      <Icon role="img" aria-label={t`Failed`} className="size-3.5 shrink-0 text-muted-foreground" />
    );
  }
  // Stored text means the file is searchable already: the pipeline's later steps are not its reader's wait.
  if (item.status !== "ready" && !item.previewText) {
    return (
      <span title={stageLabel(item.status)} className="inline-flex shrink-0">
        <Spinner
          role="presentation"
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
      </span>
    );
  }
  const Icon = fileIcon(item);
  return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />;
}

const SHEET = /^text\/(csv|tab-separated-values)$|spreadsheet|ms-excel/;
const isSheet = ({ mimeType, name }: Pick<DataRoomApiItem, "mimeType" | "name">) =>
  SHEET.test(mimeType) || /\.(csv|tsv|xlsx?)$/i.test(name);
export const fileIcon = (item: Pick<DataRoomApiItem, "mimeType" | "name">) =>
  item.mimeType.startsWith("image/")
    ? FileImage
    : isSheet(item)
      ? FileSpreadsheet
      : /zip/.test(item.mimeType) || /\.zip$/i.test(item.name)
        ? FileArchive
        : FileText;

const DASH = "—";
/** The document type; "Not tagged" for a finished file without one, "Not read" for a failed one; empty while it is still being read. */
const typeText = (item: DataRoomApiItem) =>
  typeLabel(item.facets.docType) ||
  (item.status === "failed"
    ? t`Not read`
    : isSettled(item.status, !!item.previewText)
      ? t`Not tagged`
      : "");
const empty = <span className="text-muted-foreground">{DASH}</span>;
/** A failed file has nothing to show in a data column; its reason is under the name. */
const blank = (item: DataRoomApiItem) => (item.status === "failed" ? null : empty);
/** Hidden until the list pane is wide enough, then shown as a table cell. */
const MID_COL = "hidden @min-[640px]/list:table-cell";
const PARTIES_COL = "hidden @min-[800px]/list:table-cell";
// A <col> must show as table-column: table-cell on it breaks the fixed column sizing.
const MID_COLUMN = "hidden @min-[640px]/list:table-column";
const PARTIES_COLUMN = "hidden @min-[800px]/list:table-column";
/** The "⋯" shows on hover or focus, while its menu is open, and always on touch screens. */
const ROW_ACTIONS =
  "opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100";
/** The edge padding the list had as grid rows; the table sits inside it. */
const LIST_PAD = "px-4 md:px-7 @min-[800px]/bd:ps-2";
/** The Date column follows the sort: when the file was added, or the date on the document. */
const dateOf = (item: DataRoomApiItem, field: SortField | undefined) =>
  field === "date" ? dateText(item.facets.docDate) : dateText(item.createdAt, true);

/** The date where no column header names it: "Added Mar 4, 2026" unless the list is sorted by document date. */
const datedLine = (item: DataRoomApiItem, field: SortField | undefined) => {
  const date = dateOf(item, field);
  return date && field !== "date" ? `${t`Added`} ${date}` : date;
};

/** Fixed widths so columns never shift (Type fits "Investor document"); in a wide pane Parties takes 30% and the Name the rest. */
function Columns({ status, snippets }: { status: boolean; snippets: boolean }) {
  return (
    <colgroup>
      <col />
      <col className={cn(MID_COLUMN, snippets ? "w-28" : "w-40")} />
      <col className={cn(MID_COLUMN, "w-24")} />
      {/* Search results carry snippets under the name, so Type and Parties give the Name the room. */}
      <col className={cn(PARTIES_COLUMN, snippets ? "w-40" : "w-56 @min-[900px]/list:w-[30%]")} />
      {status ? <col className={cn(MID_COLUMN, "w-20")} /> : null}
      <col className="w-7" />
    </colgroup>
  );
}

function ListHead({
  sortField,
  rows,
  o,
  status,
}: {
  sortField: SortField | undefined;
  rows: Row[];
  o: RowInteraction;
  status: boolean;
}) {
  const allChecked = rows.length > 0 && rows.every(({ item }) => o.checked?.has(item.id));
  return (
    <TableHeader
      data-testid="data-room-head"
      className="sticky top-0 z-10 hidden bg-background @min-[640px]/list:table-header-group"
    >
      <TableHeadRow>
        <TableHead>
          {o.onCheckAll ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                <Checkbox
                  aria-label={t`Select all`}
                  className="size-4.5 shrink-0"
                  checked={allChecked}
                  onCheckedChange={(on) => o.onCheckAll?.(on)}
                />
              </span>
              <Trans>Name</Trans>
            </div>
          ) : (
            <Trans>Name</Trans>
          )}
        </TableHead>
        <TableHead className={MID_COL}>
          <Trans>Type</Trans>
        </TableHead>
        <TableHead className={MID_COL}>
          {sortField === "date" ? <Trans>Document date</Trans> : <Trans>Added</Trans>}
        </TableHead>
        <TableHead className={PARTIES_COL}>
          <Trans>Parties</Trans>
        </TableHead>
        {status ? (
          <TableHead className={MID_COL}>
            <Trans>Status</Trans>
          </TableHead>
        ) : null}
        <TableHead />
      </TableHeadRow>
    </TableHeader>
  );
}

/** The one visible action under a failed file or a stuck read; Delete is in its menu. It never opens the preview. */
function RetryButton({ item, o }: { item: DataRoomApiItem; o: RowInteraction }) {
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={(event) => {
        event.stopPropagation();
        o.onAction("retry", item);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Trans>Try again</Trans>
    </Button>
  );
}

function ItemRow({
  item,
  snippets,
  o,
  sortField,
  first,
  status,
}: {
  item: DataRoomApiItem;
  /** Search only: the text that matched, under the name. */
  snippets: string[];
  o: RowInteraction;
  sortField: SortField | undefined;
  first: boolean;
  /** The Status column is shown; without it a row's wait is said in the sub-line. */
  status: boolean;
}) {
  const label = statusLabel(item.status, !!item.previewText);
  const stuck = isStuck(item);
  const age = label && item.status !== "failed" && stuck ? t`Taking longer than usual` : "";
  const folder = item.folderId === (o.openFolderId ?? null) ? "" : o.folderPath(item.folderId);
  const parties = item.facets.parties.join(", ");
  const type = typeText(item);
  const date = dateOf(item, sortField);
  const shown = o.shownId === item.id;
  return (
    <FileContext
      item={item}
      o={o}
      render={
        <TableRow
          aria-current={shown}
          {...rowProps(item, o, first)}
          className={cn(
            "group/row cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            // Clearly stronger than the hover tint, so the chosen row stays obvious.
            shown && "bg-sidebar-accent hover:bg-sidebar-accent",
          )}
        />
      }
    >
      <TableCell data-testid="data-room-name">
        <div className="flex min-w-0 items-center gap-2">
          {/* On touch the checkbox always shows, so the slot is a 44 px target. */}
          <span className="relative inline-flex shrink-0 pointer-coarse:items-center">
            {/* On touch the box is a 44 px control in its own slot beside the icon, so it never reads as the icon. */}
            {o.onCheck ? (
              <span aria-hidden="true" className="hidden size-11 pointer-coarse:block" />
            ) : null}
            <Marker item={item} />
            {o.onCheck ? (
              <Checkbox
                aria-label={t`Select ${item.name}`}
                tabIndex={-1}
                checked={o.checked?.has(item.id) ?? false}
                onCheckedChange={() => o.onCheck?.(item)}
                onClick={(event) => event.stopPropagation()}
                // Over the icon: shown on hover, while ticked, and always on touch screens.
                className="absolute -inset-0.5 size-auto bg-background opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:inset-y-auto pointer-coarse:start-0 pointer-coarse:top-0 pointer-coarse:end-auto pointer-coarse:size-11 pointer-coarse:border-transparent pointer-coarse:bg-transparent pointer-coarse:data-checked:bg-transparent pointer-coarse:dark:bg-transparent pointer-coarse:after:hidden pointer-coarse:before:absolute pointer-coarse:before:size-4.5 pointer-coarse:before:rounded-[4px] pointer-coarse:before:border pointer-coarse:before:border-input pointer-coarse:data-checked:before:border-primary pointer-coarse:data-checked:before:bg-primary pointer-coarse:[&>[data-slot=checkbox-indicator]]:relative pointer-coarse:opacity-100 data-checked:opacity-100 dark:bg-background"
              />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                "line-clamp-2 font-medium break-words",
                !isSettled(item.status, !!item.previewText) &&
                  item.status !== "failed" &&
                  "text-muted-foreground",
              )}
              title={item.name}
            >
              {item.name}
            </span>
            {/* A failed file's folder is dropped: its reason (and Try again) takes that line, so the row stays short. */}
            {(folder && item.status !== "failed") || stuck ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                {folder ? (
                  <span className="truncate text-xs text-muted-foreground">{folder}</span>
                ) : null}
                {stuck ? <RetryButton item={item} o={o} /> : null}
              </span>
            ) : null}
            {/* Where the Type, Date and Status columns are hidden (a phone), they go under the name. */}
            <span
              data-testid="data-room-subline"
              className={cn(
                "truncate text-xs text-muted-foreground",
                // On a wide list the Status column says it; the age has no column, so it stays.
                !age && "@min-[640px]/list:hidden",
                // A failed file's reason (or the Failed pill) is its one signal.
                item.status === "failed" && "hidden",
              )}
            >
              {age || label || <TypeAndDate item={item} sortField={sortField} />}
            </span>
            {/* Why it failed, in the row itself: a tooltip is easy to miss and absent on touch. */}
            {item.status === "failed" ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span
                  data-testid={item.error ? "data-room-error" : "data-room-failed-reason"}
                  className="text-xs text-destructive"
                >
                  {item.error ?? (
                    <Trans>Could not read this file. Delete it and upload it again.</Trans>
                  )}
                </span>
                {canRetryItem(item) ? <RetryButton item={item} o={o} /> : null}
              </span>
            ) : null}
            {/* In the name cell, not a row of their own: a row spanning hidden columns squeezed the name. */}
            {snippets.map((snippet) => (
              <Snippet key={snippet} text={snippet} />
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell
        className={cn(MID_COL, "truncate text-muted-foreground")}
        title={type || undefined}
      >
        {type || blank(item)}
      </TableCell>
      <TableCell className={cn(MID_COL, "truncate text-muted-foreground tabular-nums")}>
        {date || empty}
      </TableCell>
      <TableCell
        data-testid="data-room-parties"
        className={cn(PARTIES_COL, "truncate text-muted-foreground")}
        title={parties || undefined}
      >
        {parties || empty}
      </TableCell>
      {status ? (
        <TableCell data-testid="data-room-status" className={MID_COL}>
          {/* A read that timed out shows as Failed here, with Try again on the row. A failed file says so in its red reason instead. */}
          {label && item.status !== "failed" ? (
            <Badge variant={stuck ? "destructive" : "secondary"}>
              {stuck ? statusLabel("failed") : label}
            </Badge>
          ) : null}
        </TableCell>
      ) : null}
      <TableCell className="pe-0">
        <ItemMenu
          item={item}
          onAction={o.onAction}
          canRetry={canRetryItem(item)}
          agents={o.agents}
          onSendToAgent={o.onSendToAgent}
          triggerTabIndex={-1}
          className={ROW_ACTIONS}
        />
      </TableCell>
    </FileContext>
  );
}

/** Shared by the file tiles and the sub-folder tiles, so a grid reads as one set of tiles. */
const TILE_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 py-3 px-4 md:px-7 @min-[800px]/bd:ps-2";
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
  status = true,
}: {
  folders: DataRoomApiFolder[];
  onOpen: (id: string) => void;
  onAction: (action: ItemAction, folder: DataRoomApiFolder) => void;
  /** What a folder holds ("3 items"), so a parent never looks emptier than it is. */
  contents: (folder: DataRoomApiFolder) => string;
  tiles?: boolean;
  /** The list below shows a Status column. */
  status?: boolean;
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
  // Rows of the file table's columns (its own body), so the sub-folders line up with the files.
  return (
    <TableBody aria-label={t`Sub-folders`}>
      {folders.map((folder) => (
        <TableRow key={folder.id} className="group/row h-11">
          <TableCell>
            <Button
              variant="ghost"
              onClick={() => onOpen(folder.id)}
              className="h-auto min-h-5 max-w-full min-w-0 justify-start gap-2 rounded-sm p-0 text-start text-sm font-normal hover:bg-transparent"
            >
              <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate" title={folder.name}>
                {folder.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{contents(folder)}</span>
            </Button>
          </TableCell>
          <TableCell colSpan={status ? 3 : 2} className={MID_COL} />
          <TableCell className={PARTIES_COL} />
          <TableCell className="pe-0">
            <ItemMenu item={folder} onAction={onAction} className={ROW_ACTIONS} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

/**
 * The files as a table; search results too, with the text that matched under each. `lead` (the
 * open folder's sub-folders) goes under the column header, above the files, in the same columns.
 */
export function ListView({
  rows,
  o,
  lead,
  sortField,
}: {
  rows: Row[];
  o: RowInteraction;
  lead?: (status: boolean) => ReactNode;
  /** The field the list is sorted by; the Date column shows it. Without one: when added. */
  sortField?: SortField;
}) {
  // Only a row that is being read (or timed out) has anything to say there; a failed row says it in red.
  const status = rows.some(
    ({ item }) => item.status !== "failed" && !!statusLabel(item.status, !!item.previewText),
  );
  return (
    <div className={LIST_PAD}>
      <Table>
        <Columns status={status} snippets={rows.some((row) => row.snippets.length > 0)} />
        <ListHead sortField={sortField} rows={rows} o={o} status={status} />
        {lead?.(status)}
        <TableBody aria-label={t`Items`} data-rows>
          {rows.map(({ item, snippets }, index) => (
            <ItemRow
              key={item.id}
              item={item}
              snippets={snippets}
              o={o}
              sortField={sortField}
              first={index === 0}
              status={status}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The picture area at the top of a file tile: one fixed shape, so tiles line up. */
const PREVIEW_AREA =
  "relative grid aspect-4/3 w-full place-items-center @min-[640px]/list:aspect-4/5 overflow-hidden rounded-md bg-muted [&>svg]:size-6";

/**
 * The drawn thumbnail, fetched with the session once the tile nears the screen. The file icon
 * shows until it arrives, and stays if it cannot be read.
 */
function ThumbnailImage({ item }: { item: DataRoomApiItem }) {
  const [near, setNear] = useState(typeof IntersectionObserver === "undefined");
  const [url, setUrl] = useState("");
  const area = useRef<HTMLSpanElement>(null);
  const { id } = item;
  useEffect(() => {
    const node = area.current;
    if (near || !node) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  useEffect(() => {
    if (!near) return;
    let live = true;
    let made = "";
    dataRoomThumbnailUrl({ id })
      .then((next) => {
        made = next;
        if (live) setUrl(next);
        else URL.revokeObjectURL(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [near, id]);
  return (
    <span ref={area} className={PREVIEW_AREA}>
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className={cn(
            "absolute inset-0 size-full",
            item.mimeType === "application/pdf" ? "object-contain object-top" : "object-cover",
          )}
        />
      ) : (
        <Marker item={item} />
      )}
    </span>
  );
}

/** The first lines of a sheet, document or text file, as a small page; amounts follow the hide switch. */
function TextPreview({ item, text }: { item: DataRoomApiItem; text: string }) {
  const sheet = isSheet(item);
  const shown = maskCurrencyWhenHidden(sheet ? text.replaceAll("\t", " | ") : text);
  return (
    <span className={cn(PREVIEW_AREA, "place-items-start bg-card p-2")}>
      <span
        aria-hidden="true"
        className={cn(
          "size-full overflow-hidden pe-7 text-start text-[9px] leading-snug text-foreground/70",
          sheet ? "font-mono whitespace-pre" : "break-words whitespace-pre-wrap",
        )}
      >
        {shown}
      </span>
    </span>
  );
}

/**
 * What a file tile shows above its name: the thumbnail of a PDF or image, the start of the text
 * of a sheet or document, or else the file icon (also while reading, on failure, and for a
 * thumbnail while amounts are hidden, since it cannot be masked).
 */
function TilePreview({ item }: { item: DataRoomApiItem }) {
  const hidden = useHideAmounts();
  if (item.status !== "failed") {
    if (item.hasThumbnail && !hidden) return <ThumbnailImage item={item} />;
    const picture = item.mimeType.startsWith("image/") || item.mimeType === "application/pdf";
    if (!picture && item.previewText) return <TextPreview item={item} text={item.previewText} />;
  }
  return (
    <span className={PREVIEW_AREA}>
      <Marker item={item} />
    </span>
  );
}

export function GridView({
  rows,
  o,
  sortField,
}: {
  rows: Row[];
  o: RowInteraction;
  sortField?: SortField;
}) {
  return (
    <ul aria-label={t`Items`} data-rows className={TILE_GRID}>
      {rows.map(({ item }, index) => (
        <FileContext
          key={item.id}
          item={item}
          o={o}
          render={
            <li
              {...rowProps(item, o, index === 0)}
              aria-current={o.shownId === item.id}
              className={cn(
                TILE,
                o.shownId === item.id && "border-primary bg-sidebar-accent ring-1 ring-primary",
              )}
            />
          }
        >
          <TilePreview item={item} />
          <ItemMenu
            item={item}
            onAction={o.onAction}
            canRetry={canRetryItem(item)}
            agents={o.agents}
            onSendToAgent={o.onSendToAgent}
            triggerTabIndex={-1}
            className="absolute top-3 right-3 rounded-full bg-card/80"
          />
          {/* Three lines kept for every name, so tiles are one height and long names still differ. */}
          <span
            className="line-clamp-2 min-h-10 font-medium break-words @min-[640px]/list:line-clamp-3 @min-[640px]/list:min-h-15"
            title={item.name}
          >
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
            {item.status === "failed" ? (
              <>
                {/* Why, as on the list row; the reason may run to two lines. */}
                <span
                  data-testid="data-room-failed-reason"
                  className="line-clamp-2 whitespace-normal!"
                >
                  {item.error ?? t`Could not read this file`}
                </span>
              </>
            ) : statusLabel(item.status, !!item.previewText) ? (
              <span>
                {isStuck(item)
                  ? t`Taking longer than usual`
                  : statusLabel(item.status, !!item.previewText)}
              </span>
            ) : (
              <>
                {typeText(item) ? <span>{typeText(item)}</span> : null}
                <span>{datedLine(item, sortField)}</span>
              </>
            )}
          </span>
          {canRetryItem(item) ? <RetryButton item={item} o={o} /> : null}
        </FileContext>
      ))}
    </ul>
  );
}

/** "Invoice · Oct 3, 2026", for the line under a name where the columns do not fit. */
function TypeAndDate({
  item,
  sortField,
}: {
  item: DataRoomApiItem;
  sortField: SortField | undefined;
}) {
  return <>{[typeText(item), datedLine(item, sortField)].filter(Boolean).join(" · ")}</>;
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
