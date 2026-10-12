import { describe, expect, it } from "vitest";
import { inboxListInput, readInboxListState, setInboxListParam } from "./inbox-list-input";

const read = (search: string) => readInboxListState(new URLSearchParams(search));

describe("readInboxListState", () => {
  it("reads the filter, search text, view and category from the URL", () => {
    expect(read("filter=starred&q=%20from%3Aann%20")).toEqual({
      filter: "starred",
      query: "from:ann",
      view: "all",
      category: undefined,
    });
    expect(read("view=important&category=billing")).toMatchObject({
      view: "important",
      category: "billing",
    });
  });

  it("drops values it does not know", () => {
    expect(read("filter=bogus&view=everything&category=fyi")).toEqual({
      filter: undefined,
      query: "",
      view: "all",
      category: undefined,
    });
  });

  it("lets a Gmail filter or search win over a view or category in a hand-edited URL", () => {
    expect(read("view=important&category=billing&filter=unread")).toMatchObject({
      filter: "unread",
      view: "all",
      category: undefined,
    });
    expect(read("view=important&q=invoice")).toMatchObject({ query: "invoice", view: "all" });
  });
});

describe("inboxListInput", () => {
  const state = (search: string) => read(search);

  it("sends the account tab, view and category for a cached list", () => {
    expect(inboxListInput(state("view=important"), "c1")).toEqual({
      connectionId: "c1",
      view: "important",
    });
    expect(inboxListInput(state("view=important&category=receipt"), undefined)).toEqual({
      view: "important",
      category: "receipt",
    });
    expect(inboxListInput(state(""), undefined)).toEqual({});
  });

  it("sends the filter, search and page token for a Gmail list, and no view or category", () => {
    expect(inboxListInput(state("filter=unread&q=ann"), "c1", "next")).toEqual({
      connectionId: "c1",
      filter: "unread",
      query: "ann",
      pageToken: "next",
    });
  });
});

describe("setInboxListParam", () => {
  const set = (search: string, name: Parameters<typeof setInboxListParam>[1], value: string) =>
    setInboxListParam(new URLSearchParams(search), name, value).toString();

  it("sets and clears one parameter, and closes the open message", () => {
    expect(set("mail=m1", "filter", "unread")).toBe("filter=unread");
    expect(set("filter=unread", "filter", "")).toBe("");
  });

  it("choosing a Gmail filter or search replaces the view and category", () => {
    expect(set("view=important&category=billing", "filter", "starred")).toBe("filter=starred");
    expect(set("view=important", "q", "ann")).toBe("q=ann");
    // A filter and a search still combine, as before.
    expect(set("filter=starred", "q", "ann")).toBe("filter=starred&q=ann");
  });

  it("choosing a view or category replaces the Gmail filter and search, and keeps the other of the two", () => {
    expect(set("filter=starred&q=ann", "view", "important")).toBe("view=important");
    expect(set("view=important&q=ann", "category", "billing")).toBe(
      "view=important&category=billing",
    );
    expect(set("view=important&category=billing", "view", "")).toBe("category=billing");
  });
});
