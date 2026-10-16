import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { Button, Dialog, DialogContent, Skeleton, Toggle } from "@rakazo/ui-web";
import { LayoutGrid, List, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataRoomConsentPrompt } from "../components/data-room/ConsentPrompt";
import { FilterBar } from "../components/data-room/FilterBar";
import { FolderTree } from "../components/data-room/FolderTree";
import { folderNodes } from "../components/data-room/folders";
import { ItemDialog } from "../components/data-room/ItemDialogs";
import type { ItemAction } from "../components/data-room/ItemMenu";
import {
  GridView,
  ListView,
  ResultsView,
  type RowInteraction,
} from "../components/data-room/ItemRows";
import { Preview } from "../components/data-room/Preview";
import {
  setOpenDataRoomFolder,
  uploadFilesToDataRoom,
} from "../components/data-room/upload-toasts";
import {
  type Filters,
  type Sort,
  useDataRoomList,
} from "../components/data-room/use-data-room-list";
import { DATA_ROOM_CHANGED, readDataRoomView, saveDataRoomView } from "../lib/data-room";
import { rpc } from "../lib/rpc";

const HOVER_MS = 150;
const SEARCH_DEBOUNCE_MS = 300;
/** Below this width of the page body the preview covers the list instead of sitting beside it. */
const PREVIEW_BESIDE_PX = 560;

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function FileInputButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-testid="data-room-file-input"
        onChange={(event) => {
          uploadFilesToDataRoom(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <Button {...props} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </>
  );
}

/** The Data room: folders, a list or grid of filed items, and a preview of one of them. */
export function DataRoomPage() {
  const [params] = useSearchParams();
  const linkedItem = params.get("item");
  // View and sort are remembered for this browser.
  const [saved] = useState(readDataRoomView);
  const [view, setView] = useState<"list" | "grid">(saved.view);
  const [queryInput, setQueryInput] = useState("");
  const query = useDebounced(queryInput.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState<Filters>({});
  // "Recently added" first, so a file just filed is on top even before it has a document date.
  const [listSort, setListSort] = useState<Sort>(saved.sort);
  useEffect(() => saveDataRoomView({ view, sort: listSort }), [view, listSort]);
  // Null orders a search by relevance.
  const [searchSort, setSearchSort] = useState<Sort | null>(null);
  const searching = query !== "";
  const sort = searching ? searchSort : listSort;
  const list = useDataRoomList({ query, filters, sort });

  const [folders, setFolders] = useState<DataRoomApiFolder[]>([]);
  const reloadFolders = useCallback(() => {
    rpc.dataRoom
      .folders()
      .then(setFolders)
      .catch(() => undefined);
  }, []);
  useEffect(reloadFolders, [reloadFolders]);
  // Files added while a folder is open go into it, wherever they are dropped.
  useEffect(() => {
    setOpenDataRoomFolder(filters.folderId);
    return () => setOpenDataRoomFolder(undefined);
  }, [filters.folderId]);
  const nodes = useMemo(() => folderNodes(folders), [folders]);
  const folderPath = useCallback(
    (id: string | null) => nodes.find(({ folder }) => folder.id === id)?.path ?? "",
    [nodes],
  );

  const reload = list.reload;
  useEffect(() => {
    window.addEventListener(DATA_ROOM_CHANGED, reload);
    return () => window.removeEventListener(DATA_ROOM_CHANGED, reload);
  }, [reload]);

  // Preview: hovering or focusing a row shows it; a click pins it; clicking the pinned row closes the pane.
  const [pinned, setPinned] = useState<DataRoomApiItem | null>(null);
  const [hovered, setHovered] = useState<DataRoomApiItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Narrow: the preview has no room beside the list, so a click opens it in a dialog.
  const [narrow, setNarrow] = useState(false);
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bodyEl) return;
    const measure = () =>
      setNarrow(bodyEl.clientWidth > 0 && bodyEl.clientWidth < PREVIEW_BESIDE_PX);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bodyEl);
    return () => observer.disconnect();
  }, [bodyEl]);
  const autoPinned = useRef(false);
  // Narrow, the preview is a dialog that only a tap opens: drop a pin made while wide.
  useEffect(() => {
    if (narrow) setPinned(null);
  }, [narrow]);
  /** The row the pointer is over, so moving within it does not restart the hover delay. */
  const hoverTarget = useRef<string | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!linkedItem) return;
    // Only the item that is still in the URL when the answer arrives may be shown.
    let current = true;
    rpc.dataRoom
      .item({ id: linkedItem })
      .then((item) => {
        if (!current || item.id !== linkedItem) return;
        autoPinned.current = true;
        // Show the folder the item is in, so the list and the preview agree.
        setQueryInput("");
        setFilters(item.folderId ? { folderId: item.folderId } : {});
        setPinned(item);
        setHovered(null);
        setPreviewOpen(true);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [linkedItem]);

  // The first item is pinned once, when there is room for the preview beside the list.
  const firstItem = list.rows[0]?.item;
  useEffect(() => {
    if (autoPinned.current || !firstItem || linkedItem) return;
    autoPinned.current = true;
    if (!narrow) setPinned(firstItem);
  }, [firstItem, linkedItem, narrow]);

  // When a new search, filter, folder or sort answers, keep the pinned item only if it is in the
  // results; otherwise pin the first result, or close the preview when there are none.
  const queryKey = JSON.stringify({ query, filters, sort });
  const appliedKey = useRef<string | null>(null);
  const resultIds = list.rows.map((row) => row.item.id).join(",");
  useEffect(() => {
    if (list.loading || list.key !== queryKey || appliedKey.current === queryKey) return;
    const first = appliedKey.current === null;
    appliedKey.current = queryKey;
    if (first || (pinned && resultIds.split(",").includes(pinned.id))) return;
    setHovered(null);
    setPinned(previewOpen && !narrow ? (list.rows[0]?.item ?? null) : null);
  }, [list.loading, list.key, list.rows, queryKey, resultIds, pinned, previewOpen, narrow]);

  // A reload of the same query can drop the pinned item (moved or deleted elsewhere). If it can no
  // longer be read, close its preview.
  const wasLoading = useRef(false);
  useEffect(() => {
    const finished = wasLoading.current && !list.loading;
    wasLoading.current = list.loading;
    if (!finished || list.key !== queryKey || !pinned || resultIds.split(",").includes(pinned.id)) {
      return;
    }
    const id = pinned.id;
    rpc.dataRoom.item({ id }).catch(() => {
      setPinned((current) => (current?.id === id ? null : current));
      setHovered((current) => (current?.id === id ? null : current));
    });
  }, [list.loading, list.key, queryKey, resultIds, pinned]);

  const fresh = (item: DataRoomApiItem | null) =>
    item ? (list.rows.find((row) => row.item.id === item.id)?.item ?? item) : null;
  const shown = previewOpen ? fresh(hovered ?? pinned) : null;

  const interaction: RowInteraction = {
    shownId: shown?.id,
    onHover: (item) => {
      if (narrow || hoverTarget.current === item.id) return;
      hoverTarget.current = item.id;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setHovered(item), HOVER_MS);
    },
    onLeave: () => {
      hoverTarget.current = null;
      if (narrow) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setHovered(null), HOVER_MS);
    },
    onFocusItem: (item) => {
      if (narrow) return;
      clearTimeout(timer.current);
      setHovered(item);
    },
    onToggle: (item) => {
      clearTimeout(timer.current);
      setHovered(null);
      if (pinned?.id === item.id && previewOpen) {
        setPinned(null);
        setPreviewOpen(false);
      } else {
        setPinned(item);
        setPreviewOpen(true);
      }
    },
    onAction: (kind, item) => setAction({ kind, item }),
    folderPath,
  };

  const [action, setAction] = useState<{ kind: ItemAction; item: DataRoomApiItem } | null>(null);

  function closePreview() {
    const id = shown?.id;
    setPinned(null);
    setHovered(null);
    setPreviewOpen(false);
    // Keep the keyboard where the user was.
    if (id) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)?.focus(),
      );
    }
  }

  const hasFilters = Object.values(filters).some(Boolean);
  const empty = !list.loading && list.rows.length === 0 && !list.error && !searching && !hasFilters;
  const rows = list.rows;
  const uniq = (values: string[]) => [...new Set(values)].sort();
  const clearFilters = () => setFilters(filters.folderId ? { folderId: filters.folderId } : {});

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-2 pb-3 md:px-5 md:pt-4">
        <h1 className="me-auto text-lg font-semibold">
          <Trans>Data room</Trans>
        </h1>
        {empty ? null : (
          <>
            <fieldset className="m-0 flex min-w-0 gap-0.5 border-0 p-0">
              <legend className="sr-only">{t`View`}</legend>
              <Toggle
                size="sm"
                pressed={view === "list"}
                onPressedChange={() => setView("list")}
                aria-label={t`List view`}
              >
                <List aria-hidden="true" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={view === "grid"}
                onPressedChange={() => setView("grid")}
                aria-label={t`Grid view`}
              >
                <LayoutGrid aria-hidden="true" />
              </Toggle>
            </fieldset>
            <FileInputButton variant="outline" size="icon" aria-label={t`Add files`}>
              <Plus aria-hidden="true" />
            </FileInputButton>
          </>
        )}
      </div>
      {empty ? (
        <div className="grid flex-1 place-items-center p-6">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
            <Upload aria-hidden="true" className="size-7 text-muted-foreground" />
            <p className="text-sm font-medium">
              <Trans>Drop files here</Trans>
            </p>
            <FileInputButton>
              <Trans>Choose files</Trans>
            </FileInputButton>
          </div>
        </div>
      ) : (
        <>
          <div className="px-3 pb-2.5 empty:hidden md:px-5">
            <DataRoomConsentPrompt onAllowed={list.reload} />
          </div>
          <FilterBar
            query={queryInput}
            onQuery={setQueryInput}
            searching={searching}
            filters={filters}
            onFilters={setFilters}
            sort={sort}
            onSort={(next) => (searching ? setSearchSort(next) : next && setListSort(next))}
            types={uniq(rows.flatMap(({ item }) => item.facets.docType ?? []))}
            parties={uniq(rows.flatMap(({ item }) => item.facets.parties))}
            sources={uniq(rows.map(({ item }) => item.source))}
            hasDates={rows.some(({ item }) => item.facets.docDate)}
            folders={nodes}
            folderId={filters.folderId}
            onFolder={(folderId) => setFilters({ ...filters, folderId })}
          />
          <div ref={setBodyEl} className="relative flex min-h-0 flex-1 border-t border-border">
            <div className="hidden @min-[800px]/bd:flex">
              <FolderTree
                nodes={nodes}
                selected={filters.folderId}
                onSelect={(folderId) => setFilters({ ...filters, folderId })}
              />
            </div>
            <div
              data-testid="data-room-list"
              className="@container/list rk-scroll min-w-0 flex-1 overflow-y-auto"
            >
              {list.error ? (
                <div className="flex items-center gap-3 p-4 text-sm text-destructive">
                  {list.error}
                  <Button variant="outline" size="sm" onClick={list.reload}>
                    <Trans>Retry</Trans>
                  </Button>
                </div>
              ) : null}
              {list.loading && rows.length === 0 ? (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-8 w-full" />
                  ))}
                </div>
              ) : rows.length === 0 && !list.error ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <p>
                    <Trans>No results</Trans>
                  </p>
                  {searching ? (
                    <p className="text-xs">
                      <Trans>Search matches words in names and text. Try one word.</Trans>
                    </p>
                  ) : null}
                  {Object.entries(filters).some(([key, value]) => key !== "folderId" && value) ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <Trans>Clear filters</Trans>
                    </Button>
                  ) : null}
                </div>
              ) : searching ? (
                <ResultsView rows={rows} o={interaction} />
              ) : view === "grid" ? (
                <GridView rows={rows} o={interaction} />
              ) : (
                <ListView rows={rows} o={interaction} />
              )}
              {list.nextCursor ? (
                <div className="grid place-items-center p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={list.loadingMore || list.loading}
                    onClick={() => void list.loadMore()}
                  >
                    <Trans>Load more</Trans>
                  </Button>
                </div>
              ) : null}
            </div>
            {shown && !narrow ? (
              <Preview
                item={shown}
                folderPath={folderPath(shown.folderId)}
                onAction={interaction.onAction}
                onClose={closePreview}
              />
            ) : null}
          </div>
        </>
      )}
      {shown && narrow ? (
        <Dialog open onOpenChange={(open) => !open && closePreview()}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto p-0">
            <Preview
              inDialog
              item={shown}
              folderPath={folderPath(shown.folderId)}
              onAction={interaction.onAction}
              onClose={closePreview}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      {action ? (
        <ItemDialog
          action={action.kind}
          item={action.item}
          folders={nodes}
          onClose={() => setAction(null)}
          onDone={(kind, updated) => {
            if (kind === "delete") {
              if (pinned?.id === action.item.id) setPinned(null);
              if (hovered?.id === action.item.id) setHovered(null);
            } else if (updated && pinned?.id === updated.id) {
              setPinned(updated);
            }
            list.reload();
            reloadFolders();
          }}
        />
      ) : null}
    </div>
  );
}
