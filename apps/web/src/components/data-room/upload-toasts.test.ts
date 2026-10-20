// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  upload: vi.fn(),
  folders: vi.fn(),
  imports: vi.fn(),
  space: { id: "s1" },
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
  uploadFilesToDataRoom,
} from "./upload-toasts";

const names = () => getUploadToasts().map((toast) => toast.name);
const file = (name: string) => new File(["x"], name);
const flush = () => vi.advanceTimersByTimeAsync(0);

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

it("dismisses a failed upload by itself after a while", async () => {
  setUploadScope("u1");
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("failed"));
  uploadFilesToDataRoom([file("big.bin")]);
  await flush();
  expect(names()).toEqual(["big.bin"]);
  await vi.advanceTimersByTimeAsync(20_000);
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
      item: { id: "i1", name: "new.txt", folderId: null },
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
    { kind: "uploaded", itemId: "i1" },
    {
      kind: "uploaded",
      itemId: "i0",
      existing: { name: "lease.pdf", folder: "Legal / Leases" },
    },
    { kind: "uploaded", itemId: "i2", existing: {} },
  ]);
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
  expect(hoisted.upload).toHaveBeenLastCalledWith(deck, undefined, expect.any(Function));
  expect(getUploadToasts().map((t) => t.state.kind)).toEqual(["uploaded"]);
  window.removeEventListener(DATA_ROOM_CHANGED, changed);
});
