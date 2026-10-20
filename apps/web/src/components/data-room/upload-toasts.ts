import { t } from "@lingui/core/macro";
import {
  DATA_ROOM_CHANGED,
  DataRoomUploadError,
  dataRoomImportStarted,
  uploadToDataRoom,
} from "../../lib/data-room";
import { rpc, selectedSpaceId } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { folderNodes } from "./folders";

export type UploadFailure =
  | "invalid"
  | "folder-gone"
  | "zip-too-large"
  | "zip-encrypted"
  | "zip-unsafe"
  | "zip-invalid"
  | "failed";
const UPLOAD_FAILURES = [
  "invalid",
  "folder-gone",
  "zip-too-large",
  "zip-encrypted",
  "zip-unsafe",
  "zip-invalid",
];
export type UploadToast = {
  id: number;
  name: string;
  state:
    | { kind: "uploading"; fraction: number }
    /**
     * `existing` is set when an identical file was already there and nothing new was stored: its
     * name when it differs from the upload's, and the folder path it is in, if any.
     */
    | { kind: "uploaded"; itemId: string; existing?: { name?: string; folder?: string } }
    /** `toTop` uploads the same file to the top level instead (the folder was deleted). */
    | { kind: "error"; reason: UploadFailure; toTop?: () => void }
    | { kind: "deleted" }
    | { kind: "renamed" }
    /** A one-line message; the toast's `name` is the text. */
    | { kind: "notice" }
    /** An Auto-sort was applied; `undo` reverses that batch. */
    | { kind: "sorted"; count: number; undo: () => void };
};

const DONE_TOAST_MS = 10_000;
const FAILED_TOAST_MS = 15_000;
/** Short: it only confirms, and it sits over the lower right of the page. */
const DELETED_TOAST_MS = 5_000;
const HELD_RECHECK_MS = 2_000;
let nextId = 1;
let toasts: UploadToast[] = [];
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

// The toasts belong to one signed-in user in one space. When either changes, they are cleared and
// uploads still running from the earlier session stop reporting.
let user: string | null = null;
let scope = "";
let epoch = 0;
function sync() {
  const next = `${user}:${selectedSpaceId()}`;
  if (next === scope) return;
  scope = next;
  epoch += 1;
  toasts = [];
}

/** Call with the signed-in user's id, or null on sign-out. */
export function setUploadScope(userId: string | null) {
  user = userId;
  sync();
  notify();
}

function update(id: number, state: UploadToast["state"]) {
  toasts = toasts.map((toast) => (toast.id === id ? { ...toast, state } : toast));
  notify();
}

/** True while the pointer is over the toasts: none of them goes away under it. */
let held = false;
export function holdUploadToasts(hold: boolean) {
  held = hold;
}
/** Dismisses the toast after `ms`, or as soon after that as the toasts are no longer held. */
function dismissLater(id: number, ms: number) {
  setTimeout(() => (held ? dismissLater(id, HELD_RECHECK_MS) : dismissUploadToast(id)), ms);
}

export function dismissUploadToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  // With no toasts left there is nothing under the pointer, and no pointerleave will come.
  if (toasts.length === 0) held = false;
  notify();
}

export const subscribeUploadToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getUploadToasts = () => {
  sync();
  return toasts;
};

async function uploadOne(file: File, folderId: string | undefined) {
  const id = nextId++;
  const mine = epoch;
  const current = () => mine === epoch;
  toasts = [...toasts, { id, name: file.name, state: { kind: "uploading", fraction: 0 } }];
  notify();
  const fail = (reason: UploadFailure) => {
    const toTop =
      reason === "folder-gone"
        ? () => {
            dismissUploadToast(id);
            void uploadOne(file, undefined);
          }
        : undefined;
    update(id, { kind: "error", reason, ...(toTop ? { toTop } : {}) });
    dismissLater(id, FAILED_TOAST_MS);
  };
  try {
    const uploaded = await uploadToDataRoom(file, folderId, (fraction) => {
      if (current()) update(id, { kind: "uploading", fraction });
    });
    // A zip is unpacked in the background: the import row shows its progress from here.
    if (!("item" in uploaded)) {
      if (!current()) return;
      dismissUploadToast(id);
      dataRoomImportStarted();
      return;
    }
    const { item, duplicate } = uploaded;
    // Where the file already is: without it "Already there" leaves the user to go looking.
    const folder =
      duplicate && item.folderId
        ? await rpc.dataRoom
            .folders()
            .then((all) => folderNodes(all).find((node) => node.folder.id === item.folderId)?.path)
            .catch(() => undefined)
        : undefined;
    if (!current()) return;
    update(id, {
      kind: "uploaded",
      itemId: item.id,
      ...(duplicate
        ? {
            existing: {
              ...(item.name !== file.name ? { name: item.name } : {}),
              ...(folder ? { folder } : {}),
            },
          }
        : {}),
    });
    window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    dismissLater(id, DONE_TOAST_MS);
  } catch (error) {
    if (!current()) return;
    const reason =
      error instanceof DataRoomUploadError && UPLOAD_FAILURES.includes(error.message)
        ? (error.message as UploadFailure)
        : "failed";
    fail(reason);
    // The open page still shows the deleted folder: reload, so it falls back to All items.
    if (reason === "folder-gone") window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
  }
}

/** The folder the open Data room page shows, if any; uploads from anywhere go there. */
let openFolder: string | undefined;
export function setOpenDataRoomFolder(folderId: string | undefined) {
  openFolder = folderId;
}

/**
 * Uploads each file into `folderId`, else the folder the Data room page shows (else the root), one
 * toast per file.
 */
export function uploadFilesToDataRoom(files: Iterable<File>, folderId = openFolder) {
  sync();
  for (const file of files) void uploadOne(file, folderId);
}

function showShortToast(name: string, state: UploadToast["state"]) {
  sync();
  const id = nextId++;
  toasts = [...toasts, { id, name, state }];
  notify();
  dismissLater(id, DELETED_TOAST_MS);
}

/** A toast saying the item was deleted; deleting has no other visible trace. */
export const showDeletedToast = (name: string) => showShortToast(name, { kind: "deleted" });
/** A toast confirming a rename, under the new name. */
export const showRenamedToast = (name: string) => showShortToast(name, { kind: "renamed" });
/** A short message, such as a link to a folder that no longer exists. */
export const showNoticeToast = (text: string) => showShortToast(text, { kind: "notice" });

/** A toast saying how many items an Auto-sort touched, with Undo for that batch. */
export function showSortedToast(count: number, batchId: string) {
  sync();
  const id = nextId++;
  const undo = () => {
    dismissUploadToast(id);
    rpc.dataRoom.autoSort
      .undo({ batchId })
      .then(({ restored, skipped }) => {
        window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
        showNoticeToast(skipped ? t`Undid ${restored}, skipped ${skipped}` : t`Undid ${restored}`);
      })
      .catch((error: unknown) => showNoticeToast(errorText(error)));
  };
  toasts = [...toasts, { id, name: "", state: { kind: "sorted", count, undo } }];
  notify();
  dismissLater(id, DONE_TOAST_MS);
}
