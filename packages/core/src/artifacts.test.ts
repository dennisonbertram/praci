import { describe, expect, it } from "vitest";
import { matchesArtifactQuery, mimeBadgeLabel } from "./artifacts.js";

describe("mimeBadgeLabel", () => {
  it("labels the well-known artifact mime types", () => {
    expect(mimeBadgeLabel("text/html")).toBe("HTML");
    expect(mimeBadgeLabel("text/markdown")).toBe("MD");
    expect(mimeBadgeLabel("application/pdf")).toBe("PDF");
  });

  it("falls back to the subtype for anything else", () => {
    expect(mimeBadgeLabel("image/png")).toBe("PNG");
    expect(mimeBadgeLabel("application/json")).toBe("JSON");
  });
});

describe("matchesArtifactQuery", () => {
  const item = { name: "Landing page draft.html", description: "Hero + pricing section" };

  it("matches an empty query", () => {
    expect(matchesArtifactQuery(item, "")).toBe(true);
    expect(matchesArtifactQuery(item, "   ")).toBe(true);
  });

  it("matches case-insensitively against the name or description", () => {
    expect(matchesArtifactQuery(item, "LANDING")).toBe(true);
    expect(matchesArtifactQuery(item, "pricing")).toBe(true);
    expect(matchesArtifactQuery(item, "nope")).toBe(false);
  });

  it("handles a null description", () => {
    expect(matchesArtifactQuery({ name: "Notes.md", description: null }, "notes")).toBe(true);
    expect(matchesArtifactQuery({ name: "Notes.md", description: null }, "hero")).toBe(false);
  });
});
