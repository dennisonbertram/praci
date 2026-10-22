import { t as translate } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Artifact, ArtifactVersion, Bot } from "@rakazo/contracts";

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
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArtifactPreview } from "../components/ArtifactPreview";
import { AskBotButton } from "../components/AskBotButton";
import { Tip } from "../components/data-room/FilterBar";
import { PickFilter, SearchField } from "../components/ListControls";
import { PageEmptyState } from "../components/PageEmptyState";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { artifactDisplayName as displayName } from "../lib/artifact-name";
import { decodeArtifactBase64, downloadArtifactBytes } from "../lib/artifact-open";
import { takeInitialBootstrap } from "../lib/bootstrap";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { canPreviewSpreadsheet } from "../lib/spreadsheet";
import { errorText } from "../lib/user-error";

type ViewMode = "grid" | "list";
type DateFilter = "all" | "today" | "week" | "month";
const VIEW_MODE_STORAGE_KEY = "rakazo:artifacts-view-mode";
const LIST_PAGE_SIZE = 60;

type ArtifactSummary = Artifact & { versionCount: number };

const isSheet = (mimeType: string) => /csv|spreadsheet|excel/.test(mimeType);

/** Plain words for the card badge: Maya knows a Doc, a Sheet and a Page, not MD, CSV and HTML. */
function kindLabel(mimeType: string): string {
  if (mimeType === "text/html") return translate`Page`;
  if (mimeType === "text/markdown") return translate`Doc`;
  if (isSheet(mimeType)) return translate`Sheet`;
  return mimeBadgeLabel(mimeType);
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
}: {
  spaceName?: string;
  onAskAgent?: () => void;
}) {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const navigate = useNavigate();
  const { t } = useLingui();
  const [bots, setBots] = useState<Bot[]>([]);
  const [items, setItems] = useState<ArtifactSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const listingGenerationRef = useRef(0);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  // Bots that own at least one artifact. Only grows, so filtering to one bot keeps the others listed.
  const [ownerBotIds, setOwnerBotIds] = useState<ReadonlySet<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [maximized, setMaximized] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ArtifactSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void takeInitialBootstrap().then((bootstrap) => setBots(bootstrap.bots));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listingGenerationRef.current += 1;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setItems(null);
    setLoadError(null);
    setNextCursor(null);
    void rpc.artifacts
      .listSpace({ botId: activeBotId ?? undefined, limit: LIST_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(errorText(error, t`Could not load artifacts.`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBotId, t]);

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = listingGenerationRef.current;
    const listingChanged = () => generation !== listingGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await rpc.artifacts.listSpace({
        botId: activeBotId ?? undefined,
        cursor: nextCursor,
        limit: LIST_PAGE_SIZE,
      });
      if (listingChanged()) return;
      setItems((current) => (current ?? []).concat(page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Keep the current page so Load more can be retried.
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
    return items.filter((item) => {
      if (!matchesCalendarDateFilter(item.createdAt, dateFilter, now)) return false;
      return matchesArtifactQuery(item, searchQuery);
    });
  }, [items, searchQuery, dateFilter]);

  const clientFilterActive = searchQuery.trim().length > 0 || dateFilter !== "all";
  const filterActive = clientFilterActive || activeBotId !== null;

  function clearFilters() {
    setSearchQuery("");
    setDateFilter("all");
    setActiveBotId(null);
  }

  // A filter that hides the open artifact closes it, so the list never sits beside an unrelated preview.
  useEffect(() => {
    if (
      artifactId &&
      filterActive &&
      filteredItems &&
      !filteredItems.some((i) => i.id === artifactId)
    )
      navigate("/app/artifacts");
  }, [artifactId, filterActive, filteredItems, navigate]);
  const autoFetchedCursorRef = useRef<string | null>(null);

  useEffect(() => {
    autoFetchedCursorRef.current = null;
  }, [searchQuery, dateFilter, activeBotId]);

  // Search and date filters only see loaded pages, so keep paging until something matches.
  useEffect(() => {
    if (!clientFilterActive || !nextCursor || loadingMore || items === null) return;
    if (filteredItems && filteredItems.length > 0) return;
    if (autoFetchedCursorRef.current === nextCursor) return;
    autoFetchedCursorRef.current = nextCursor;
    void loadMore();
  }, [clientFilterActive, nextCursor, loadingMore, items, filteredItems]);

  function setMode(mode: ViewMode) {
    setViewMode(mode);
    writeViewMode(mode);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await rpc.artifacts.remove({ artifactId: pendingDelete.id });
      setItems((current) => current?.filter((item) => item.id !== pendingDelete.id) ?? current);
      if (artifactId === pendingDelete.id) navigate("/app/artifacts");
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

  // Nothing to filter or switch views on until the space has an artifact.
  const nothingYet = items?.length === 0 && !nextCursor && !filterActive;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground/90">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <PageHeader
          // The space name drops to a third row on a phone; the header stays one row there.
          className="max-md:[&_[data-page-header-meta]]:hidden"
          title={<Trans>Artifacts</Trans>}
          meta={
            spaceName ? (
              <span className="truncate" title={spaceName}>
                {spaceName}
              </span>
            ) : null
          }
          actions={
            <>
              {!artifactId && !nothingYet ? viewToggle("hidden md:flex") : null}
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
            onChange={setSearchQuery}
            placeholder={t`Search`}
            label={t`Search artifacts`}
            name="artifacts-search"
          />
          <PickFilter
            label={t`Added`}
            value={dateFilter === "all" ? undefined : dateFilter}
            options={[
              ["today", t`Today`],
              ["week", t`This week`],
              ["month", t`This month`],
            ]}
            onChange={(next) => setDateFilter((next as DateFilter | undefined) ?? "all")}
          />
          {ownerBots.length > 1 ? (
            <PickFilter
              label={t`Bot`}
              value={activeBotId ?? undefined}
              options={ownerBots.map((bot) => [bot.id, bot.name])}
              onChange={(next) => setActiveBotId(next ?? null)}
            />
          ) : null}
          {/* On a phone the header has no room for the view switch, so it waits here with the filters. */}
          {!artifactId ? viewToggle("ms-auto md:hidden") : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden border-t border-border">
        {artifactId ? (
          <>
            {!maximized ? (
              <IndexPane
                items={filteredItems}
                filtered={filterActive}
                onClearFilters={clearFilters}
                loadError={loadError}
                botsById={botsById}
                selectedId={artifactId}
                onRequestDelete={setPendingDelete}
                nextCursor={nextCursor}
                loadingMore={loadingMore}
                onLoadMore={() => void loadMore()}
              />
            ) : null}
            <PreviewPane
              key={artifactId}
              artifactId={artifactId}
              maximized={maximized}
              onToggleMaximize={() => setMaximized((value) => !value)}
            />
          </>
        ) : (
          <BrowsingPane
            items={filteredItems}
            filtered={filterActive}
            onClearFilters={clearFilters}
            loadError={loadError}
            viewMode={viewMode}
            botsById={botsById}
            onRequestDelete={setPendingDelete}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
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
                <Trans>Delete "{pendingDelete.name}"?</Trans>
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

function BrowsingPane({
  items,
  filtered,
  onClearFilters,
  loadError,
  viewMode,
  botsById,
  onRequestDelete,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  items: ArtifactSummary[] | null;
  filtered: boolean;
  onClearFilters: () => void;
  loadError: string | null;
  viewMode: ViewMode;
  botsById: Map<string, Bot>;
  onRequestDelete: (artifact: ArtifactSummary) => void;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useLingui();
  if (items === null) {
    if (loadError) {
      return (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground/80">
          {loadError}
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col gap-2 p-3" role="status" aria-label={t`Loading…`}>
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-8 w-full" />
        ))}
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
        onLoadMore={onLoadMore}
      />
    );
  }
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
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      ) : (
        <ArtifactTable items={items} botsById={botsById} onRequestDelete={onRequestDelete} />
      )}
      {nextCursor ? (
        <div className="pb-4">
          <LoadMoreButton loading={loadingMore} onClick={onLoadMore} />
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
  items,
  botsById,
  onRequestDelete,
}: {
  items: ArtifactSummary[];
  botsById: Map<string, Bot>;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
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
          <col className="w-9" />
        </colgroup>
        <TableHeader
          data-testid="artifacts-head"
          className="sticky top-0 z-10 hidden bg-background @min-[720px]/list:table-header-group"
        >
          <TableHeadRow>
            <TableHead>
              <Trans>Name</Trans>
            </TableHead>
            {showBot ? (
              <TableHead className={MID_COL}>
                <Trans>Bot</Trans>
              </TableHead>
            ) : null}
            <TableHead className={MID_COL}>
              <Trans>Type</Trans>
            </TableHead>
            <TableHead className={`${MID_COL} text-end`}>
              <Trans>Added</Trans>
            </TableHead>
            <TableHead />
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
                onClick={() => navigate(`/app/artifacts/${artifact.id}`)}
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">
                      <ArtifactMimeIcon mimeType={artifact.mimeType} small />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        to={`/app/artifacts/${artifact.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate font-medium"
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
                <TableCell
                  className={`${MID_COL} truncate text-end text-muted-foreground tabular-nums`}
                >
                  {formatRelativeTime(artifact.createdAt)}
                </TableCell>
                <TableCell className="pe-0">
                  <button
                    type="button"
                    aria-label={t`Delete ${title}`}
                    title={t`Delete ${title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDelete(artifact);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100"
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

function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="outline" size="sm" disabled={loading} onClick={onClick}>
        {loading ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
      </Button>
    </div>
  );
}

function EmptyArtifacts({
  className,
  filtered,
  onClearFilters,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  className: string;
  /** A search, date or bot filter is narrowing the list. */
  filtered: boolean;
  onClearFilters: () => void;
  nextCursor: string | null;
  loadingMore: boolean;
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
        <LoadMoreButton loading={loadingMore} onClick={onLoadMore} />
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
  botsById,
  selectedId,
  onRequestDelete,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  items: ArtifactSummary[] | null;
  filtered: boolean;
  onClearFilters: () => void;
  loadError: string | null;
  botsById: Map<string, Bot>;
  selectedId: string;
  onRequestDelete: (artifact: ArtifactSummary) => void;
  nextCursor: string | null;
  loadingMore: boolean;
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
  return (
    // Phones show the list or the open artifact, never both side by side.
    <aside
      ref={pane}
      className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-e border-border md:flex"
    >
      {items === null ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground/80">
          {loadError ?? <Trans>Loading…</Trans>}
        </div>
      ) : items.length === 0 ? (
        <EmptyArtifacts
          filtered={filtered}
          onClearFilters={onClearFilters}
          className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground/80"
          nextCursor={nextCursor}
          loadingMore={loadingMore}
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
              onRequestDelete={onRequestDelete}
            />
          ))}
          {nextCursor ? (
            <div className="p-3">
              <LoadMoreButton loading={loadingMore} onClick={onLoadMore} />
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
  onRequestDelete,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
  const { t } = useLingui();
  const title = displayName(artifact.name);
  return (
    <div className="group relative">
      <Link
        to={`/app/artifacts/${artifact.id}`}
        // h-full: cards in one grid row share a height, so the hover Delete stays inside each.
        className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-foreground hover:bg-accent/40 max-md:flex-row max-md:items-center max-md:gap-3 max-md:p-3"
      >
        <div className="flex items-center justify-between">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-accent-foreground">
            <ArtifactMimeIcon mimeType={artifact.mimeType} />
          </span>
          <div className="flex items-center gap-1.5 max-md:hidden">
            {artifact.versionCount > 1 ? (
              <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {`v${artifact.version}`}
              </span>
            ) : null}
            <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {kindLabel(artifact.mimeType)}
            </span>
          </div>
        </div>
        <div className="min-w-0 max-md:flex-1">
          <div className="truncate text-[15px] font-semibold">{displayName(artifact.name)}</div>
          {artifact.description ? (
            <div className="mt-1 line-clamp-2 max-md:hidden text-[13px] leading-relaxed text-muted-foreground">
              {artifact.description}
            </div>
          ) : null}
        </div>
        {/* The time ends at the type label's edge. Delete takes its place on hover; where it is always shown (touch, narrow) pe-8 keeps them apart. */}
        <div className="mt-auto flex items-center gap-2 text-[12px] text-muted-foreground max-md:mt-0 max-md:pe-8 pointer-coarse:pe-8">
          {bot ? (
            <span className="contents max-md:hidden">
              <BotAvatar color={bot.color} identity={bot.id} size={20} status={bot.status} />
              <span className="min-w-0 flex-1 truncate">{bot.name}</span>
            </span>
          ) : (
            <span className="flex-1 max-md:hidden" />
          )}
          <span className="shrink-0 md:group-focus-within:invisible md:group-hover:invisible">
            {formatRelativeTime(artifact.createdAt)}
          </span>
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
        className="absolute bottom-3 end-3 grid h-7 w-7 place-items-center rounded-lg bg-card max-md:bottom-auto max-md:top-1/2 max-md:-translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
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
  onRequestDelete,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  active?: boolean;
  onRequestDelete: (artifact: ArtifactSummary) => void;
}) {
  const { t } = useLingui();
  const title = displayName(artifact.name);
  return (
    <div className={`group relative ${active ? "bg-accent/60" : "hover:bg-accent/40"}`}>
      <Link
        to={`/app/artifacts/${artifact.id}`}
        aria-current={active ? "page" : undefined}
        className="flex flex-col gap-1 px-4 py-3 pe-10"
      >
        <div className="flex items-center gap-2">
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
        </div>
        {artifact.description ? (
          <div className="ps-8 text-[12.5px] leading-snug text-muted-foreground">
            {artifact.description}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5 ps-8 text-[11.5px] text-muted-foreground">
          {bot ? (
            <>
              <BotAvatar color={bot.color} identity={bot.id} size={14} status={bot.status} />
              <span className="max-w-[140px] truncate">{bot.name}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{formatRelativeTime(artifact.createdAt)}</span>
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
}: {
  artifactId: string;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const { t } = useLingui();
  const [versions, setVersions] = useState<ArtifactVersion[] | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; artifact: Artifact; bytes: Uint8Array }
    | { status: "error"; message: string }
  >({ status: "loading" });

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
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:gap-3 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          render={<Link to="/app/artifacts" />}
          aria-label={t`Back to artifacts`}
        >
          <ArrowLeft size={18} strokeWidth={1.9} />
        </Button>
        <div className="min-w-0 flex-1">
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
        {versions && versions.length > 1 && selectedVersionId ? (
          <NativeSelect
            aria-label={t`Version`}
            className="w-auto shrink-0 text-[13px]"
            value={selectedVersionId}
            onChange={(event) => setSelectedVersionId(event.target.value)}
          >
            {versions.map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {`v${entry.version} · ${formatRelativeTime(entry.createdAt)}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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
                downloadArtifactBytes(state.artifact.name, state.artifact.mimeType, state.bytes)
              }
            >
              <Download className="sm:me-1.5" size={15} strokeWidth={1.9} />
              <span className="hidden sm:inline">
                <Trans>Download</Trans>
              </span>
            </Button>
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
      </header>

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
