import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import { DATA_ROOM_CHANGED, DataRoomUploadError, uploadToDataRoom } from "../../lib/data-room";

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
let nextId = 1;
let toasts: UploadToast[] = [];
const listeners = new Set<() => void>();

function update(id: number, state: UploadToast["state"]) {
  toasts = toasts.map((toast) => (toast.id === id ? { ...toast, state } : toast));
  for (const listener of listeners) listener();
}

export function dismissUploadToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  for (const listener of listeners) listener();
}

export const subscribeUploadToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getUploadToasts = () => toasts;

async function uploadOne(file: File) {
  const id = nextId++;
  toasts = [...toasts, { id, name: file.name, state: { kind: "uploading", fraction: 0 } }];
  update(id, { kind: "uploading", fraction: 0 });
  // The server enforces the limit; this only avoids sending a file that will be refused.
  if (file.size > DATA_ROOM_UPLOAD_MAX_BYTES) {
    return update(id, { kind: "error", reason: "too-large" });
  }
  try {
    const { item } = await uploadToDataRoom(file, (fraction) =>
      update(id, { kind: "uploading", fraction }),
    );
    update(id, { kind: "filed", itemId: item.id });
    window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    setTimeout(() => dismissUploadToast(id), FILED_TOAST_MS);
  } catch (error) {
    update(id, {
      kind: "error",
      reason:
        error instanceof DataRoomUploadError &&
        (error.message === "too-large" || error.message === "invalid")
          ? error.message
          : "failed",
    });
  }
}

/** Uploads each file to the Data room root, one toast per file. */
export function uploadFilesToDataRoom(files: Iterable<File>) {
  for (const file of files) void uploadOne(file);
}
