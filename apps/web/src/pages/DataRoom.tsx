import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { Button, Dialog, DialogContent, Skeleton, Toggle } from "@rakazo/ui-web";
import { LayoutGrid, List, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataRoomConsentPrompt } from "../components/data-room/ConsentPrompt";
import { FilterBar, sourceLabels } from "../components/data-room/FilterBar";
import { FolderTree } from "../components/data-room/FolderTree";
import { folderNodes } from "../components/data-room/folders";
import { ImportSources } from "../components/data-room/ImportFromEmail";
import { type DataRoomEntry, ItemDialog, isFolder } from "../components/data-room/ItemDialogs";
import type { ItemAction } from "../components/data-room/ItemMenu";
import {
  GridView,
  ListView,
  ResultsView,
  type RowInteraction,
  SubfolderList,
} from "../components/data-room/ItemRows";
import { Preview } from "../components/data-room/Preview";
import {
  setOpenDataRoomFolder,
  showDeletedToast,
  uploadFilesToDataRoom,
} from "../components/data-room/upload-toasts";
import {
  type Filters,
  type Sort,
  useDataRoomList,
} from "../components/data-room/use-data-room-list";
import { DATA_ROOM_CHANGED, readDataRoomView, saveDataRoomView } from "../lib/data-room";
import { rpc } from "../lib/rpc";

const SEARCH_DEBOUNCE_MS = 300;
const NOTICE_MS = 6_000;
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
  const [params, setParams] = useSearchParams();
  const linkedItem = params.get("item");
  const urlFolder = params.get("folder") ?? undefined;
  // View and sort are remembered for this browser.
  const [saved] = useState(readDataRoomView);
  const [view, setView] = useState<"list" | "grid">(saved.view);
  const [queryInput, setQueryInput] = useState("");
  const debouncedQuery = useDebounced(queryInput.trim(), SEARCH_DEBOUNCE_MS);
  // Clearing the box shows the list again at once; only typing waits for a pause.
  const query = queryInput.trim() === "" ? "" : debouncedQuery;
  // The open folder lives in the URL and nothing else does: a reload, a bookmark, a shared link or
  // the Back button opens the folder again. The other filters are page state.
  const [otherFilters, setOtherFilters] = useState<Omit<Filters, "folderId">>({});
  const filters = useMemo<Filters>(
    () => (urlFolder ? { ...otherFilters, folderId: urlFolder } : otherFilters),
    [otherFilters, urlFolder],
  );
  const urlFolderRef = useRef(urlFolder);
  urlFolderRef.current = urlFolder;
  // setParams changes with every navigation; the callbacks below must not.
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  /** A folder the user chose is a new history entry; one the page chose replaces the current. */
  const setFilters = useCallback(
    ({ folderId, ...rest }: Filters, replace = false) => {
      setOtherFilters(rest);
      if (folderId === urlFolderRef.current) return;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (folderId) next.set("folder", folderId);
          else next.delete("folder");
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );
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
      .then((next) => {
        setFolders(next);
        // A folder that no longer exists (deleted, or a stale link) falls back to All items.
        const open = urlFolderRef.current;
        if (open && !next.some((folder) => folder.id === open)) {
          setParamsRef.current(
            (prev) => {
              const params = new URLSearchParams(prev);
              params.delete("folder");
              return params;
            },
            { replace: true },
          );
        }
      })
      .catch(() => undefined);
  }, []);
  useEffect(reloadFolders, [reloadFolders]);
  // Files added while a folder is open go into it, wherever they are dropped.
  useEffect(() => {
    setOpenDataRoomFolder(filters.folderId);
    return () => setOpenDataRoomFolder(undefined);
  }, [filters.folderId]);
  const nodes = useMemo(() => folderNodes(folders), [folders]);
  const subfolders = useMemo(
    () =>
      searching || filters.folderId === undefined
        ? []
        : nodes.map(({ folder }) => folder).filter((f) => f.parentId === filters.folderId),
    [nodes, searching, filters.folderId],
  );
  const folderPath = useCallback(
    (id: string | null) => nodes.find(({ folder }) => folder.id === id)?.path ?? "",
    [nodes],
  );

  const reload = list.reload;
  useEffect(() => {
    window.addEventListener(DATA_ROOM_CHANGED, reload);
    return () => window.removeEventListener(DATA_ROOM_CHANGED, reload);
  }, [reload]);

  // Preview: a click (or Enter) on a row shows it; clicking the shown row again closes the pane.
  // The pointer alone never changes it, so the highlight stays on the row the user chose. Nothing
  // is previewed until the user picks a file.
  const [pinned, setPinned] = useState<DataRoomApiItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  // Narrow: the preview has no room beside the list, so a tap opens it in a dialog.
  const [narrow, setNarrow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  // The dialog belongs to one width: resizing never opens it, and closes it when the page widens.
  useEffect(() => {
    setDialogOpen(false);
  }, [narrow]);

  /** The item a link opened: the first answer after it keeps it, even beyond the first page. */
  const explicit = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedItem) return;
    // Only the item that is still in the URL when the answer arrives may be shown.
    let current = true;
    rpc.dataRoom
      .item({ id: linkedItem })
      .then((item) => {
        if (!current || item.id !== linkedItem) return;
        // Show the folder the item is in, so the list and the preview agree.
        setQueryInput("");
        setFilters(item.folderId ? { folderId: item.folderId } : {}, true);
        explicit.current = item.id;
        setPinned(item);
        setPreviewOpen(true);
        setDialogOpen(true);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [linkedItem]);

  // When a new search, filter, folder or sort answers, keep the pinned item only if it is in the
  // results; otherwise close the preview. Another item is never picked for the user.
  const queryKey = JSON.stringify({ query, filters, sort });
  const appliedKey = useRef<string | null>(null);
  const resultIds = list.rows.map((row) => row.item.id).join(",");
  useEffect(() => {
    if (list.loading || list.key !== queryKey || appliedKey.current === queryKey) return;
    const first = appliedKey.current === null;
    appliedKey.current = queryKey;
    if (first || !pinned || resultIds.split(",").includes(pinned.id)) return;
    if (explicit.current === pinned.id) {
      explicit.current = null;
      return;
    }
    setPinned(null);
  }, [list.loading, list.key, queryKey, resultIds, pinned]);

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
    });
  }, [list.loading, list.key, queryKey, resultIds, pinned]);

  const fresh = (item: DataRoomApiItem | null) =>
    item ? (list.rows.find((row) => row.item.id === item.id)?.item ?? item) : null;
  const shown = previewOpen ? fresh(pinned) : null;

  const interaction: RowInteraction = {
    shownId: shown?.id,
    onSelect: (item) => {
      if (narrow) return;
      explicit.current = null;
      setPinned(item);
      setPreviewOpen(true);
    },
    onToggle: (item) => {
      explicit.current = null;
      if (!narrow && pinned?.id === item.id && previewOpen) {
        setPinned(null);
        setPreviewOpen(false);
      } else {
        setPinned(item);
        setPreviewOpen(true);
        setDialogOpen(narrow);
      }
    },
    onAction: (kind, item) => setAction({ kind, item }),
    folderPath,
    openFolderId: filters.folderId,
  };

  const [action, setAction] = useState<{ kind: ItemAction; item: DataRoomEntry } | null>(null);

  function closePreview() {
    const id = shown?.id;
    setPinned(null);
    setPreviewOpen(false);
    setDialogOpen(false);
    // Keep the keyboard where the user was.
    if (id) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)?.focus(),
      );
    }
  }

  const [notice, setNotice] = useState("");
  const showNotice = useCallback((message: string, changed: boolean) => {
    setNotice(message);
    if (changed) window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const hasFilters = Object.values(filters).some(Boolean);
  // Only rows that answer the query now asked count: for one render after a search is cleared, the
  // old empty results are still in hand, and must not flash the first-run screen.
  const empty =
    !list.loading &&
    list.key === queryKey &&
    list.rows.length === 0 &&
    !list.error &&
    !searching &&
    !hasFilters;
  const rows = list.rows;
  const uniq = (values: string[]) => [...new Set(values)].sort();
  const subfolderList = (
    <SubfolderList
      tiles={view === "grid"}
      folders={subfolders}
      onOpen={(folderId) => setFilters({ ...filters, folderId })}
      onAction={(kind, folder) => setAction({ kind, item: folder })}
    />
  );
  /** A filter other than the folder is set. */
  const filtered = Object.entries(filters).some(([key, value]) => key !== "folderId" && value);
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
            <ImportSources compact folderId={filters.folderId ?? null} onDone={showNotice} />
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
            <div className="flex flex-wrap justify-center gap-2">
              <FileInputButton>
                <Trans>Choose files</Trans>
              </FileInputButton>
              <ImportSources folderId={null} onDone={showNotice} />
            </div>
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
            onFilters={(next) => setFilters(next)}
            sort={sort}
            onSort={(next) => (searching ? setSearchSort(next) : next && setListSort(next))}
            types={uniq(rows.flatMap(({ item }) => item.facets.docType ?? []))}
            parties={uniq(rows.flatMap(({ item }) => item.facets.parties))}
            // The server has no list of sources, so offer every known one beside those on screen.
            sources={uniq([...Object.keys(sourceLabels()), ...rows.map(({ item }) => item.source)])}
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
              ) : rows.length === 0 && !list.error && !subfolders.length ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  {/* An open folder with nothing in it is empty, not a search that found nothing. */}
                  {!searching && !filtered ? (
                    <p>
                      <Trans>This folder is empty. Drop files here to add them.</Trans>
                    </p>
                  ) : (
                    <p>
                      <Trans>No results</Trans>
                    </p>
                  )}
                  {searching ? (
                    <p className="text-xs">
                      {query.includes(" ") ? (
                        <Trans>Search matches words in names and text. Try fewer words.</Trans>
                      ) : (
                        <Trans>Search matches words in names and text.</Trans>
                      )}
                    </p>
                  ) : null}
                  {filtered ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <Trans>Clear filters</Trans>
                    </Button>
                  ) : null}
                </div>
              ) : searching ? (
                <ResultsView rows={rows} o={interaction} />
              ) : view === "grid" ? (
                <>
                  {subfolderList}
                  <GridView rows={rows} o={interaction} />
                </>
              ) : (
                <ListView rows={rows} o={interaction} lead={subfolderList} />
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
      {shown && narrow && dialogOpen ? (
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
              // Deleting the previewed item shows its neighbour, so the pane stays and the list
              // does not jump. The last item closes it.
              if (pinned?.id === action.item.id) {
                const at = rows.findIndex((row) => row.item.id === action.item.id);
                setPinned(narrow ? null : ((rows[at + 1] ?? rows[at - 1])?.item ?? null));
              }
              showDeletedToast(action.item.name);
            } else if (updated && !isFolder(updated) && pinned?.id === updated.id) {
              setPinned(updated);
            }
            list.reload();
            reloadFolders();
          }}
        />
      ) : null}
      {notice ? (
        <p
          role="status"
          className="fixed end-4 bottom-20 z-100 rounded-lg border border-border bg-card p-3 text-sm shadow-md"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
