import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import { DATA_ROOM_CHANGED, DataRoomUploadError, uploadToDataRoom } from "../../lib/data-room";
import { rpc, selectedSpaceId } from "../../lib/rpc";
import { folderNodes } from "./folders";

export type UploadFailure = "too-large" | "invalid" | "failed";
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
    | { kind: "error"; reason: UploadFailure }
    | { kind: "deleted" };
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
    update(id, { kind: "error", reason });
    dismissLater(id, FAILED_TOAST_MS);
  };
  // The server enforces the limit; this only avoids sending a file that will be refused.
  if (file.size > DATA_ROOM_UPLOAD_MAX_BYTES) return fail("too-large");
  try {
    const { item, duplicate } = await uploadToDataRoom(file, folderId, (fraction) => {
      if (current()) update(id, { kind: "uploading", fraction });
    });
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
    fail(
      error instanceof DataRoomUploadError &&
        (error.message === "too-large" || error.message === "invalid")
        ? error.message
        : "failed",
    );
  }
}

/** The folder the open Data room page shows, if any; uploads from anywhere go there. */
let openFolder: string | undefined;
export function setOpenDataRoomFolder(folderId: string | undefined) {
  openFolder = folderId;
}

/** Uploads each file into the folder the Data room page shows (else the root), one toast per file. */
export function uploadFilesToDataRoom(files: Iterable<File>) {
  sync();
  const folderId = openFolder;
  for (const file of files) void uploadOne(file, folderId);
}

/** A toast saying the item was deleted; deleting has no other visible trace. */
export function showDeletedToast(name: string) {
  sync();
  const id = nextId++;
  toasts = [...toasts, { id, name, state: { kind: "deleted" } }];
  notify();
  dismissLater(id, DELETED_TOAST_MS);
}
