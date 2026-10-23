import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadDataRoomFile } from "./data-room-file";

const state = vi.hoisted(() => ({
  generation: 1,
  space: "space-a",
  download: vi.fn(),
  nodes: new Set<string>(),
  clear: undefined as (() => void) | undefined,
}));
vi.mock("./api", () => ({
  currentApiBase: () => "https://api.example.test",
  selectedSpaceId: () => state.space,
  captureApiRequestContext: async () => ({
    apiBase: "https://api.example.test",
    headers: { authorization: "Bearer invented-token", "x-rakazo-space-id": state.space },
  }),
}));
vi.mock("./session", () => ({
  currentSessionGeneration: () => state.generation,
  registerSessionDiskCache: (clear: () => void) => {
    state.clear = clear;
  },
}));
vi.mock("./i18n", () => ({ t: (value: string) => value }));
vi.mock("expo-file-system", () => {
  class Node {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/");
    }
    get exists() {
      return state.nodes.has(this.uri);
    }
    create() {
      state.nodes.add(this.uri);
      state.nodes.add("file:///cache/data-room");
    }
    delete() {
      for (const key of state.nodes) if (key.startsWith(this.uri)) state.nodes.delete(key);
    }
  }
  class File extends Node {
    static downloadFileAsync = state.download;
  }
  return { File, Directory: Node, Paths: { cache: "file:///cache" } };
});

const item = { id: "item/one", name: "../plan.pdf", mimeType: "application/pdf" };
beforeEach(() => {
  state.generation = 1;
  state.space = "space-a";
  state.nodes.clear();
  state.download.mockReset().mockImplementation(async (_url, file) => {
    file.create();
    return file;
  });
});

describe("Data room downloads", () => {
  it("downloads only through the authenticated route and removes its temporary file", async () => {
    const result = await downloadDataRoomFile(item, new AbortController().signal);
    expect(state.download).toHaveBeenCalledWith(
      "https://api.example.test/api/data-room/items/item%2Fone/content",
      expect.anything(),
      expect.objectContaining({
        headers: { authorization: "Bearer invented-token", "x-rakazo-space-id": "space-a" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.file.uri).toMatch(/\/plan\.pdf$/);
    expect(result.file.uri).not.toContain("invented-token");
    result.assertCurrent();
    result.dispose();
    expect(state.nodes.size).toBe(1);
  });

  it.each(["session", "space", "abort"])(
    "rejects a late download after %s changes and deletes its bytes",
    async (change) => {
      const controller = new AbortController();
      state.download.mockImplementation(async (_url, file) => {
        file.create();
        if (change === "session") state.generation += 1;
        if (change === "space") state.space = "space-b";
        if (change === "abort") controller.abort();
        return file;
      });
      await expect(downloadDataRoomFile(item, controller.signal)).rejects.toThrow(
        "session changed",
      );
      expect(state.nodes.size).toBe(1);
    },
  );

  it("cleans a partial failed download instead of treating it as a cache hit", async () => {
    state.download.mockImplementation(async (_url, file) => {
      file.create();
      throw new Error("download failed");
    });
    await expect(downloadDataRoomFile(item, new AbortController().signal)).rejects.toThrow(
      "download failed",
    );
    expect(state.nodes.size).toBe(1);
  });

  it("clears files on sign-out and blocks later sharing under a different session", async () => {
    const result = await downloadDataRoomFile(item, new AbortController().signal);
    state.generation += 1;
    state.clear?.();
    expect(state.nodes.size).toBe(0);
    expect(() => result.assertCurrent()).toThrow("session changed");
  });
});
