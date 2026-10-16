import type { DataRoomApiItem } from "@rakazo/contracts";
import { DataRoomApiUploadResponseSchema } from "@rakazo/contracts";
import { withSpaceHeaders } from "./rpc";

export const DATA_ROOM_PATH = "/app/data-room";
/** Fired on `window` after an upload finishes, so an open Data room page reloads. */
export const DATA_ROOM_CHANGED = "rakazo:data-room-changed";

export const dataRoomItemPath = (id: string) => `${DATA_ROOM_PATH}?item=${encodeURIComponent(id)}`;

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

/** Uploads one file to the Data room root; XMLHttpRequest is used because fetch reports no upload progress. */
export function uploadToDataRoom(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ item: DataRoomApiItem; duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/data-room/upload?name=${encodeURIComponent(file.name)}`);
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

/** Fetches with the session and space header, then saves the bytes; the file is never opened in the page. */
export async function saveDataRoomItem(item: Pick<DataRoomApiItem, "id" | "name">) {
  const response = await fetch(`/api/data-room/items/${encodeURIComponent(item.id)}/content`, {
    headers: withSpaceHeaders(),
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = item.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
