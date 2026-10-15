import type { DataRoomApiItem } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { isInProgress } from "../../lib/data-room";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export type Filters = {
  /** Omit for every folder. */
  folderId?: string;
  docType?: string;
  party?: string;
  source?: string;
  docDateFrom?: string;
  docDateTo?: string;
};
export type SortField = "date" | "name" | "type" | "createdAt";
export type Sort = { field: SortField; direction: "asc" | "desc" };
/** `sort` null means relevance, which only a search has. */
export type ListQuery = { query: string; filters: Filters; sort: Sort | null };
/** One document, with the search snippets that matched in it. */
export type Row = { item: DataRoomApiItem; snippets: string[] };

const LIST_PAGE = 50;
const SEARCH_PAGE = 20;
const POLL_MS = 3_000;

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
        page.results.map((hit) => ({ item: hit.item, snippets: [hit.snippet] })),
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
        setState({ ...page, key, loading: false, loadingMore: false, error: "" });
      })
      .catch((cause) => {
        if (id !== generation.current) return;
        setState((s) => ({ ...s, loading: false, error: errorText(cause) }));
      });
  }, [key, attempt]);

  const loadMore = useCallback(async () => {
    const id = generation.current;
    const cursor = state.nextCursor;
    if (!cursor || state.loadingMore) return;
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const page = await fetchPage(latest.current, cursor);
      if (id !== generation.current) return;
      setState((s) => ({
        ...s,
        rows: mergeRows(s.rows, page.rows),
        nextCursor: page.nextCursor,
        loadingMore: false,
      }));
    } catch (cause) {
      if (id === generation.current) {
        setState((s) => ({ ...s, loadingMore: false, error: errorText(cause) }));
      }
    }
  }, [state.nextCursor, state.loadingMore]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // Items a background job is still working on are read again until they are ready or failed.
  const pendingIds = state.rows
    .filter((row) => isInProgress(row.item))
    .map((row) => row.item.id)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const timer = setInterval(() => {
      for (const id of pendingIds.split(",")) {
        rpc.dataRoom
          .item({ id })
          .then((item) =>
            setState((s) => ({
              ...s,
              rows: s.rows.map((row) => (row.item.id === id ? { ...row, item } : row)),
            })),
          )
          .catch(() => undefined);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendingIds]);

  return { ...state, loadMore, reload };
}
