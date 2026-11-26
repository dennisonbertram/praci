import { t } from "@lingui/core/macro";
import type { DataRoomApiImport, DataRoomApiItem } from "@rakazo/contracts";
import { enqueueNotificationToast, notificationToastManager } from "@rakazo/ui-web";
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
  | "zip-too-many-files"
  | "zip-encrypted"
  | "zip-unsafe"
  | "zip-invalid"
  | "network"
  | "failed";
const UPLOAD_FAILURES = [
  "invalid",
  "folder-gone",
  "zip-too-large",
  "zip-too-many-files",
  "zip-encrypted",
  "zip-unsafe",
  "zip-invalid",
  "network",
];
export type UploadToast = {
  id: number;
  key?: string;
  name: string;
  state:
    | {
        kind: "uploading";
        fraction: number;
        cancel: () => void;
        /** Set when no progress arrived for a while: the card then offers Cancel and Retry. */
        stalled?: { cancel: () => void; retry: () => void };
      }
    /** After the upload: a zip being unpacked; `progress` is its import row, null until read. */
    | { kind: "importing"; progress: DataRoomApiImport | null }
    /**
     * A zip was filed: `count` files, 0 when all of them were in the Data room already.
     * `failed` entries could not be imported; a card with failures stays until its X.
     */
    | { kind: "imported"; count: number; failed?: number }
    /**
     * `existing` is set when an identical file was already there and nothing new was stored: its
     * name when it differs from the upload's, and the folder path it is in, if any.
     */
    | {
        kind: "uploaded";
        itemId: string;
        /** The folder path the new file went into; unset at the top level. */
        folder?: string;
        existing?: { name?: string; folder?: string };
      }
    /**
     * `toTop` uploads the same file to the top level instead (the folder was deleted).
     * `retry` re-uploads the same file; only network and server failures can be retried.
     */
    | { kind: "error"; reason: UploadFailure; toTop?: () => void; retry?: () => void }
    | { kind: "deleted" }
    | { kind: "renamed" }
    /** An Auto-sort was applied; `undo` reverses that batch. */
    | { kind: "sorted"; count: number; undo: () => void };
};

/** An upload that reports no progress for this long is called slow, and can be cancelled or retried. */
const UPLOAD_STALL_MS = 15_000;
// A finished toast clears after 8 s. A failed one stays until its X: the user may have looked away.
const DONE_TOAST_MS = 8_000;
/** Short: it only confirms, and it sits over the lower right of the page. */
const DELETED_TOAST_MS = 5_000;
/** The Auto-sort toast carries Undo, so it stays longer. */
const UNDO_TOAST_MS = 10_000;
const HELD_RECHECK_MS = 2_000;
const FOLLOW_MS = 1_000;
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
const notices = new Set<string>();
function sync() {
  const next = `${user}:${selectedSpaceId()}`;
  if (next === scope) return;
  scope = next;
  epoch += 1;
  toasts = [];
  // Notices name documents and investors: they must not outlive the user or space they were for.
  for (const noticeId of notices) notificationToastManager.close(noticeId);
  notices.clear();
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

/** Zip imports a card narrates; the import activity row leaves them out. */
const narrated = new Set<string>();
export const isNarratedImport = (importId: string) => narrated.has(importId);

/** Follows a zip's import row until it is unpacked and read, or fails. */
async function followImport(id: number, importId: string, current: () => boolean) {
  narrated.add(importId);
  // Set once the zip was opened far enough to add entries: then an all-failed finish is a
  // real result, not "This zip can't be read".
  let opened = false;
  while (current()) {
    await new Promise((resolve) => setTimeout(resolve, FOLLOW_MS));
    const row = await rpc.dataRoom
      .imports()
      .then((all) => all.find((entry) => entry.id === importId) ?? null)
      .catch(() => undefined);
    if (!current()) return;
    if (row === undefined) continue;
    // Gone from the list: it finished with nothing new.
    if (row === null || (row.finished && row.done === 0 && row.failed === 0)) {
      update(id, { kind: "imported", count: 0 });
      return dismissLater(id, DONE_TOAST_MS);
    }
    if (row.stage === "adding") opened = true;
    if (row.finished) {
      // Nothing was filed and the zip was never opened: it could not be read.
      if (row.done === 0 && !opened) {
        return update(id, { kind: "error", reason: "zip-invalid" });
      }
      update(id, {
        kind: "imported",
        count: row.done,
        ...(row.failed > 0 ? { failed: row.failed } : {}),
      });
      window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
      // Entries failed: the card stays until its X, like every other failed card.
      if (row.failed === 0) dismissLater(id, DONE_TOAST_MS);
      return;
    }
    update(id, { kind: "importing", progress: row });
  }
}

async function uploadOne(
  file: File,
  folderId: string | undefined,
  onUploaded?: (itemId: string) => void,
  options?: DataRoomUploadOptions,
) {
  const id =
    (options?.key ? toasts.find((toast) => toast.key === options.key)?.id : undefined) ?? nextId++;
  const mine = epoch;
  const current = () => {
    sync();
    return mine === epoch && !options?.signal?.aborted;
  };
  let cancelled = false;
  const active = () => current() && !cancelled;
  // A retry must not file the document into whichever user or space is selected now.
  const sameScope = () => {
    sync();
    if (current()) return true;
    showNoticeToast(t`Not retried: the space changed`);
    return false;
  };
  if (!current()) return false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options?.signal?.addEventListener("abort", abort, { once: true });
  const cancel = () => {
    cancelled = true;
    controller.abort();
    dismissUploadToast(id);
  };
  toasts = [
    ...toasts.filter((toast) => toast.id !== id),
    {
      id,
      key: options?.key,
      name: file.name,
      state: { kind: "uploading", fraction: 0, cancel },
    },
  ];
  notify();
  const fail = (reason: UploadFailure) => {
    const toTop =
      reason === "folder-gone" && !options?.scope
        ? () => {
            dismissUploadToast(id);
            if (sameScope()) void uploadOne(file, undefined, onUploaded, options);
          }
        : undefined;
    const retry =
      reason === "network" || reason === "failed"
        ? () => {
            dismissUploadToast(id);
            if (sameScope()) void uploadOne(file, folderId, onUploaded, options);
          }
        : undefined;
    update(id, {
      kind: "error",
      reason,
      ...(toTop ? { toTop } : {}),
      ...(retry ? { retry } : {}),
    });
  };
  let fraction = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!active()) return;
      update(id, {
        kind: "uploading",
        fraction,
        cancel,
        stalled: {
          cancel,
          retry: () => {
            cancel();
            if (sameScope()) void uploadOne(file, folderId, onUploaded, options);
          },
        },
      });
    }, UPLOAD_STALL_MS);
  };
  watch();
  try {
    const uploaded = await uploadToDataRoom(
      file,
      folderId,
      (next) => {
        fraction = next;
        if (!active()) return;
        update(id, { kind: "uploading", fraction, cancel });
        watch();
      },
      controller.signal,
      options?.scope,
    );
    clearTimeout(timer);
    // A zip is unpacked in the background: this card follows its import row from here.
    if (!("item" in uploaded)) {
      if (options?.scope) throw new Error("A scan must be stored as one document");
      if (!active()) return;
      update(id, { kind: "importing", progress: null });
      dataRoomImportStarted();
      return await followImport(id, uploaded.importId, active);
    }
    const { item, duplicate } = uploaded;
    if (!active()) return false;
    await options?.onStored?.(item);
    const publish = (folder?: string) =>
      update(id, {
        kind: "uploaded",
        itemId: item.id,
        ...(!duplicate && folder ? { folder } : {}),
        ...(duplicate
          ? {
              existing: {
                ...(item.name !== file.name ? { name: item.name } : {}),
                ...(folder ? { folder } : {}),
              },
            }
          : {}),
      });
    if (!active()) return false;
    publish();
    onUploaded?.(item.id);
    window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    dismissLater(id, DONE_TOAST_MS);
    // Where the file is: without it the user goes looking (and "Already there" says nothing
    // useful). Looked up after the toast shows, so a slow request never holds the upload open.
    if (item.folderId) {
      const path = await rpc.dataRoom
        .folders()
        .then((all) => folderNodes(all).find((node) => node.folder.id === item.folderId)?.path)
        .catch(() => undefined);
      if (path && active()) publish(path);
    }
    return true;
  } catch (error) {
    clearTimeout(timer);
    // Cancelled or retried from the card: it has already gone.
    if (!active() || (error instanceof DataRoomUploadError && error.message === "aborted")) return;
    const reason =
      error instanceof DataRoomUploadError && UPLOAD_FAILURES.includes(error.message)
        ? (error.message as UploadFailure)
        : "failed";
    fail(reason);
    // The open page still shows the deleted folder: reload, so it falls back to All items.
    if (reason === "folder-gone") window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    return false;
  } finally {
    options?.signal?.removeEventListener("abort", abort);
  }
}

export interface DataRoomUploadOptions {
  key?: string;
  scope?: { source: "scan"; userId: string; spaceId: string };
  signal?: AbortSignal;
  onStored?: (item: DataRoomApiItem) => Promise<void>;
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
export function uploadFilesToDataRoom(
  files: Iterable<File>,
  folderId?: string,
  /** Called with the new item's id once a file is stored (not for zips). */
  onUploaded?: (itemId: string) => void,
  options?: DataRoomUploadOptions,
) {
  sync();
  const destination = folderId ?? (options?.scope ? undefined : openFolder);
  return Promise.all(
    Array.from(files, (file) => uploadOne(file, destination, onUploaded, options)),
  );
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
/** A short message, such as a link to a folder that no longer exists, in the app's shared toast host. */
export const showNoticeToast = (text: string, since?: number) => {
  sync();
  // `since` is a uploadScopeToken() taken before a slow call; a changed user or space drops the toast.
  if (since !== undefined && since !== epoch) return;
  const noticeId = `data-room-notice-${nextId++}`;
  notices.add(noticeId);
  enqueueNotificationToast({ id: noticeId, title: text, onClose: () => notices.delete(noticeId) });
};
/** Identifies the current user and space; pass it to showNoticeToast to drop a toast that outlives them. */
export function uploadScopeToken() {
  sync();
  return epoch;
}

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
  dismissLater(id, UNDO_TOAST_MS);
}

/** Shows a toast in any state and keeps it; for Storybook, which has no upload to run. */
export function showToastForStory(name: string, state: UploadToast["state"]) {
  sync();
  toasts = [...toasts, { id: nextId++, name, state }];
  notify();
}
