import type { AdapterContext, MemoryStore } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { loadCompanyContextIndex, lookupCompanyContext } from "./company-context.js";

const context = { spaceId: "s", userId: "u" } as AdapterContext;

function store(documents: Array<{ path: string; content: string }>) {
  return {
    read: async (request: { scope: string }) => ({
      documents:
        request.scope === "company"
          ? documents.map((d) => ({ id: d.path, revision: 1, ...d }))
          : [],
    }),
  } as unknown as MemoryStore;
}

describe("company context for agents", () => {
  it("builds the index fresh from the store each time, so an edit reaches the next run", async () => {
    const docs = [{ path: "acme", content: "# Acme Widget\n\nOld text.\n" }];
    const memory = store(docs);
    expect(await loadCompanyContextIndex(memory, context)).toContain("Old text.");
    docs[0] = { path: "acme", content: "# Acme Widget\n\nNew text.\n" };
    const next = await loadCompanyContextIndex(memory, context);
    expect(next).toContain("New text.");
    expect(next).not.toContain("Old text.");
    docs.length = 0;
    expect(await loadCompanyContextIndex(memory, context)).toBeUndefined();
  });

  it("redacts known secrets before the index text is escaped", async () => {
    const memory = store([{ path: "a", content: "# Acme\n\nKey a<b&c>d is secret.\n" }]);
    const index = await loadCompanyContextIndex(memory, context, (text) =>
      text.replaceAll("a<b&c>d", "[redacted]"),
    );
    expect(index).toContain("[redacted]");
    expect(index).not.toMatch(/a(<|&lt;)b/);
  });

  it("looks a name up, titles first, at most two, and finds nothing for an unknown name", async () => {
    const memory = store([
      { path: "a", content: "# Brand voice\n\nWe write plainly about Acme Widget.\n" },
      { path: "b", content: "# Acme Widget\n\nMakes widgets.\n" },
      { path: "c", content: "# Pricing\n\nAcme Widget is flat priced.\n" },
    ]);
    const found = (await lookupCompanyContext(memory, context, "acme widget")) as {
      sections: { title: string; link: string }[];
    };
    expect(found.sections.map((s) => s.title)).toEqual(["Acme Widget", "Brand voice"]);
    expect(found.sections[0]?.link).toBe("/app/company?view=context&section=b");
    expect(await lookupCompanyContext(memory, context, "Marrowgate")).toEqual({ sections: [] });
    expect(await lookupCompanyContext(memory, context, "")).toHaveProperty("error");
  });
});
