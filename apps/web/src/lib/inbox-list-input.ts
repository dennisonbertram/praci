import type { InboxListInput, InboxPile } from "@rakazo/contracts";
import { InboxFilterSchema, InboxPileSchema, InboxViewCategorySchema } from "@rakazo/contracts";

export type InboxListParam = "filter" | "q" | "pile" | "category";

export const MAX_QUERY = 500;

export interface InboxListState {
  filter: InboxListInput["filter"];
  query: string;
  /** Undefined while a filter, search or category is set. */
  pile: InboxPile | undefined;
  category: InboxListInput["category"];
}

/** Gmail filters and search read live from Gmail; a category narrows the cached list; a pile is the default. The first of those that is set wins. */
export function readInboxListState(params: URLSearchParams): InboxListState {
  const filter = InboxFilterSchema.safeParse(params.get("filter")).data;
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (filter || query) return { filter, query, pile: undefined, category: undefined };
  const category = InboxViewCategorySchema.safeParse(params.get("category")).data;
  return {
    filter,
    query,
    pile: category
      ? undefined
      : (InboxPileSchema.safeParse(params.get("pile")).data ?? "important"),
    category,
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
    ...(state.pile ? { pile: state.pile } : {}),
    ...(state.category ? { category: state.category } : {}),
    ...(pageToken ? { pageToken } : {}),
  };
}

/** A new filter or search replaces the pile and category, a pile replaces them all, and a category replaces the rest. Closes the open message. */
export function setInboxListParam(
  params: URLSearchParams,
  name: InboxListParam,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const replaced =
    name === "filter" || name === "q"
      ? (["pile", "category"] as const)
      : name === "pile"
        ? (["filter", "q", "category"] as const)
        : (["filter", "q", ...(value ? (["pile"] as const) : [])] as const);
  for (const key of replaced) next.delete(key);
  if (value) next.set(name, value);
  else next.delete(name);
  next.delete("mail");
  next.delete("digest");
  return next;
}
