// @vitest-environment jsdom

import { expect, it, vi } from "vitest";
import { naturalSort } from "../components/data-room/use-data-room-list";
import {
  canPreviewImage,
  openDataRoomItem,
  readDataRoomView,
  saveDataRoomView,
  splitSnippet,
} from "./data-room";

it("splits a snippet into text and highlighted parts on the control markers", () => {
  expect(splitSnippet("a \u0001b\u0002 c \u0001d\u0002")).toEqual([
    { text: "a ", mark: false },
    { text: "b", mark: true },
    { text: " c ", mark: false },
    { text: "d", mark: true },
  ]);
});

it("keeps text with no markers whole, and tolerates a missing end marker", () => {
  expect(splitSnippet("plain")).toEqual([{ text: "plain", mark: false }]);
  expect(splitSnippet("x \u0001open")).toEqual([
    { text: "x ", mark: false },
    { text: "open", mark: true },
  ]);
  expect(splitSnippet("")).toEqual([]);
});

it("remembers the view and sort, and falls back to the defaults for anything unreadable", () => {
  localStorage.clear();
  expect(readDataRoomView()).toEqual({
    view: "list",
    sort: { field: "createdAt", direction: "desc" },
  });
  saveDataRoomView({ view: "grid", sort: { field: "name", direction: "asc" } });
  expect(readDataRoomView()).toEqual({ view: "grid", sort: { field: "name", direction: "asc" } });
  localStorage.setItem("rakazo.dataRoomView", '{"view":"x","sort":{"field":"drop table"}}');
  expect(readDataRoomView()).toEqual({
    view: "list",
    sort: { field: "createdAt", direction: "desc" },
  });
  localStorage.setItem("rakazo.dataRoomView", "{not json");
  expect(readDataRoomView().view).toBe("list");
});

it("starts names and types A to Z and dates newest first", () => {
  expect(naturalSort("name").direction).toBe("asc");
  expect(naturalSort("type").direction).toBe("asc");
  expect(naturalSort("date").direction).toBe("desc");
  expect(naturalSort("createdAt").direction).toBe("desc");
});

it("previews raster images only, never SVG, and not very large ones", () => {
  expect(canPreviewImage({ mimeType: "image/png", size: 1_000 })).toBe(true);
  expect(canPreviewImage({ mimeType: "image/svg+xml", size: 1_000 })).toBe(false);
  expect(canPreviewImage({ mimeType: "application/pdf", size: 1_000 })).toBe(false);
  expect(canPreviewImage({ mimeType: "image/jpeg", size: 50_000_000 })).toBe(false);
});

it("opens a file in a new tab titled with its name, not the blob's random id", async () => {
  const tabDoc = document.implementation.createHTMLDocument("");
  const tab = { document: tabDoc, opener: window, close: vi.fn() } as unknown as Window;
  vi.spyOn(window, "open").mockReturnValue(tab);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["%PDF"]))));
  URL.createObjectURL = vi.fn(() => "blob:http://x/1234-uuid");
  URL.revokeObjectURL = vi.fn();
  await openDataRoomItem({ id: "i1", mimeType: "application/pdf", name: "MOCK NDA.pdf" });
  expect(tabDoc.title).toBe("MOCK NDA.pdf");
  expect(tabDoc.querySelector("iframe")?.getAttribute("src")).toBe("blob:http://x/1234-uuid");
  expect(tab.opener).toBeNull();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("saves the file instead when the new tab is refused", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["%PDF"])));
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  await openDataRoomItem({ id: "i1", mimeType: "application/pdf", name: "MOCK NDA.pdf" });
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("downloads a file the browser cannot show, and never opens a tab for it", async () => {
  const open = vi.spyOn(window, "open");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["<script>"]))));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  await openDataRoomItem({ id: "i1", mimeType: "text/html", name: "page.html" });
  expect(open).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
