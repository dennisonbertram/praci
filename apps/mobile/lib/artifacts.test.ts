import { describe, expect, it, vi } from "vitest";
import { artifactThreadTarget, isSpreadsheetArtifact } from "./artifacts";

vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));
vi.mock("./api", () => ({ rpc: vi.fn() }));

describe("artifactThreadTarget", () => {
  it("points at the bot or the group the artifact belongs to", () => {
    expect(artifactThreadTarget({ botId: "bot-1", groupId: null })).toEqual({ botId: "bot-1" });
    expect(artifactThreadTarget({ botId: null, groupId: "group-1" })).toEqual({
      groupId: "group-1",
    });
  });

  it("prefers the group when both are set, and has no target when neither is", () => {
    expect(artifactThreadTarget({ botId: "bot-1", groupId: "group-1" })).toEqual({
      groupId: "group-1",
    });
    expect(artifactThreadTarget({ botId: null, groupId: null })).toBeNull();
  });
});

describe("isSpreadsheetArtifact", () => {
  it("accepts xlsx, xlsm, csv and tsv but not legacy xls", () => {
    expect(isSpreadsheetArtifact("a.xlsx", "application/octet-stream")).toBe(true);
    expect(isSpreadsheetArtifact("a.csv", "text/csv")).toBe(true);
    expect(isSpreadsheetArtifact("a.tsv", "text/plain")).toBe(true);
    expect(isSpreadsheetArtifact("a.xls", "application/vnd.ms-excel")).toBe(false);
    expect(isSpreadsheetArtifact("a.pdf", "application/pdf")).toBe(false);
  });
});
