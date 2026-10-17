import type { DataRoomApiItem } from "@rakazo/contracts";
import { DataRoomApiUploadResponseSchema } from "@rakazo/contracts";
import { withSpaceHeaders } from "./rpc";

export const DATA_ROOM_PATH = "/app/data-room";
/** Fired on `window` after an upload finishes, so an open Data room page reloads. */
export const DATA_ROOM_CHANGED = "rakazo:data-room-changed";

export const dataRoomItemPath = (id: string) => `${DATA_ROOM_PATH}?item=${encodeURIComponent(id)}`;

type DataRoomView = {
  view: "list" | "grid";
  sort: { field: "date" | "name" | "type" | "createdAt"; direction: "asc" | "desc" };
};
const VIEW_KEY = "rakazo.dataRoomView";
const DEFAULT_VIEW: DataRoomView = {
  view: "list",
  sort: { field: "createdAt", direction: "desc" },
};

/** The list or grid view and list sort this browser chose last; the defaults when none or unreadable. */
export function readDataRoomView(): DataRoomView {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
    const view = saved?.view === "grid" ? "grid" : "list";
    const field = ["date", "name", "type", "createdAt"].includes(saved?.sort?.field)
      ? saved.sort.field
      : DEFAULT_VIEW.sort.field;
    const direction = saved?.sort?.direction === "asc" ? "asc" : "desc";
    return saved ? { view, sort: { field, direction } } : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveDataRoomView(value: DataRoomView) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

export type SnippetPart = { text: string; mark: boolean };

/** Splits a search snippet on its U+0001 / U+0002 highlight markers. The parts are rendered as text. */
export function splitSnippet(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let mark = false;
  let text = "";
  for (const char of snippet) {
    if (char === "\u0001" || char === "\u0002") {
      if (text) parts.push({ text, mark });
      text = "";
      mark = char === "\u0001";
    } else {
      text += char;
    }
  }
  if (text) parts.push({ text, mark });
  return parts;
}

/** True while a drag carries files (and not, say, selected text or a link). */
export const dragHasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

/** An item that a background job is still working on. */
export const isInProgress = (item: DataRoomApiItem) =>
  item.status !== "ready" && item.status !== "failed";

export class DataRoomUploadError extends Error {}

/**
 * Uploads one file into a folder (the Data room root when `folderId` is omitted). XMLHttpRequest is
 * used because fetch reports no upload progress.
 */
export function uploadToDataRoom(
  file: File,
  folderId: string | undefined,
  onProgress: (fraction: number) => void,
): Promise<{ item: DataRoomApiItem; duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const query = new URLSearchParams({ name: file.name, ...(folderId ? { folderId } : {}) });
    request.open("POST", `/api/data-room/upload?${query}`);
    request.withCredentials = true;
    withSpaceHeaders().forEach((value, key) => {
      request.setRequestHeader(key, value);
    });
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onerror = () => reject(new DataRoomUploadError("failed"));
    request.onload = () => {
      if (request.status === 413) return reject(new DataRoomUploadError("too-large"));
      if (request.status === 400) return reject(new DataRoomUploadError("invalid"));
      // The only 404 is the folder: deleted since the page loaded it.
      if (request.status === 404) return reject(new DataRoomUploadError("folder-gone"));
      if (request.status < 200 || request.status >= 300) {
        return reject(new DataRoomUploadError("failed"));
      }
      try {
        resolve(DataRoomApiUploadResponseSchema.parse(JSON.parse(request.responseText)));
      } catch {
        reject(new DataRoomUploadError("failed"));
      }
    };
    request.send(file);
  });
}

/** The stored bytes, fetched with the session and space header. */
async function fetchDataRoomBlob(item: Pick<DataRoomApiItem, "id">) {
  const response = await fetch(`/api/data-room/items/${encodeURIComponent(item.id)}/content`, {
    headers: withSpaceHeaders(),
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  return response.blob();
}

/** Saves the bytes; the file is never opened in the page. */
export async function saveDataRoomItem(item: Pick<DataRoomApiItem, "id" | "name">) {
  const url = URL.createObjectURL(await fetchDataRoomBlob(item));
  const link = document.createElement("a");
  link.href = url;
  link.download = item.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Raster images an <img> can show. SVG is left out: it is a document, not a picture. */
const PREVIEW_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const PREVIEW_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const canPreviewImage = (item: Pick<DataRoomApiItem, "mimeType" | "size">) =>
  PREVIEW_IMAGE_TYPES.has(item.mimeType) && item.size <= PREVIEW_IMAGE_MAX_BYTES;

/** An object URL of the item as an image (typed by us, never by the server), for an <img>. */
export async function dataRoomImageUrl(item: Pick<DataRoomApiItem, "id" | "mimeType">) {
  const blob = await fetchDataRoomBlob(item);
  return URL.createObjectURL(new Blob([blob], { type: item.mimeType }));
}

/** PDFs and raster images, which the browser shows by itself; anything else only downloads. */
export const canOpenInBrowser = (item: Pick<DataRoomApiItem, "mimeType">) =>
  item.mimeType === "application/pdf" || PREVIEW_IMAGE_TYPES.has(item.mimeType);

/**
 * Shows the file in a new tab, typed by us (never by the server), for reading without saving it.
 * The tab opens at once, before the bytes arrive, so the browser does not block it as a pop-up.
 */
export async function openDataRoomItem(item: Pick<DataRoomApiItem, "id" | "mimeType">) {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const blob = await fetchDataRoomBlob(item);
    const url = URL.createObjectURL(new Blob([blob], { type: item.mimeType }));
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
