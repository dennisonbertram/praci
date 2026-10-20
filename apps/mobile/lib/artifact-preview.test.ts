import { describe, expect, it, vi } from "vitest";
import { computePreview } from "./artifact-preview";

vi.mock("./api", () => ({ rpc: vi.fn() }));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));

const file = { uri: "file:///cache/a.pdf", text: async () => "" };
const preview = (name: string, mimeType: string) =>
  computePreview({ id: "a1", name, mimeType }, file);

describe("computePreview pdf", () => {
  it("previews application/pdf, with or without parameters", async () => {
    expect(await preview("a.pdf", "application/pdf")).toEqual({ kind: "pdf", uri: file.uri });
    expect(await preview("a.pdf", "application/pdf; charset=binary")).toEqual({
      kind: "pdf",
      uri: file.uri,
    });
  });
  it("leaves other types unsupported", async () => {
    expect(await preview("a.zip", "application/zip")).toEqual({ kind: "unsupported" });
  });
});
