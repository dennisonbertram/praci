import type { InboxListInput } from "@rakazo/contracts";
import { InboxFilterSchema, InboxViewCategorySchema } from "@rakazo/contracts";

export type InboxListParam = "filter" | "q" | "view" | "category";

export const MAX_QUERY = 500;

export interface InboxListState {
  filter: InboxListInput["filter"];
  query: string;
  view: "all" | "important";
  category: InboxListInput["category"];
}

/** Gmail filters and search read live from Gmail; a view and category narrow the cached list. A filter or search wins. */
export function readInboxListState(params: URLSearchParams): InboxListState {
  const filter = InboxFilterSchema.safeParse(params.get("filter")).data;
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (filter || query) return { filter, query, view: "all", category: undefined };
  return {
    filter,
    query,
    view: params.get("view") === "important" ? "important" : "all",
    category: InboxViewCategorySchema.safeParse(params.get("category")).data,
  };
}

export function inboxListInput(
  state: InboxListState,
  tab: string | undefined,
  pageToken?: string,
): InboxListInput {
  return {
    ...(tab ? { connectionId: tab } : {}),
    ...(state.filter ? { filter: state.filter } : {}),
    ...(state.query ? { query: state.query } : {}),
    ...(state.view === "important" ? { view: "important" as const } : {}),
    ...(state.category ? { category: state.category } : {}),
    ...(pageToken ? { pageToken } : {}),
  };
}

/** A new filter or search replaces the view and category, and the other way round. Closes the open message. */
export function setInboxListParam(
  params: URLSearchParams,
  name: InboxListParam,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const replaced =
    name === "filter" || name === "q"
      ? (["view", "category"] as const)
      : name === "view"
        ? (["filter", "q", ...(value ? (["category"] as const) : [])] as const)
        : (["filter", "q", ...(value ? (["view"] as const) : [])] as const);
  for (const key of replaced) next.delete(key);
  if (value) next.set(name, value);
  else next.delete(name);
  next.delete("mail");
  return next;
}
