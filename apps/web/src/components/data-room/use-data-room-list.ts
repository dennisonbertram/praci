import { ORPCError } from "@orpc/client";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { DATA_ROOM_METADATA_ORDINAL } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { canOpenInBrowser, isInProgress } from "../../lib/data-room";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export type Filters = {
  /** Omit for every folder. */
  folderId?: string;
  docType?: string;
  party?: string;
  source?: string;
  /** Only "failed", set from the failed count. */
  status?: string;
  docDateFrom?: string;
  docDateTo?: string;
};
export type SortField = "date" | "name" | "type" | "createdAt";
export type Sort = { field: SortField; direction: "asc" | "desc" };
/** A newly chosen sort starts in the order people expect: names A to Z, dates newest first. */
export const naturalSort = (field: SortField): Sort => ({
  field,
  direction: field === "name" || field === "type" ? "asc" : "desc",
});

/** `sort` null means relevance, which only a search has. */
export type ListQuery = { query: string; filters: Filters; sort: Sort | null };
/** One document, with the search snippets that matched in it. */
export type Row = { item: DataRoomApiItem; snippets: string[] };

const LIST_PAGE = 50;
const SEARCH_PAGE = 20;
const POLL_MS = 3_000;
/** Thumbnails are drawn after the list first shows an item: look again a few times for them. */
const THUMBNAIL_WAIT_MS = 5_000;
const THUMBNAIL_TRIES = 3;

/** The value the server orders by, so a change to it means the row's place in the order changed. */
function sortValue(item: DataRoomApiItem, sort: Sort | null) {
  switch (sort?.field ?? "createdAt") {
    case "date":
      return item.facets.docDate;
    case "type":
      return item.facets.docType;
    case "name":
      return item.name;
    default:
      return item.createdAt;
  }
}

/**
 * A metadata hit whose highlights all lie in the file name would only repeat the name shown above
 * it. One that also matches the summary, parties or tags is worth showing.
 */
export function matchesOnlyName(snippet: string, name: string) {
  const marked = snippet
    .split("\u0001")
    .slice(1)
    .map((part) => part.split("\u0002")[0]?.toLowerCase() ?? "");
  const words = name.toLowerCase().replace(/[._\-/]+/g, " ");
  return marked.every((text) => name.toLowerCase().includes(text) || words.includes(text));
}

function mergeRows(rows: Row[], more: Row[]) {
  const byId = new Map(rows.map((row) => [row.item.id, row]));
  const merged = [...rows];
  for (const row of more) {
    const known = byId.get(row.item.id);
    if (known) {
      merged[merged.indexOf(known)] = {
        item: known.item,
        snippets: [...known.snippets, ...row.snippets],
      };
    } else {
      byId.set(row.item.id, row);
      merged.push(row);
    }
  }
  return merged;
}

/** Search, filter, sort and paging all happen on the server; the rows keep the order it returned. */
async function fetchPage(q: ListQuery, cursor?: string) {
  if (q.query) {
    const page = await rpc.dataRoom.search({
      query: q.query,
      filters: q.filters,
      ...(q.sort ? { sort: q.sort } : {}),
      limit: SEARCH_PAGE,
      cursor,
    });
    return {
      rows: mergeRows(
        [],
        page.results.map((hit) => ({
          item: hit.item,
          snippets:
            hit.ordinal === DATA_ROOM_METADATA_ORDINAL &&
            matchesOnlyName(hit.snippet, hit.item.name)
              ? []
              : [hit.snippet],
        })),
      ),
      nextCursor: page.nextCursor,
    };
  }
  const page = await rpc.dataRoom.items.list({
    ...q.filters,
    sort: q.sort ?? { field: "createdAt", direction: "desc" },
    limit: LIST_PAGE,
    cursor,
  });
  return {
    rows: page.items.map((item) => ({ item, snippets: [] })),
    nextCursor: page.nextCursor,
  };
}

type State = {
  /** The query the rows answer; it lags `q` until the response arrives. */
  key: string;
  rows: Row[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
};

export function useDataRoomList(q: ListQuery) {
  const key = JSON.stringify(q);
  const [state, setState] = useState<State>({
    key: "",
    rows: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: "",
  });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  /** The cursor of the next page of the rows on screen. */
  const cursorRef = useRef<string | null>(null);
  /** Per item, the newest status read; an older answer is dropped. */
  const pollSeq = useRef(new Map<string, number>());
  const rowsRef = useRef(state.rows);
  rowsRef.current = state.rows;
  const loadedKey = useRef(key);
  const latest = useRef(q);
  latest.current = q;

  // `key` stands for `q`; `attempt` is the manual reload.
  useEffect(() => {
    const id = ++generation.current;
    const sameQuery = loadedKey.current === key;
    loadedKey.current = key;
    setState((s) =>
      sameQuery
        ? { ...s, loading: true, error: "" }
        : { key: "", rows: [], nextCursor: null, loading: true, loadingMore: false, error: "" },
    );
    fetchPage(latest.current)
      .then((page) => {
        if (id !== generation.current) return;
        cursorRef.current = page.nextCursor;
        setState({ ...page, key, loading: false, loadingMore: false, error: "" });
      })
      .catch((cause) => {
        if (id !== generation.current) return;
        setState((s) => ({ ...s, loading: false, error: errorText(cause) }));
      });
  }, [key, attempt]);

  const loadMore = useCallback(async () => {
    const id = generation.current;
    const cursor = cursorRef.current;
    if (!cursor || state.loadingMore || state.loading) return;
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const page = await fetchPage(latest.current, cursor);
      // Only the page that follows the rows now on screen, for the query now asked.
      if (id !== generation.current || cursorRef.current !== cursor) return;
      cursorRef.current = page.nextCursor;
      setState((s) => ({
        ...s,
        rows: mergeRows(s.rows, page.rows),
        nextCursor: page.nextCursor,
        loadingMore: false,
      }));
    } catch (cause) {
      if (id !== generation.current) return;
      // The cursor no longer fits (for example search fell back to keywords): start again, silently.
      if (cause instanceof ORPCError && cause.code === "CONFLICT" && latest.current.query) {
        setState((s) => ({ ...s, loadingMore: false, nextCursor: null }));
        setAttempt((n) => n + 1);
        return;
      }
      setState((s) => ({ ...s, loadingMore: false, error: errorText(cause) }));
    }
  }, [state.loadingMore, state.loading]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  /** Shows a changed item at once, before the next read confirms it. */
  const patchItem = useCallback(
    (item: DataRoomApiItem) =>
      setState((s) => ({
        ...s,
        rows: s.rows.map((row) => (row.item.id === item.id ? { ...row, item } : row)),
      })),
    [],
  );

  // Items a background job is still working on are read again until they are ready or failed.
  const pendingIds = state.rows
    .filter((row) => isInProgress(row.item))
    .map((row) => row.item.id)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const timer = setInterval(() => {
      const id = generation.current;
      for (const itemId of pendingIds.split(",")) {
        const mine = (pollSeq.current.get(itemId) ?? 0) + 1;
        pollSeq.current.set(itemId, mine);
        rpc.dataRoom
          .item({ id: itemId })
          .then((item) => {
            // Not if the list was reloaded or re-queried since, or a newer poll was sent.
            if (id !== generation.current || pollSeq.current.get(itemId) !== mine) return;
            // Patching a row in place would leave it out of order and the cursor could skip
            // documents, so when the sort value moved, read the first page again. A relevance
            // search (no sort) is not ordered by these fields.
            const old = rowsRef.current.find((row) => row.item.id === itemId)?.item;
            const { query, sort } = latest.current;
            if (old && (sort || !query) && sortValue(old, sort) !== sortValue(item, sort)) {
              setAttempt((n) => n + 1);
              return;
            }
            setState((s) => ({
              ...s,
              rows: s.rows.map((row) =>
                // A finished item never goes back to in progress.
                row.item.id === itemId && !(isInProgress(item) && !isInProgress(row.item))
                  ? { ...row, item }
                  : row,
              ),
            }));
          })
          .catch(() => undefined);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendingIds]);

  // ponytail: refreshes only the first page; rows further down get theirs on the next reload.
  const thumbnailTries = useRef(0);
  const waiting = state.rows.some(
    ({ item }) => canOpenInBrowser(item) && !item.hasThumbnail && item.status !== "failed",
  );
  // A new query starts the count again.
  useEffect(() => {
    thumbnailTries.current = 0;
  }, [key]);
  useEffect(() => {
    if (!waiting || state.loading || q.query || thumbnailTries.current >= THUMBNAIL_TRIES) return;
    const timer = setTimeout(() => {
      thumbnailTries.current += 1;
      const id = generation.current;
      fetchPage(latest.current)
        .then((page) => {
          if (id !== generation.current) return;
          const drawn = new Map(
            page.rows.filter((row) => row.item.hasThumbnail).map((row) => [row.item.id, row.item]),
          );
          setState((s) => ({
            ...s,
            rows: s.rows.map((row) => {
              const item = drawn.get(row.item.id);
              return item ? { ...row, item: { ...row.item, hasThumbnail: true } } : row;
            }),
          }));
        })
        .catch(() => undefined);
    }, THUMBNAIL_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, state.rows, state.loading, q.query]);

  return { ...state, loadMore, reload, patchItem };
}
