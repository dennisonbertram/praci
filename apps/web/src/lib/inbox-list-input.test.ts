import { describe, expect, it } from "vitest";
import { inboxListInput, readInboxListState, setInboxListParam } from "./inbox-list-input";

const read = (search: string) => readInboxListState(new URLSearchParams(search));

describe("readInboxListState", () => {
  it("reads the filter, search text, pile and category from the URL", () => {
    expect(read("filter=starred&q=%20from%3Aann%20")).toEqual({
      filter: "starred",
      query: "from:ann",
      pile: undefined,
      category: undefined,
    });
    expect(read("pile=updates")).toMatchObject({ pile: "updates", category: undefined });
    expect(read("category=billing")).toMatchObject({ pile: undefined, category: "billing" });
  });

  it("opens the Important pile by default", () => {
    expect(read("")).toEqual({
      filter: undefined,
      query: "",
      pile: "important",
      category: undefined,
    });
  });

  it("drops values it does not know", () => {
    expect(read("filter=bogus&pile=everything&category=fyi")).toEqual({
      filter: undefined,
      query: "",
      pile: "important",
      category: undefined,
    });
  });

  it("ignores the old view parameter", () => {
    expect(read("view=important")).toMatchObject({ pile: "important", category: undefined });
  });

  it("lets a Gmail filter, search or category win over a pile in a hand-edited URL", () => {
    expect(read("pile=spam&category=billing&filter=unread")).toMatchObject({
      filter: "unread",
      pile: undefined,
      category: undefined,
    });
    expect(read("pile=spam&q=invoice")).toMatchObject({ query: "invoice", pile: undefined });
    expect(read("pile=spam&category=billing")).toMatchObject({
      pile: undefined,
      category: "billing",
    });
  });
});

describe("inboxListInput", () => {
  const state = (search: string) => read(search);

  it("sends the account tab, pile and category for a cached list", () => {
    expect(inboxListInput(state("pile=newsletters"), "c1")).toEqual({
      connectionId: "c1",
      pile: "newsletters",
    });
    expect(inboxListInput(state("category=receipt"), undefined)).toEqual({ category: "receipt" });
    expect(inboxListInput(state(""), undefined)).toEqual({ pile: "important" });
  });

  it("sends the filter, search and page token for a Gmail list, and no pile or category", () => {
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

  it("choosing a Gmail filter or search replaces the pile and category", () => {
    expect(set("pile=updates&category=billing", "filter", "starred")).toBe("filter=starred");
    expect(set("pile=updates", "q", "ann")).toBe("q=ann");
    // A filter and a search still combine, as before.
    expect(set("filter=starred", "q", "ann")).toBe("filter=starred&q=ann");
  });

  it("choosing a pile replaces the Gmail filter, search and category", () => {
    expect(set("filter=starred&q=ann", "pile", "updates")).toBe("pile=updates");
    expect(set("category=billing", "pile", "spam")).toBe("pile=spam");
    // The default pile has no parameter, so going back to it clears the others too.
    expect(set("filter=starred&pile=updates", "pile", "")).toBe("");
  });

  it("choosing a category replaces the Gmail filter, search and pile", () => {
    expect(set("filter=starred&q=ann", "category", "billing")).toBe("category=billing");
    expect(set("pile=updates", "category", "billing")).toBe("category=billing");
    expect(set("pile=updates", "category", "")).toBe("pile=updates");
  });
});
