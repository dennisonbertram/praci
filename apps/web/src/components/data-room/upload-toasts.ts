import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import { DATA_ROOM_CHANGED, DataRoomUploadError, uploadToDataRoom } from "../../lib/data-room";
import { selectedSpaceId } from "../../lib/rpc";

export type UploadFailure = "too-large" | "invalid" | "failed";
export type UploadToast = {
  id: number;
  name: string;
  state:
    | { kind: "uploading"; fraction: number }
    | { kind: "filed"; itemId: string }
    | { kind: "error"; reason: UploadFailure };
};

const FILED_TOAST_MS = 8_000;
const FAILED_TOAST_MS = 15_000;
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

export function dismissUploadToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
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

async function uploadOne(file: File) {
  const id = nextId++;
  const mine = epoch;
  const current = () => mine === epoch;
  toasts = [...toasts, { id, name: file.name, state: { kind: "uploading", fraction: 0 } }];
  notify();
  const fail = (reason: UploadFailure) => {
    update(id, { kind: "error", reason });
    setTimeout(() => dismissUploadToast(id), FAILED_TOAST_MS);
  };
  // The server enforces the limit; this only avoids sending a file that will be refused.
  if (file.size > DATA_ROOM_UPLOAD_MAX_BYTES) return fail("too-large");
  try {
    const { item } = await uploadToDataRoom(file, (fraction) => {
      if (current()) update(id, { kind: "uploading", fraction });
    });
    if (!current()) return;
    update(id, { kind: "filed", itemId: item.id });
    window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    setTimeout(() => dismissUploadToast(id), FILED_TOAST_MS);
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

/** Uploads each file to the Data room root, one toast per file. */
export function uploadFilesToDataRoom(files: Iterable<File>) {
  sync();
  for (const file of files) void uploadOne(file);
}
