import { t as translate } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Artifact, ArtifactShare, ArtifactVersion, Bot } from "@rakazo/contracts";
import { isShareableArtifactMimeType } from "@rakazo/contracts";
import { matchesArtifactQuery, mimeBadgeLabel } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  BotAvatar,
  Button,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Toggle,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import {
  ArrowLeft,
  Download,
  FileText,
  LayoutGrid,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Share2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArtifactPreview } from "../components/ArtifactPreview";
import { ArtifactShareDialog } from "../components/ArtifactShareDialog";
import { AskBotButton } from "../components/AskBotButton";
import { Tip } from "../components/data-room/FilterBar";
import { ErrorNotice } from "../components/ErrorNotice";
import { PickFilter, SearchField, SortControl } from "../components/ListControls";
import { PageEmptyState } from "../components/PageEmptyState";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { StillLoading } from "../components/ShellSkeleton";
import { artifactDisplayName as displayName } from "../lib/artifact-name";
import { bytesToBase64, decodeArtifactBase64, openArtifactBytes } from "../lib/artifact-open";
import { sortBy, useListParams } from "../lib/list-params";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { canPreviewSpreadsheet } from "../lib/spreadsheet";
import { useDebounced } from "../lib/use-debounced";
import { errorText } from "../lib/user-error";

type ViewMode = "grid" | "list";
type DateFilter = "all" | "today" | "week" | "month";
const DATE_FILTERS = ["today", "week", "month"] as const;
const ARTIFACT_SORTS = ["name", "bot", "type", "added"] as const;
type ArtifactSort = (typeof ARTIFACT_SORTS)[number];
/** The server lists newest first; that stays the default. */
const DEFAULT_ARTIFACT_SORT = { field: "added", dir: "desc" } as const;
const VIEW_MODE_STORAGE_KEY = "rakazo:artifacts-view-mode";
const LIST_PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 300;

type ArtifactSummary = Artifact & { versionCount: number };

const isSheet = (mimeType: string) => /csv|spreadsheet|excel/.test(mimeType);

/** A locale-independent key for an artifact's kind, safe to keep in the URL. */
function kindKey(mimeType: string): string {
  if (mimeType === "text/html") return "page";
  if (mimeType === "text/markdown") return "doc";
  if (isSheet(mimeType)) return "sheet";
  return mimeBadgeLabel(mimeType);
}

/** Plain words for the card badge: Maya knows a Doc, a Sheet and a Page, not MD, CSV and HTML. */
function kindLabel(mimeType: string): string {
  const key = kindKey(mimeType);
  if (key === "page") return translate`Page`;
  if (key === "doc") return translate`Doc`;
  if (key === "sheet") return translate`Sheet`;
  return key;
}

/** The saved choice; with none, a phone gets the list (one card fills most of its screen). */
function readViewMode(): ViewMode {
  const phone =
    typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
  try {
    const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === "list" || saved === "grid") return saved;
  } catch {
    // No storage: use the default below.
  }
  return phone ? "list" : "grid";
}

function writeViewMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Preference only; ignore storage failures.
  }
}

function matchesCalendarDateFilter(iso: string, filter: DateFilter, now: Date): boolean {
  if (filter === "all") return true;
  const date = new Date(iso);
  if (filter === "today") return date.toDateString() === now.toDateString();
  if (filter === "week") {
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return date >= startOfWeek;
  }
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function ArtifactsPage({
  spaceName,
  onAskAgent,
  bots = [],
}: {
  spaceName?: string;
  onAskAgent?: () => void;
  /** The shell's bots, so the page does not ask the server for them again. */
  bots?: Bot[];
}) {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const navigate = useNavigate();
  const artifactPath = useArtifactPath();
  const { t } = useLingui();
  const [items, setItems] = useState<ArtifactSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The search the shown first page answers; while the box says something else, a search is pending.
  const [listedQuery, setListedQuery] = useState<string | null>(null);
  // Bumping this asks for the listing again after a failure; the retry shows the skeleton meanwhile.
  const [reloadKey, setReloadKey] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const listingGenerationRef = useRef(0);
  const listedBotIdRef = useRef<string | null | undefined>(undefined);
  // Search, filters and sort live in the URL; the palette's "See all in Artifacts" arrives as ?q=.
  const list = useListParams(ARTIFACT_SORTS, DEFAULT_ARTIFACT_SORT);
  const searchQuery = list.param("q") ?? "";
  // Typing narrows what is shown at once; the server is asked once the query settles.
  const serverQuery = useDebounced(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const activeBotId = list.param("bot") ?? null;
  const typeFilter = list.param("type");
  const askedDate = list.param("added");
  const dateFilter: DateFilter = DATE_FILTERS.find((d) => d === askedDate) ?? "all";
  // Bots that own at least one artifact. Only grows, so filtering to one bot keeps the others listed.
  const [ownerBotIds, setOwnerBotIds] = useState<ReadonlySet<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [maximized, setMaximized] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ArtifactSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The dialog names the artifact as the list does, without the extension.
  const deleteTitle = pendingDelete ? displayName(pendingDelete.name) : "";
  // Deleting also ends a live share link; the dialog says so only when there is one.
  const [deleteShared, setDeleteShared] = useState(false);
  useEffect(() => {
    setDeleteShared(false);
    if (!pendingDelete) return;
    let cancelled = false;
    void rpc.artifactShares
      .get({ artifactId: pendingDelete.id })
      .then((share) => !cancelled && setDeleteShared(share !== null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pendingDelete]);

  useEffect(() => {
    let cancelled = false;
    listingGenerationRef.current += 1;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    // A new query replaces the same list, so the current items stay until its first page lands.
    const botChanged = listedBotIdRef.current !== activeBotId;
    listedBotIdRef.current = activeBotId;
    if (botChanged) setItems(null);
    setLoadError(null);
    setLoadMoreError(null);
    setNextCursor(null);
    void rpc.artifacts
      .listSpace({
        botId: activeBotId ?? undefined,
        q: serverQuery || undefined,
        limit: LIST_PAGE_SIZE,
      })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setListedQuery(serverQuery);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // Clearing the list shows the error with Try again instead of the previous search's rows.
          setItems(null);
          setLoadError(errorText(error, t`Could not load artifacts.`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBotId, serverQuery, reloadKey, t]);

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = listingGenerationRef.current;
    const listingChanged = () => generation !== listingGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await rpc.artifacts.listSpace({
        botId: activeBotId ?? undefined,
        q: serverQuery || undefined,
        cursor: nextCursor,
        limit: LIST_PAGE_SIZE,
      });
      if (listingChanged()) return;
      setItems((current) => (current ?? []).concat(page.items));
      setNextCursor(page.nextCursor);
    } catch (error) {
      // Keep the current page so Load more can be retried.
      if (!listingChanged()) {
        setLoadMoreError(errorText(error, t`Could not load artifacts.`));
        autoPageFailedRef.current = true;
      }
    } finally {
      if (!listingChanged()) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    setMaximized(false);
  }, [artifactId]);

  useEffect(() => {
    if (!items) return;
    setOwnerBotIds((prev) => {
      const next = new Set(prev);
      for (const item of items) if (item.botId) next.add(item.botId);
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const ownerBots = useMemo(
    () => bots.filter((bot) => ownerBotIds.has(bot.id)),
    [bots, ownerBotIds],
  );

  // Every card would show the same author when one bot made them all, so names appear only for several.
  const botsById = useMemo(
    () => new Map(ownerBots.length > 1 ? bots.map((bot) => [bot.id, bot]) : []),
    [bots, ownerBots],
  );

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const now = new Date();
    const kept = items.filter(
      (item) =>
        matchesCalendarDateFilter(item.createdAt, dateFilter, now) &&
        (!typeFilter || kindKey(item.mimeType) === typeFilter) &&
        matchesArtifactQuery(item, searchQuery),
    );
    // ponytail: the list API has no order parameter, so sorting covers only the loaded pages;
    // pass the sort to listSpace (and its cursor) to sort the whole space.
    const botName = (item: ArtifactSummary) => bots.find((b) => b.id === item.botId)?.name;
    const pick = {
      name: (item: ArtifactSummary) => displayName(item.name),
      bot: botName,
      type: (item: ArtifactSummary) => kindLabel(item.mimeType),
      added: (item: ArtifactSummary) => item.createdAt,
    }[list.sort.field];
    return sortBy(kept, pick, list.sort.dir);
  }, [items, searchQuery, dateFilter, typeFilter, bots, list.sort.field, list.sort.dir]);

  const typeOptions = useMemo(
    () =>
      [...new Map((items ?? []).map((i) => [kindKey(i.mimeType), kindLabel(i.mimeType)]))].sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [items],
  );

  // The server owns the search, so only the date and type filters need paging to find a match.
  const clientFilterActive = dateFilter !== "all" || typeFilter !== undefined;
  const filterActive = clientFilterActive || searchQuery.trim().length > 0 || activeBotId !== null;

  function clearFilters() {
    list.clear("q", "bot", "type", "added");
  }

  // A filter that hides the open artifact closes it, so the list never sits beside an unrelated preview.
  useEffect(() => {
    if (
      artifactId &&
      filterActive &&
      filteredItems &&
      !filteredItems.some((i) => i.id === artifactId)
    )
      navigate(artifactPath());
  }, [artifactId, filterActive, filteredItems, navigate, artifactPath]);
  const autoFetchedCursorRef = useRef<string | null>(null);
  // A page that failed on its own is not asked for again until a filter or the listing changes.
  const autoPageFailedRef = useRef(false);

  useEffect(() => {
    autoFetchedCursorRef.current = null;
    autoPageFailedRef.current = false;
  }, [searchQuery, dateFilter, typeFilter, activeBotId]);

  // Date and type filters only see loaded pages, so keep paging until something matches.
  useEffect(() => {
    if (!clientFilterActive || !nextCursor || loadingMore || items === null) return;
    if (autoPageFailedRef.current) return;
    if (filteredItems && filteredItems.length > 0) return;
    if (autoFetchedCursorRef.current === nextCursor) return;
    autoFetchedCursorRef.current = nextCursor;
    void loadMore();
  }, [clientFilterActive, nextCursor, loadingMore, items, filteredItems]);

  function setMode(mode: ViewMode) {
    setViewMode(mode);
    writeViewMode(mode);
    // The split view always lists rows; picking a view leaves it for the full list.
    if (artifactId) navigate(artifactPath());
  }

  /** A restore makes a new latest version: the row shows it without a reload. */
  function applyRestored(created: Artifact) {
    setItems(
      (current) =>
        current?.map((item) =>
          item.id === artifactId
            ? { ...item, ...created, id: item.id, versionCount: item.versionCount + 1 }
            : item,
        ) ?? current,
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await rpc.artifacts.remove({ artifactId: pendingDelete.id });
      setItems((current) => current?.filter((item) => item.id !== pendingDelete.id) ?? current);
      if (artifactId === pendingDelete.id) navigate(artifactPath());
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(errorText(error, t`Could not delete this artifact.`));
    } finally {
      setDeleteBusy(false);
    }
  }

  const viewToggle = (className: string) => (
    <fieldset className={`m-0 flex min-w-0 gap-0.5 border-0 p-0 ${className}`}>
      <legend className="sr-only">{t`View`}</legend>
      <Tip label={t`List view`}>
        <Toggle
          size="sm"
          pressed={viewMode === "list"}
          onPressedChange={() => setMode("list")}
          aria-label={t`List view`}
        >
          <List aria-hidden="true" />
        </Toggle>
      </Tip>
      <Tip label={t`Grid view`}>
        <Toggle
          size="sm"
          pressed={viewMode === "grid"}
          onPressedChange={() => setMode("grid")}
          aria-label={t`Grid view`}
        >
          <LayoutGrid aria-hidden="true" />
        </Toggle>
      </Tip>
    </fieldset>
  );

  // Until the server answers the typed search, an empty narrowing is not an answer: keep loading.
  const searchPending = items !== null && searchQuery.trim() !== listedQuery;
  const shownItems = searchPending && filteredItems?.length === 0 ? null : filteredItems;
  // Nothing to filter or switch views on until the space has an artifact.
  const nothingYet = items?.length === 0 && !nextCursor && !filterActive;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground/90">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          // The space name drops to a third row on a phone; the header stays one row there.
          className="max-md:[&_[data-page-header-meta]]:hidden"
          title={<Trans>Artifacts</Trans>}
          spaceName={spaceName}
          actions={
            <>
              {!nothingYet ? viewToggle("hidden md:flex") : null}
              {onAskAgent ? (
                <AskBotButton botName="Chief" onClick={onAskAgent} />
              ) : (
                // Chief loads after the page; keep its place so the view switch does not jump.
                <span aria-hidden="true" inert className="invisible">
                  <AskBotButton botName="Chief" onClick={() => {}} />
                </span>
              )}
            </>
          }
        />
      </div>
      {/* The list's controls go when an open document hides the list (phone, maximized). */}
      {nothingYet || (artifactId && maximized) ? null : (
        <div
          className={`${PAGE_GUTTER_X} flex-wrap items-center gap-1.5 pb-2.5 ${artifactId ? "hidden md:flex" : "flex"}`}
        >
          <SearchField
            className="w-full md:w-72"
            value={searchQuery}
            onChange={(value) => list.setParam("q", value)}
            placeholder={t`Search`}
            label={t`Search artifacts`}
            name="artifacts-search"
          />
          <PickFilter
            label={t`Added`}
            anyLabel={t`Any time`}
            value={dateFilter === "all" ? undefined : dateFilter}
            options={[
              ["today", t`Today`],
              ["week", t`This week`],
              ["month", t`This month`],
            ]}
            onChange={(next) => list.setParam("added", next)}
          />
          <PickFilter
            label={t`Type`}
            value={typeFilter}
            options={typeOptions}
            onChange={(next) => list.setParam("type", next)}
          />
          {ownerBots.length > 1 ? (
            <PickFilter
              label={t`Bot`}
              value={activeBotId ?? undefined}
              options={ownerBots.map((bot) => [bot.id, bot.name])}
              onChange={(next) => list.setParam("bot", next)}
            />
          ) : null}
          <SortControl
            fields={[
              ["name", t`Name`],
              ["bot", t`Bot`],
              ["type", t`Type`],
              ["added", t`Added`],
            ]}
            field={list.sort.field}
            fieldLabel={
              { name: t`Name`, bot: t`Bot`, type: t`Type`, added: t`Added` }[list.sort.field]
            }
            direction={list.sort.dir}
            onField={(field) => list.setSort({ field, dir: field === "added" ? "desc" : "asc" })}
            onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
          />
          {/* On a phone the header has no room for the view switch, so it waits here with the filters. */}
          {!artifactId ? viewToggle("ms-auto md:hidden") : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden border-t border-border">
        {artifactId ? (
          <>
            {!maximized ? (
              <IndexPane
                items={shownItems}
                filtered={filterActive}
                onClearFilters={clearFilters}
                loadError={loadError}
                onRetry={() => setReloadKey((key) => key + 1)}
                botsById={botsById}
                selectedId={artifactId}
                onRequestDelete={setPendingDelete}
                nextCursor={nextCursor}
                loadingMore={loadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={() => void loadMore()}
              />
            ) : null}
            <PreviewPane
              key={artifactId}
              artifactId={artifactId}
              maximized={maximized}
              onToggleMaximize={() => setMaximized((value) => !value)}
              onRestored={applyRestored}
            />
          </>
        ) : (
          <BrowsingPane
            sort={list.sort}
            onSort={list.toggleSort}
            items={shownItems}
            filtered={filterActive}
            onClearFilters={clearFilters}
            loadError={loadError}
            onRetry={() => setReloadKey((key) => key + 1)}
            viewMode={viewMode}
            botsById={botsById}
            onRequestDelete={setPendingDelete}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            loadMoreError={loadMoreError}
            onLoadMore={() => void loadMore()}
          />
        )}
      </div>

      {pendingDelete ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !deleteBusy) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Delete "{deleteTitle}"?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete.versionCount > 1 ? (
                  <Trans>
                    This deletes all {pendingDelete.versionCount} versions of this artifact. This
                    can't be undone.
                  </Trans>
                ) : (
                  <Trans>This can't be undone.</Trans>
                )}
                {deleteShared ? (
                  <>
                    {" "}
                    <Trans>This also stops its link.</Trans>
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError ? <p className="text-[13.5px] text-destructive">{deleteError}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? <Trans>Deleting…</Trans> : <Trans>Delete</Trans>}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

/** Paths to the list or one artifact that keep the URL's search, filters and sort. */
function useArtifactPath() {
  const { search } = useLocation();
  return (id?: string) => ({ pathname: id ? `/app/artifacts/${id}` : "/app/artifacts", search });
}

type SortProps = {
  sort: { field: ArtifactSort; dir: "asc" | "desc" };
  onSort: (field: ArtifactSort) => void;
};

function BrowsingPane({
  sort,
  onSort,
  items,
  filtered,
  onClearFilters,
  loadError,
  onRetry,
  viewMode,
  botsById,
  onRequestDelete,
  nextCursor,
  loadingMore,
  loadMoreError,
  onLoadMore,
}: SortProps & {
  items: ArtifactSummary[] | null;
  filtered: boolean;
  onClearFilters: () => void;
  loadError: string | null;
  onRetry: () => void;
  viewMode: ViewMode;
  botsById: Map<string, Bot>;
  onRequestDelete: (artifact: ArtifactSummary) => void;
  nextCursor: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
}) {
  const { t } = useLingui();
  if (items === null) {
    if (loadError) {
      return <LoadError message={loadError} onRetry={onRetry} />;
    }
    return (
      <div className="flex flex-1 flex-col gap-2 p-3" role="status" aria-label={t`Loading…`}>
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-8 w-full" />
        ))}
        <StillLoading />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyArtifacts
        filtered={filtered}
        onClearFilters={onClearFilters}
        className="grid flex-1 place-items-center text-sm text-muted-foreground/80"
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        onLoadMore={onLoadMore}
      />
    );
  }
  // Ten cards that all say "6m ago" tell nothing; the time shows once the cards differ.
  const cardsDiffer = new Set(items.map((item) => formatRelativeTime(item.createdAt))).size > 1;
  return (
    <div className="@container/list rk-scroll min-h-0 flex-1 overflow-y-auto">
      {viewMode === "grid" ? (
        <div
          className={`grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 py-4 ${PAGE_GUTTER_X}`}
        >
          {items.map((item) => (
            <ArtifactCard
              key={item.id}
              artifact={item}
              bot={item.botId ? botsById.get(item.botId) : undefined}
              showTime={cardsDiffer || items.length < 2}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      ) : (
        <ArtifactTable
          sort={sort}
          onSort={onSort}
          items={items}
          botsById={botsById}
          onRequestDelete={onRequestDelete}
        />
      )}
      {nextCursor ? (
        <div className="pb-4">
          <LoadMoreButton loading={loadingMore} error={loadMoreError} onClick={onLoadMore} />
        </div>
      ) : null}
    </div>
  );
}

/** Hidden until the list pane is wide enough, then shown as a table cell. */
const MID_COL = "hidden @min-[720px]/list:table-cell";
const MID_COLUMN = "hidden @min-[720px]/list:table-column";

/** The list view: one row per artifact, in the same table the Data room and Cap table use. */
function ArtifactTable({
  sort,
  onSort,
  items,
  botsById,
  onRequestDelete,
}: SortProps & {
  items: ArtifactSummary[];
  botsById: Map<string, Bot>;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
  const artifactPath = useArtifactPath();
  const { t } = useLingui();
  const navigate = useNavigate();
  const showBot = botsById.size > 0;
  return (
    <div className={PAGE_GUTTER_X}>
      <Table>
        <colgroup>
          <col />
          {showBot ? <col className={`${MID_COLUMN} w-40`} /> : null}
          <col className={`${MID_COLUMN} w-24`} />
          <col className={`${MID_COLUMN} w-28`} />
        </colgroup>
        <TableHeader
          data-testid="artifacts-head"
          className="sticky top-0 z-10 hidden bg-background @min-[720px]/list:table-header-group"
        >
          <TableHeadRow>
            <TableHead
              sortDirection={sort.field === "name" ? sort.dir : null}
              onSort={() => onSort("name")}
            >
              <Trans>Name</Trans>
            </TableHead>
            {showBot ? (
              <TableHead
                className={MID_COL}
                sortDirection={sort.field === "bot" ? sort.dir : null}
                onSort={() => onSort("bot")}
              >
                <Trans>Bot</Trans>
              </TableHead>
            ) : null}
            <TableHead
              className={MID_COL}
              sortDirection={sort.field === "type" ? sort.dir : null}
              onSort={() => onSort("type")}
            >
              <Trans>Type</Trans>
            </TableHead>
            <TableHead
              className={`${MID_COL} text-end`}
              sortDirection={sort.field === "added" ? sort.dir : null}
              onSort={() => onSort("added")}
            >
              <Trans>Added</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody aria-label={t`Artifacts`}>
          {items.map((artifact) => {
            const bot = artifact.botId ? botsById.get(artifact.botId) : undefined;
            const title = displayName(artifact.name);
            return (
              <TableRow
                key={artifact.id}
                data-testid="artifact-row"
                className="group/row h-10 cursor-pointer [&>td]:py-1.5"
                onClick={() => navigate(artifactPath(artifact.id))}
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">
                      <ArtifactMimeIcon mimeType={artifact.mimeType} small />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        to={artifactPath(artifact.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate font-medium pointer-coarse:-my-3 pointer-coarse:py-3"
                        title={artifact.name}
                      >
                        {displayName(artifact.name)}
                      </Link>
                      {/* Where the Bot and Added columns are hidden (a narrow pane), they go under the name. */}
                      <span
                        data-testid="artifact-meta"
                        className="truncate text-xs text-muted-foreground @min-[720px]/list:hidden"
                      >
                        {[bot?.name, formatRelativeTime(artifact.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {artifact.versionCount > 1 ? (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        {`v${artifact.version}`}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                {showBot ? (
                  <TableCell className={`${MID_COL} text-muted-foreground`}>
                    {bot ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <BotAvatar
                          color={bot.color}
                          identity={bot.id}
                          size={16}
                          status={bot.status}
                        />
                        <span className="truncate">{bot.name}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
                <TableCell className={`${MID_COL} truncate text-muted-foreground`}>
                  {kindLabel(artifact.mimeType)}
                </TableCell>
                <TableCell className="relative w-10 pe-0 text-end text-muted-foreground tabular-nums @min-[720px]/list:w-auto">
                  {/* Delete takes the time's place on hover; on touch it sits beside the time. */}
                  <span className="hidden truncate @min-[720px]/list:block group-hover/row:invisible group-focus-within/row:invisible pointer-coarse:pe-8">
                    {formatRelativeTime(artifact.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label={t`Delete ${title}`}
                    title={t`Delete ${title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDelete(artifact);
                    }}
                    className="absolute end-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100"
                  >
                    <Trash2 size={14} strokeWidth={1.9} />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadMoreButton({
  loading,
  onClick,
  error,
}: {
  loading: boolean;
  onClick: () => void;
  error?: string | null;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5">
      <Button variant="outline" size="sm" disabled={loading} onClick={onClick}>
        {loading ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
      </Button>
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
    </div>
  );
}

/** A listing that never arrived; Try again asks for it afresh. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center">
      <ErrorNotice message={message} onRetry={onRetry} className="" />
    </div>
  );
}

function EmptyArtifacts({
  className,
  filtered,
  onClearFilters,
  nextCursor,
  loadingMore,
  loadMoreError,
  onLoadMore,
}: {
  className: string;
  /** A search, date or bot filter is narrowing the list. */
  filtered: boolean;
  onClearFilters: () => void;
  nextCursor: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
}) {
  if (!nextCursor && !filtered) {
    return (
      <PageEmptyState
        className="flex-1"
        icon={<FileText className="size-8" aria-hidden="true" />}
        title={<Trans>No artifacts yet</Trans>}
        description={
          <Trans>
            Files your bots make, like investor updates and board decks, appear here. Ask a bot to
            write one.
          </Trans>
        }
      />
    );
  }
  if (!nextCursor) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center gap-3">
          <Trans>No artifacts match these filters.</Trans>
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <Trans>Clear filters</Trans>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3">
        <span>
          {loadingMore ? (
            <Trans>Loading…</Trans>
          ) : (
            <Trans>No matching artifacts on this page.</Trans>
          )}
        </span>
        <LoadMoreButton loading={loadingMore} error={loadMoreError} onClick={onLoadMore} />
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          <Trans>Clear filters</Trans>
        </Button>
      </div>
    </div>
  );
}

function IndexPane({
  items,
  filtered,
  onClearFilters,
  loadError,
  onRetry,
  botsById,
  selectedId,
  onRequestDelete,
  nextCursor,
  loadingMore,
  loadMoreError,
  onLoadMore,
}: {
  items: ArtifactSummary[] | null;
  filtered: boolean;
  onClearFilters: () => void;
  loadError: string | null;
  onRetry: () => void;
  botsById: Map<string, Bot>;
  selectedId: string;
  onRequestDelete: (artifact: ArtifactSummary) => void;
  nextCursor: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
}) {
  const pane = useRef<HTMLElement>(null);
  const count = items?.length ?? -1;
  // Opening a row from the grid or a link can leave it under the pane's edge.
  useEffect(() => {
    pane.current
      ?.querySelector<HTMLElement>("[aria-current=page]")
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId, count]);
  // Rows that all say "10m ago" tell nothing; the time shows once they differ.
  const rowsDiffer =
    new Set((items ?? []).map((item) => formatRelativeTime(item.createdAt))).size > 1;
  return (
    // Phones show the list or the open artifact, never both side by side.
    <aside
      ref={pane}
      className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-e border-border md:flex"
    >
      {items === null ? (
        loadError ? (
          <LoadError message={loadError} onRetry={onRetry} />
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground/80">
            <Trans>Loading…</Trans>
          </div>
        )
      ) : items.length === 0 ? (
        <EmptyArtifacts
          filtered={filtered}
          onClearFilters={onClearFilters}
          className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground/80"
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={onLoadMore}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <ArtifactRow
              key={item.id}
              artifact={item}
              bot={item.botId ? botsById.get(item.botId) : undefined}
              active={item.id === selectedId}
              showTime={rowsDiffer}
              onRequestDelete={onRequestDelete}
            />
          ))}
          {nextCursor ? (
            <div className="p-3">
              <LoadMoreButton loading={loadingMore} error={loadMoreError} onClick={onLoadMore} />
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}

function ArtifactCard({
  artifact,
  bot,
  showTime,
  onRequestDelete,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  showTime: boolean;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
  const artifactPath = useArtifactPath();
  const { t } = useLingui();
  const title = displayName(artifact.name);
  return (
    <div className="group relative">
      <Link
        to={artifactPath(artifact.id)}
        // h-full: cards in one grid row share a height, so the hover Delete stays inside each.
        className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-3 text-foreground hover:bg-accent/40 max-md:items-center"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-foreground">
          <ArtifactMimeIcon mimeType={artifact.mimeType} />
        </span>
        <div className="min-w-0 flex-1">
          {/* The version badge shares the title's line so a versioned card is no taller than the rest. */}
          <div className="flex items-start gap-2">
            <div
              className="line-clamp-1 min-w-0 flex-1 break-words text-[15px] font-semibold"
              title={title}
            >
              {title}
            </div>
            {artifact.versionCount > 1 ? (
              <span className="mt-0.5 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground max-md:hidden">
                {`v${artifact.version}`}
              </span>
            ) : null}
          </div>
          {artifact.description ? (
            <div
              className="line-clamp-1 text-[13px] text-muted-foreground max-md:hidden"
              title={artifact.description}
            >
              {artifact.description}
            </div>
          ) : null}
          {/* Delete takes the time's place on hover; where it is always shown (touch, narrow) the same pe-8 keeps them apart. */}
          <div className="mt-1 flex items-center gap-2 pe-8 text-[12px] text-muted-foreground">
            {bot ? (
              <span className="contents max-md:hidden">
                <BotAvatar color={bot.color} identity={bot.id} size={16} status={bot.status} />
                <span className="min-w-0 flex-1 truncate">{bot.name}</span>
              </span>
            ) : (
              <span className="flex-1 max-md:hidden" />
            )}
            {showTime ? (
              <span className="shrink-0 md:group-focus-within:invisible md:group-hover:invisible">
                {formatRelativeTime(artifact.createdAt)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={t`Delete ${title}`}
        title={t`Delete ${title}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRequestDelete(artifact);
        }}
        className="absolute bottom-2 end-2 grid h-7 w-7 place-items-center rounded-lg bg-card max-md:bottom-auto max-md:top-1/2 max-md:-translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
      >
        <Trash2 size={14} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function ArtifactRow({
  artifact,
  bot,
  active,
  showTime,
  onRequestDelete,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  active?: boolean;
  showTime: boolean;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
  const artifactPath = useArtifactPath();
  const { t } = useLingui();
  const title = displayName(artifact.name);
  return (
    <div className={`group relative ${active ? "bg-accent/60" : "hover:bg-accent/40"}`}>
      <Link
        to={artifactPath(artifact.id)}
        aria-current={active ? "page" : undefined}
        title={[bot?.name, artifact.description].filter(Boolean).join(" · ") || undefined}
        className="flex h-10 items-center gap-2 px-4 pe-10"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-accent text-accent-foreground">
          <ArtifactMimeIcon mimeType={artifact.mimeType} small />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
          {displayName(artifact.name)}
        </span>
        {artifact.versionCount > 1 ? (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            {`v${artifact.version}`}
          </span>
        ) : null}
        {showTime ? (
          <span className="shrink-0 text-[11.5px] text-muted-foreground">
            {formatRelativeTime(artifact.createdAt)}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={t`Delete ${title}`}
        title={t`Delete ${title}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRequestDelete(artifact);
        }}
        className="absolute end-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
      >
        <Trash2 size={14} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function ArtifactMimeIcon({ mimeType, small }: { mimeType: string; small?: boolean }) {
  const size = small ? 12 : 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mimeType === "text/html" ? (
        <>
          <polyline points="8 6 2 12 8 18" />
          <polyline points="16 6 22 12 16 18" />
        </>
      ) : isSheet(mimeType) ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M3 15h18M9 4v16" />
        </>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </>
      )}
    </svg>
  );
}

function PreviewPane({
  artifactId,
  maximized,
  onToggleMaximize,
  onRestored,
}: {
  artifactId: string;
  maximized: boolean;
  onToggleMaximize: () => void;
  onRestored: (created: Artifact) => void;
}) {
  const artifactPath = useArtifactPath();
  const { t } = useLingui();
  const [versions, setVersions] = useState<ArtifactVersion[] | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; artifact: Artifact; bytes: Uint8Array }
    | { status: "error"; message: string }
  >({ status: "loading" });
  // The family's live share link (which version it shows), and the dialog around a new one.
  const [share, setShare] = useState<ArtifactShare | null>(null);
  const [shareStatus, setShareStatus] = useState<"loading" | "ready" | "error">("loading");
  const [shareDialog, setShareDialog] = useState<{ url: string | null } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareRunRef = useRef(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setShare(null);
    setShareStatus("loading");
    void rpc.artifactShares
      .get({ artifactId })
      .then((live) => {
        if (cancelled) return;
        setShare(live);
        setShareStatus("ready");
      })
      .catch(() => !cancelled && setShareStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  async function handleShare(versionId: string) {
    if (shareRunRef.current) return;
    shareRunRef.current = true;
    setShareBusy(true);
    try {
      if (shareStatus === "error") {
        try {
          const live = await rpc.artifactShares.get({ artifactId });
          setShare(live);
          setShareStatus("ready");
          setShareError(null);
          if (live) {
            if (live.artifactId === versionId) setShareDialog({ url: null });
            setRestoreError(null);
            return;
          }
        } catch (error) {
          setShareError(errorText(error, t`Could not load`));
          return;
        }
      }
      if (share && share.artifactId === versionId) {
        setShareDialog({ url: null });
        setRestoreError(null);
      } else if (await createShare(versionId)) setRestoreError(null);
    } finally {
      shareRunRef.current = false;
      setShareBusy(false);
    }
  }

  async function createShare(versionId: string): Promise<boolean> {
    setShareError(null);
    try {
      const created = await rpc.artifactShares.create({ artifactId: versionId });
      setShare(created.share);
      setShareDialog({ url: created.url });
      return true;
    } catch (error) {
      setShareError(errorText(error, t`Could not create the link.`));
      return false;
    }
  }

  async function replaceShare(versionId: string) {
    setShareBusy(true);
    try {
      await createShare(versionId);
    } finally {
      setShareBusy(false);
    }
  }

  async function stopShare(versionId: string) {
    setShareBusy(true);
    setShareError(null);
    try {
      await rpc.artifactShares.revoke({ artifactId: versionId });
      setShare(null);
      setShareDialog(null);
    } catch (error) {
      setShareError(errorText(error, t`Could not stop sharing.`));
    } finally {
      setShareBusy(false);
    }
  }

  // A new latest version made from the selected old one; the old version stays.
  async function restoreVersion(artifact: Artifact, bytes: Uint8Array) {
    setRestoring(true);
    setRestoreError(null);
    try {
      const target = artifact.groupId ? { groupId: artifact.groupId } : { botId: artifact.botId! };
      const created = await rpc.artifacts.create({
        ...target,
        name: artifact.name,
        description: artifact.description ?? undefined,
        mimeType: artifact.mimeType,
        contentBase64: bytesToBase64(bytes),
      });
      // The new version exists now; the list row shows it even if the refresh below fails.
      onRestored(created);
      setSelectedVersionId(created.id);
      try {
        setVersions(await rpc.artifacts.listVersions({ familyId: artifactId }));
      } catch {
        setVersions((current) => [
          {
            id: created.id,
            version: created.version,
            name: created.name,
            createdAt: created.createdAt,
          },
          ...(current ?? []).filter((version) => version.id !== created.id),
        ]);
      }
    } catch (error) {
      setRestoreError(errorText(error, t`Could not save the change`));
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setVersions(null);
    setSelectedVersionId(null);
    void rpc.artifacts
      .listVersions({ familyId: artifactId })
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
        setSelectedVersionId(list[0]?.id ?? artifactId);
      })
      .catch(() => {
        if (!cancelled) setSelectedVersionId(artifactId);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  useEffect(() => {
    if (!selectedVersionId) return;
    let cancelled = false;
    setState({ status: "loading" });
    void rpc.artifacts
      .getById({ artifactId: selectedVersionId })
      .then((artifact) => {
        if (!cancelled) {
          setState({
            status: "ready",
            artifact,
            bytes: decodeArtifactBase64(artifact.contentBase64),
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: errorText(error, t`Could not load this artifact.`),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersionId, t]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-3 py-3 md:gap-x-3 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          render={<Link to={artifactPath()} />}
          aria-label={t`Back to artifacts`}
        >
          <ArrowLeft size={18} strokeWidth={1.9} />
        </Button>
        <div className="min-w-40 flex-1">
          {state.status === "loading" ? (
            <Skeleton className="h-5 w-48 max-w-full" />
          ) : (
            <h2 className="truncate text-[16px] font-semibold">
              {state.status === "ready" ? displayName(state.artifact.name) : t`Artifact`}
            </h2>
          )}
          {state.status === "ready" && state.artifact.description ? (
            <p className="truncate text-[12.5px] text-muted-foreground">
              {state.artifact.description}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          {versions && versions.length > 1 && selectedVersionId ? (
            <NativeSelect
              aria-label={t`Version`}
              className="w-auto shrink-0 text-[13px]"
              value={selectedVersionId}
              onChange={(event) => {
                setRestoreError(null);
                setSelectedVersionId(event.target.value);
              }}
            >
              {versions.map((entry) => (
                <NativeSelectOption key={entry.id} value={entry.id}>
                  {`v${entry.version} · ${formatRelativeTime(entry.createdAt)}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
          {state.status === "ready" &&
          versions &&
          versions.length > 1 &&
          selectedVersionId !== versions[0]?.id ? (
            <Button
              variant="outline"
              size="sm"
              disabled={restoring}
              onClick={() => void restoreVersion(state.artifact, state.bytes)}
            >
              <Trans>Restore this version</Trans>
            </Button>
          ) : null}
          {state.status === "ready" ? (
            <>
              {state.artifact.mimeType === "text/html" ? (
                <Tip label={t`Isolated preview — no access to your account`}>
                  <button
                    type="button"
                    aria-label={t`Isolated preview — no access to your account`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Lock size={15} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                </Tip>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                aria-label={t`Download`}
                onClick={() =>
                  void openArtifactBytes(
                    state.artifact.name,
                    state.artifact.mimeType,
                    () => state.bytes,
                  )
                }
              >
                <Download className="sm:me-1.5" size={15} strokeWidth={1.9} />
                <span className="hidden sm:inline">
                  <Trans>Download</Trans>
                </span>
              </Button>
              {isShareableArtifactMimeType(state.artifact.mimeType) ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={
                    share && share.artifactId !== state.artifact.id ? t`Update link` : t`Share`
                  }
                  disabled={shareBusy || shareStatus === "loading"}
                  onClick={() => void handleShare(state.artifact.id)}
                >
                  <Share2 className="sm:me-1.5" size={15} strokeWidth={1.9} />
                  <span className="hidden sm:inline">
                    {share && share.artifactId !== state.artifact.id ? (
                      <Trans>Update link</Trans>
                    ) : (
                      <Trans>Share</Trans>
                    )}
                  </span>
                </Button>
              ) : null}
              <button
                type="button"
                aria-label={maximized ? t`Show list` : t`Maximize`}
                title={maximized ? t`Show list` : t`Maximize`}
                onClick={onToggleMaximize}
                className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent md:grid"
              >
                {maximized ? (
                  <Minimize2 size={15} strokeWidth={1.9} />
                ) : (
                  <Maximize2 size={15} strokeWidth={1.9} />
                )}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {shareError ? (
        <p role="alert" className="px-6 pt-2 text-[13.5px] text-destructive">
          {shareError}
        </p>
      ) : null}
      {restoreError ? (
        <p role="alert" className="px-6 pt-2 text-[13.5px] text-destructive">
          {restoreError}
        </p>
      ) : null}
      {shareDialog && state.status === "ready" ? (
        <ArtifactShareDialog
          name={displayName(state.artifact.name)}
          url={shareDialog.url}
          expiresAt={share?.expiresAt}
          onReplace={() => void replaceShare(state.artifact.id)}
          busy={shareBusy}
          error={shareError}
          onStop={() => void stopShare(state.artifact.id)}
          onClose={() => setShareDialog(null)}
        />
      ) : null}

      <div className="min-h-0 flex-1 p-3 md:p-5">
        {state.status === "loading" ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground/80">
            <Trans>Loading…</Trans>
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {state.message}
          </div>
        ) : (
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-border",
              // A sheet is as tall as its rows (scrolling past the pane); other files fill it.
              canPreviewSpreadsheet(state.artifact.name, state.artifact.mimeType)
                ? "flex max-h-full flex-col"
                : "h-full",
            )}
          >
            <ArtifactPreview artifact={state.artifact} bytes={state.bytes} />
          </div>
        )}
      </div>
    </div>
  );
}
