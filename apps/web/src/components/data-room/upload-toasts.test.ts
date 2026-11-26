// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  upload: vi.fn(),
  enqueue: vi.fn(),
  close: vi.fn(),
  folders: vi.fn(),
  imports: vi.fn(),
  space: { id: "s1" },
}));
vi.mock("@rakazo/ui-web", () => ({
  enqueueNotificationToast: hoisted.enqueue,
  notificationToastManager: { close: hoisted.close },
}));
vi.mock("../../lib/rpc", () => ({
  rpc: { dataRoom: { folders: hoisted.folders, imports: hoisted.imports } },
  selectedSpaceId: () => hoisted.space.id,
  withSpaceHeaders: () => new Headers(),
}));
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  uploadToDataRoom: hoisted.upload,
}));

import { DATA_ROOM_CHANGED, DataRoomUploadError } from "../../lib/data-room";
import {
  dismissUploadToast,
  getUploadToasts,
  holdUploadToasts,
  setOpenDataRoomFolder,
  setUploadScope,
  showDeletedToast,
  showNoticeToast,
  uploadFilesToDataRoom,
  uploadScopeToken,
} from "./upload-toasts";

const names = () => getUploadToasts().map((toast) => toast.name);
const file = (name: string) => new File(["x"], name);
const flush = () => vi.advanceTimersByTimeAsync(0);

it("keeps scanner uploads at their captured root and waits for checksum confirmation before success", async () => {
  setUploadScope("u1");
  setOpenDataRoomFolder("unrelated-folder");
  const scope = { source: "scan" as const, userId: "u1", spaceId: "s1" };
  hoisted.upload.mockResolvedValue({
    item: { id: "i1", name: "Scan.pdf", sha256: "stored" },
    duplicate: true,
  });
  const onStored = vi.fn().mockRejectedValue(new Error("checksum mismatch"));
  await uploadFilesToDataRoom([file("Scan.pdf")], undefined, undefined, {
    scope,
    onStored,
    key: "scanner:i1",
  });
  expect(hoisted.upload).toHaveBeenCalledWith(
    expect.any(File),
    undefined,
    expect.any(Function),
    expect.any(AbortSignal),
    scope,
  );
  expect(onStored).toHaveBeenCalledWith(expect.objectContaining({ sha256: "stored" }));
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "error", reason: "failed" });
  onStored.mockResolvedValue(undefined);
  await uploadFilesToDataRoom([file("Scan.pdf")], undefined, undefined, {
    scope,
    onStored,
    key: "scanner:i1",
  });
  expect(getUploadToasts()).toHaveLength(1);
  expect(getUploadToasts()[0]?.state.kind).toBe("uploaded");
});

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.space.id = "s1";
  setUploadScope(null);
  setOpenDataRoomFolder(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("clears the toasts when the signed-in user changes", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("failed"));
  uploadFilesToDataRoom([file("secret.txt")]);
  await flush();
  expect(names()).toEqual(["secret.txt"]);
  setUploadScope("u2");
  expect(names()).toEqual([]);
});

it("clears the toasts when the space changes", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("failed"));
  uploadFilesToDataRoom([file("secret.txt")]);
  await flush();
  hoisted.space.id = "s2";
  expect(names()).toEqual([]);
});

it("ignores an upload that finishes after the session changed", async () => {
  setUploadScope("u1");
  let finish: (value: unknown) => void = () => undefined;
  hoisted.upload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  uploadFilesToDataRoom([file("late.txt")]);
  setUploadScope("u2");
  finish({ item: { id: "i1" }, duplicate: false });
  await flush();
  expect(names()).toEqual([]);
});

it("cancels one progressing upload without affecting the rest of its batch", async () => {
  setUploadScope("u1");
  const uploads = new Map<
    string,
    { progress: (fraction: number) => void; signal: AbortSignal; finish: () => void }
  >();
  hoisted.upload.mockImplementation(
    (
      uploadFile: File,
      _folder: string | undefined,
      progress: (fraction: number) => void,
      signal: AbortSignal,
    ) =>
      new Promise((resolve, reject) => {
        uploads.set(uploadFile.name, {
          progress,
          signal,
          finish: () => resolve({ item: { id: "i2", name: uploadFile.name }, duplicate: false }),
        });
        signal.addEventListener("abort", () => reject(new DataRoomUploadError("aborted")), {
          once: true,
        });
      }),
  );

  const batch = uploadFilesToDataRoom([file("cancel.txt"), file("finish.txt")]);
  const first = uploads.get("cancel.txt");
  const second = uploads.get("finish.txt");
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  first?.progress(0.4);
  const firstCard = getUploadToasts().find((toast) => toast.name === "cancel.txt");
  expect(firstCard?.state).toMatchObject({ kind: "uploading", fraction: 0.4 });
  expect(firstCard?.state.kind === "uploading" ? firstCard.state.cancel : undefined).toEqual(
    expect.any(Function),
  );

  if (firstCard?.state.kind !== "uploading") throw new Error("Expected an uploading card");
  firstCard.state.cancel();
  expect(first?.signal.aborted).toBe(true);
  expect(names()).not.toContain("cancel.txt");
  expect(getUploadToasts().some((toast) => toast.state.kind === "error")).toBe(false);

  second?.finish();
  await batch;
  expect(getUploadToasts().find((toast) => toast.name === "finish.txt")?.state.kind).toBe(
    "uploaded",
  );
});

it("keeps a failed upload's toast until it is dismissed", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("failed"));
  uploadFilesToDataRoom([file("big.bin")]);
  await flush();
  expect(names()).toEqual(["big.bin"]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(names()).toEqual(["big.bin"]);
  dismissUploadToast(getUploadToasts()[0]?.id ?? 0);
  expect(names()).toEqual([]);
});

it("reports why a zip was refused, without starting an import", async () => {
  setUploadScope("u1");
  const started = vi.fn();
  window.addEventListener("rakazo:data-room-import-started", started);
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("zip-encrypted"));
  uploadFilesToDataRoom([file("locked.zip")]);
  await flush();
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "error", reason: "zip-encrypted" });
  expect(started).not.toHaveBeenCalled();
  window.removeEventListener("rakazo:data-room-import-started", started);
});

it("reports a zip with too many files as its own refusal", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("zip-too-many-files"));
  uploadFilesToDataRoom([file("huge.zip")]);
  await flush();
  expect(getUploadToasts()[0]?.state).toMatchObject({
    kind: "error",
    reason: "zip-too-many-files",
  });
});

it("keeps a zip's card and follows its import row until it is added", async () => {
  setUploadScope("u1");
  const started = vi.fn();
  window.addEventListener("rakazo:data-room-import-started", started);
  hoisted.upload.mockResolvedValue({ importId: "import-1" });
  const row = {
    id: "import-1",
    total: 2,
    done: 0,
    failed: 0,
    finished: false,
    stage: "adding",
    currentName: "a.txt",
  };
  hoisted.imports.mockResolvedValue([row]);
  uploadFilesToDataRoom([file("bundle.zip")]);
  await flush();
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "importing", progress: null });
  expect(started).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toMatchObject({
    kind: "importing",
    progress: { currentName: "a.txt" },
  });
  hoisted.imports.mockResolvedValue([{ ...row, done: 2, finished: true, stage: "done" }]);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toEqual({ kind: "imported", count: 2 });
  window.removeEventListener("rakazo:data-room-import-started", started);
});

it("keeps a partly failed zip's card with both counts until it is dismissed", async () => {
  setUploadScope("u1");
  const changed = vi.fn();
  window.addEventListener(DATA_ROOM_CHANGED, changed);
  hoisted.upload.mockResolvedValue({ importId: "import-1" });
  hoisted.imports.mockResolvedValue([
    {
      id: "import-1",
      total: 340,
      done: 338,
      failed: 2,
      finished: true,
      stage: "done",
      currentName: null,
    },
  ]);
  uploadFilesToDataRoom([file("bundle.zip")]);
  await flush();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toEqual({ kind: "imported", count: 338, failed: 2 });
  expect(changed).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(names()).toEqual(["bundle.zip"]);
  window.removeEventListener(DATA_ROOM_CHANGED, changed);
});

it("reports an opened zip whose entries all failed as an import, not a refusal", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ importId: "import-1" });
  const row = {
    id: "import-1",
    total: 3,
    done: 0,
    failed: 0,
    finished: false,
    stage: "adding",
    currentName: "a.txt",
  };
  hoisted.imports.mockResolvedValue([row]);
  uploadFilesToDataRoom([file("bundle.zip")]);
  await flush();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "importing" });
  hoisted.imports.mockResolvedValue([
    { ...row, failed: 3, finished: true, stage: "done", currentName: null },
  ]);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toEqual({ kind: "imported", count: 0, failed: 3 });
});

it("still calls a zip that never opened invalid when everything failed", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ importId: "import-1" });
  const row = {
    id: "import-1",
    total: 3,
    done: 0,
    failed: 0,
    finished: false,
    stage: "opening",
    currentName: null,
  };
  hoisted.imports.mockResolvedValue([row]);
  uploadFilesToDataRoom([file("bundle.zip")]);
  await flush();
  await vi.advanceTimersByTimeAsync(1_000);
  hoisted.imports.mockResolvedValue([{ ...row, failed: 3, finished: true }]);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(getUploadToasts()[0]?.state).toEqual({ kind: "error", reason: "zip-invalid" });
});

it("offers Retry on a network failure and uploads the same file into the same folder", async () => {
  setUploadScope("u1");
  setOpenDataRoomFolder("f-deals");
  const deck = file("deck.pdf");
  hoisted.upload.mockRejectedValueOnce(new DataRoomUploadError("network"));
  uploadFilesToDataRoom([deck]);
  await flush();
  const [toast] = getUploadToasts();
  if (toast?.state.kind !== "error") throw new Error("expected an error toast");
  expect(toast.state.retry).toEqual(expect.any(Function));
  hoisted.upload.mockResolvedValue({ item: { id: "i1", name: "deck.pdf" }, duplicate: false });
  toast.state.retry?.();
  await flush();
  expect(hoisted.upload).toHaveBeenCalledTimes(2);
  expect(hoisted.upload.mock.calls[1]).toEqual([
    deck,
    "f-deals",
    expect.any(Function),
    expect.any(AbortSignal),
    undefined,
  ]);
  expect(getUploadToasts().some((entry) => entry.id === toast.id)).toBe(false);
  expect(getUploadToasts()[0]?.state.kind).toBe("uploaded");
});

it("does not offer Retry on refusals or a deleted folder", async () => {
  setUploadScope("u1");
  for (const reason of ["invalid", "zip-encrypted", "folder-gone"] as const) {
    hoisted.upload.mockRejectedValueOnce(new DataRoomUploadError(reason));
    uploadFilesToDataRoom([file(`${reason}.bin`)]);
    await flush();
  }
  for (const toast of getUploadToasts()) {
    if (toast.state.kind !== "error") throw new Error("expected error toasts");
    expect(toast.state).not.toHaveProperty("retry");
  }
});

it("does not retry a failed upload into a different space", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValueOnce(new DataRoomUploadError("network"));
  uploadFilesToDataRoom([file("deck.pdf")]);
  await flush();
  const [toast] = getUploadToasts();
  if (toast?.state.kind !== "error") throw new Error("expected an error toast");
  hoisted.space.id = "s2";
  toast.state.retry?.();
  expect(hoisted.upload).toHaveBeenCalledTimes(1);
  expect(hoisted.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Not retried: the space changed" }),
  );
});

it("sends a 200 MB file without checking its size", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ item: { id: "i1", name: "huge.bin" }, duplicate: false });
  const huge = new File(["x"], "huge.bin");
  Object.defineProperty(huge, "size", { value: 200 * 1024 * 1024 });
  uploadFilesToDataRoom([huge]);
  await flush();
  expect(hoisted.upload).toHaveBeenCalledTimes(1);
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "uploaded", itemId: "i1" });
});

it("uploads into the folder the Data room page has open, else the root", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ item: { id: "i1", name: "a.txt" }, duplicate: false });
  setOpenDataRoomFolder("f-product");
  uploadFilesToDataRoom([file("a.txt")]);
  setOpenDataRoomFolder(undefined);
  uploadFilesToDataRoom([file("b.txt")]);
  await flush();
  expect(hoisted.upload.mock.calls.map((call) => call[1])).toEqual(["f-product", undefined]);
});

it("says uploaded, or where the identical file already is and its name when it differs", async () => {
  setUploadScope("u1");
  hoisted.folders.mockResolvedValue([
    { id: "f-legal", parentId: null, name: "Legal" },
    { id: "f-leases", parentId: "f-legal", name: "Leases" },
  ]);
  hoisted.upload
    .mockResolvedValueOnce({
      item: { id: "i1", name: "new.txt", folderId: "f-leases" },
      duplicate: false,
    })
    .mockResolvedValueOnce({
      item: { id: "i0", name: "lease.pdf", folderId: "f-leases" },
      duplicate: true,
    })
    .mockResolvedValueOnce({
      item: { id: "i2", name: "same.txt", folderId: null },
      duplicate: true,
    });
  uploadFilesToDataRoom([file("new.txt"), file("lease copy.pdf"), file("same.txt")]);
  await flush();
  expect(getUploadToasts().map((toast) => toast.state)).toEqual([
    { kind: "uploaded", itemId: "i1", folder: "Legal / Leases" },
    {
      kind: "uploaded",
      itemId: "i0",
      existing: { name: "lease.pdf", folder: "Legal / Leases" },
    },
    { kind: "uploaded", itemId: "i2", existing: {} },
  ]);
});

it("shows the upload as done even while the folder lookup is still pending", async () => {
  setUploadScope("u1");
  hoisted.folders.mockReturnValue(new Promise(() => {}));
  hoisted.upload.mockResolvedValue({
    item: { id: "i1", name: "a.txt", folderId: "f1" },
    duplicate: false,
  });
  const changed = vi.fn();
  window.addEventListener(DATA_ROOM_CHANGED, changed);
  uploadFilesToDataRoom([file("a.txt")]);
  await flush();
  window.removeEventListener(DATA_ROOM_CHANGED, changed);
  expect(getUploadToasts().map((toast) => toast.state)).toEqual([
    { kind: "uploaded", itemId: "i1" },
  ]);
  expect(changed).toHaveBeenCalled();
});

it("shows a Deleted toast that goes away by itself after a few seconds", async () => {
  setUploadScope("u1");
  showDeletedToast("old.txt");
  expect(getUploadToasts().map((toast) => [toast.name, toast.state.kind])).toEqual([
    ["old.txt", "deleted"],
  ]);
  await vi.advanceTimersByTimeAsync(6_000);
  expect(names()).toEqual([]);
});

it("keeps a finished toast while the pointer is over the toasts, then lets it go", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ item: { id: "i1", name: "a.txt" }, duplicate: false });
  uploadFilesToDataRoom([file("a.txt")]);
  await flush();
  holdUploadToasts(true);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(names()).toEqual(["a.txt"]);
  holdUploadToasts(false);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(names()).toEqual([]);
});

it("stops holding once the last toast is closed under the pointer", async () => {
  setUploadScope("u1");
  hoisted.upload.mockResolvedValue({ item: { id: "i1", name: "a.txt" }, duplicate: false });
  uploadFilesToDataRoom([file("a.txt")]);
  await flush();
  holdUploadToasts(true);
  dismissUploadToast(getUploadToasts()[0]?.id ?? 0);
  uploadFilesToDataRoom([file("b.txt")]);
  await flush();
  await vi.advanceTimersByTimeAsync(11_000);
  expect(names()).toEqual([]);
});

it("says a deleted folder is gone and offers to upload the same file to the top level", async () => {
  setUploadScope("u1");
  setOpenDataRoomFolder("f-gone");
  const changed = vi.fn();
  window.addEventListener(DATA_ROOM_CHANGED, changed);
  hoisted.upload.mockRejectedValueOnce(new DataRoomUploadError("folder-gone"));
  hoisted.upload.mockResolvedValueOnce({ item: { id: "i1", folderId: null }, duplicate: false });
  const deck = file("deck.pdf");
  uploadFilesToDataRoom([deck]);
  await flush();
  const [toast] = getUploadToasts();
  expect(toast?.state).toMatchObject({ kind: "error", reason: "folder-gone" });
  expect(changed).toHaveBeenCalled();
  if (toast?.state.kind !== "error") throw new Error("expected an error toast");
  toast.state.toTop?.();
  await flush();
  expect(hoisted.upload).toHaveBeenLastCalledWith(
    deck,
    undefined,
    expect.any(Function),
    expect.any(AbortSignal),
    undefined,
  );
  expect(getUploadToasts().map((t) => t.state.kind)).toEqual(["uploaded"]);
  window.removeEventListener(DATA_ROOM_CHANGED, changed);
});

it("drops a notice whose user changed before it was shown, and shows the rest in the shared host", () => {
  setUploadScope("u1");
  const since = uploadScopeToken();
  setUploadScope("u2");
  showNoticeToast("Shared secret.pdf", since);
  expect(hoisted.enqueue).not.toHaveBeenCalled();
  showNoticeToast("Shared ok.pdf", uploadScopeToken());
  expect(hoisted.enqueue).toHaveBeenCalledWith(expect.objectContaining({ title: "Shared ok.pdf" }));
  expect(names()).toEqual([]);
});

it("calls an upload with no progress slow, and offers Cancel and Retry", async () => {
  setUploadScope("u1");
  hoisted.upload.mockReturnValue(new Promise(() => undefined));
  uploadFilesToDataRoom([file("deck.pdf")]);
  await flush();
  expect(getUploadToasts()[0]?.state).toMatchObject({ kind: "uploading" });
  expect(getUploadToasts()[0]?.state).not.toHaveProperty("stalled");
  await vi.advanceTimersByTimeAsync(15_000);
  const state = getUploadToasts()[0]?.state;
  if (state?.kind !== "uploading" || !state.stalled) throw new Error("expected a stalled upload");
  state.stalled.retry();
  expect(hoisted.upload).toHaveBeenCalledTimes(2);
  expect(hoisted.upload.mock.calls[0]?.[3].aborted).toBe(true);
  expect(names()).toEqual(["deck.pdf"]);
  await vi.advanceTimersByTimeAsync(15_000);
  const again = getUploadToasts()[0]?.state;
  if (again?.kind !== "uploading" || !again.stalled) throw new Error("expected a stalled upload");
  again.stalled.cancel();
  expect(names()).toEqual([]);
});

it("does not retry a stalled upload into a different space", async () => {
  setUploadScope("u1");
  hoisted.upload.mockReturnValue(new Promise(() => undefined));
  uploadFilesToDataRoom([file("deck.pdf")]);
  await vi.advanceTimersByTimeAsync(15_000);
  const state = getUploadToasts()[0]?.state;
  if (state?.kind !== "uploading" || !state.stalled) throw new Error("expected a stalled upload");
  hoisted.space.id = "s2";
  state.stalled.retry();
  expect(hoisted.upload).toHaveBeenCalledTimes(1);
  expect(hoisted.upload.mock.calls[0]?.[3].aborted).toBe(true);
  expect(hoisted.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Not retried: the space changed" }),
  );
});

it("closes shown notices when the user or space changes", () => {
  setUploadScope("u1");
  showNoticeToast("Shared secret.pdf");
  const id = hoisted.enqueue.mock.calls[0]?.[0].id;
  setUploadScope("u2");
  expect(hoisted.close).toHaveBeenCalledWith(id);
  showNoticeToast("Shared b.pdf");
  const second = hoisted.enqueue.mock.calls[1]?.[0].id;
  hoisted.enqueue.mock.calls[1]?.[0].onClose();
  hoisted.space.id = "s2";
  getUploadToasts();
  expect(hoisted.close).not.toHaveBeenCalledWith(second);
});
