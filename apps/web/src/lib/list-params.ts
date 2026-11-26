import { useSearchParams } from "react-router-dom";

export type SortDir = "asc" | "desc";
export type Sort<F extends string> = { field: F; dir: SortDir };

/** Compares two cell values: numbers by size, text with numbers inside it in natural order. Null and undefined sort after everything, whichever the direction (see sortBy). */
export function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** A stable sort on one value per item; items with no value (null or undefined) always come last. Dates sort as ISO text. */
export function sortBy<T>(
  items: readonly T[],
  pick: (item: T) => string | number | null | undefined,
  dir: SortDir,
): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return items
    .map((item) => ({ item, key: pick(item) }))
    .sort((a, b) => {
      if (a.key == null || b.key == null) return Number(a.key == null) - Number(b.key == null);
      return factor * compareValues(a.key, b.key);
    })
    .map(({ item }) => item);
}

/**
 * A list page's search, filters and sort, kept in the URL (replacing the history entry) so a link
 * or a reload shows the same list. Filters are plain params read with `param` and written with
 * `setParam` (undefined or "" removes one). The sort uses `sort` and `dir`; a value that is not in
 * `fields` falls back to `fallback`, and the URL stays clean while the sort equals the fallback.
 * `toggleSort(field)` is for a column header: a new column sorts ascending, the same column flips.
 * A list that shares its page with another (a sidebar widget) passes a `prefix`, which goes in front
 * of the `sort` and `dir` names; it names its filter params itself.
 */
export function useListParams<F extends string>(
  fields: readonly F[],
  fallback: Sort<F>,
  prefix = "",
) {
  const sortKey = `${prefix}sort`;
  const dirKey = `${prefix}dir`;
  const [params, setParams] = useSearchParams();
  const asked = params.get(sortKey);
  const field = fields.includes(asked as F) ? (asked as F) : fallback.field;
  const sort: Sort<F> = {
    field,
    dir:
      params.get(dirKey) === "desc"
        ? "desc"
        : params.get(dirKey) === "asc"
          ? "asc"
          : field === fallback.field
            ? fallback.dir
            : "asc",
  };
  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
      },
      { replace: true },
    );
  const setSort = (next: Sort<F>) =>
    update((p) => {
      if (next.field === fallback.field && next.dir === fallback.dir) {
        p.delete(sortKey);
        p.delete(dirKey);
      } else {
        p.set(sortKey, next.field);
        p.set(dirKey, next.dir);
      }
    });
  return {
    param: (name: string) => params.get(name) || undefined,
    setParam: (name: string, value: string | undefined) =>
      update((p) => (value ? p.set(name, value) : p.delete(name))),
    /** Sets or removes several params in one history update. */
    setParams: (changes: Record<string, string | undefined>) =>
      update((p) => {
        for (const [name, value] of Object.entries(changes))
          if (value) p.set(name, value);
          else p.delete(name);
      }),
    /** Removes these params (the "Clear filters" button); the sort stays. */
    clear: (...names: string[]) =>
      update((p) => {
        for (const name of names) p.delete(name);
      }),
    sort,
    setSort,
    toggleSort: (next: F) =>
      setSort({ field: next, dir: sort.field === next && sort.dir === "asc" ? "desc" : "asc" }),
  };
}
