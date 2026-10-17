// @vitest-environment jsdom

import { expect, it } from "vitest";
import { naturalSort } from "../components/data-room/use-data-room-list";
import { canPreviewImage, readDataRoomView, saveDataRoomView, splitSnippet } from "./data-room";

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
