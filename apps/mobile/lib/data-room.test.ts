import { UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rpc } from "./api";
import {
  dataRoomPreviewKind,
  dataRoomStatus,
  getDataRoomItem,
  listDataRoomFolders,
  listDataRoomItems,
} from "./data-room";

vi.mock("./api", () => ({ rpc: vi.fn() }));
vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));
vi.mock("./i18n", () => ({ t: (text: string) => text }));

beforeEach(() => vi.mocked(rpc).mockReset());

describe("mobile Data room RPCs", () => {
  it("lists the same folder IDs and sends a folder and cursor to the scoped item RPC", async () => {
    vi.mocked(rpc).mockResolvedValue({ items: [], nextCursor: null });
    await listDataRoomFolders();
    await listDataRoomItems({ folderId: "folder-a", cursor: "page-2" });
    await getDataRoomItem("item-a");
    expect(rpc).toHaveBeenNthCalledWith(1, "dataRoom/folders");
    expect(rpc).toHaveBeenNthCalledWith(2, "dataRoom/items/list", {
      folderId: "folder-a",
      cursor: "page-2",
      limit: 30,
      sort: { field: "createdAt", direction: "desc" },
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "dataRoom/item", { id: "item-a" });
  });

  it("searches on the server, preserving the folder filter and next cursor", async () => {
    const item = { id: "item-a" };
    vi.mocked(rpc).mockResolvedValue({
      results: [{ item, snippet: "invented" }],
      nextCursor: "next",
    });
    expect(
      await listDataRoomItems({ folderId: "folder-a", query: "  budget  ", cursor: "previous" }),
    ).toEqual({ items: [item], nextCursor: "next" });
    expect(rpc).toHaveBeenCalledWith("dataRoom/search", {
      query: "budget",
      filters: { folderId: "folder-a" },
      cursor: "previous",
      limit: 30,
    });
  });
});

describe("native previews", () => {
  it.each([
    ["plan.pdf", "application/pdf", "pdf"],
    ["plan.pdf", "application/pdf; charset=binary", "pdf"],
    ["budget.csv", "text/csv", "sheet"],
    ["photo.png", "image/png", "image"],
    ["summary.json", UI_ARTIFACT_MIME_TYPE, "ui"],
    ["page.html", "text/html", "other"],
  ])("routes %s to its safe preview", (name, mimeType, kind) => {
    expect(dataRoomPreviewKind({ name, mimeType, size: 120 })).toBe(kind);
  });
  it("does not preview oversized documents and reports processing states", () => {
    expect(
      dataRoomPreviewKind({
        name: "large.pdf",
        mimeType: "application/pdf",
        size: 20 * 1024 * 1024,
      }),
    ).toBe("other");
    expect(dataRoomStatus({ status: "indexing", notIndexed: false })).toBe("Processing…");
    expect(dataRoomStatus({ status: "failed", notIndexed: false })).toBe("Failed");
    expect(dataRoomStatus({ status: "ready", notIndexed: true })).toBe("Not searchable");
  });
});
