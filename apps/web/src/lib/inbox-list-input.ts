import type { InboxListInput } from "@rakazo/contracts";

export type InboxListParam = "filter" | "q" | "view" | "category";

export interface InboxListState {
  filter: NonNullable<InboxListInput["filter"]> | undefined;
  query: string;
  view: "all" | "important";
  category: NonNullable<InboxListInput["category"]> | undefined;
}

export function readInboxListState(_params: URLSearchParams): InboxListState {
  // ponytail: scaffold, behavior arrives with the tests.
  return { filter: undefined, query: "", view: "all", category: undefined };
}

export function inboxListInput(
  _state: InboxListState,
  _tab: string | undefined,
  _pageToken?: string,
): InboxListInput {
  return {};
}

export function setInboxListParam(
  params: URLSearchParams,
  _name: InboxListParam,
  _value: string,
): URLSearchParams {
  return new URLSearchParams(params);
}
