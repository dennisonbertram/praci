// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ upload: vi.fn(), space: { id: "s1" } }));
vi.mock("../../lib/rpc", () => ({
  selectedSpaceId: () => hoisted.space.id,
  withSpaceHeaders: () => new Headers(),
}));
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  uploadToDataRoom: hoisted.upload,
}));

import { DataRoomUploadError } from "../../lib/data-room";
import {
  getUploadToasts,
  setOpenDataRoomFolder,
  setUploadScope,
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
  hoisted.upload.mockRejectedValue(new DataRoomUploadError("too-large"));
  uploadFilesToDataRoom([file("big.bin")]);
  await flush();
  expect(names()).toEqual(["big.bin"]);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(names()).toEqual([]);
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

it("says uploaded, or names the identical file already there", async () => {
  setUploadScope("u1");
  hoisted.upload
    .mockResolvedValueOnce({ item: { id: "i1", name: "new.txt" }, duplicate: false })
    .mockResolvedValueOnce({ item: { id: "i0", name: "lease.pdf" }, duplicate: true });
  uploadFilesToDataRoom([file("new.txt"), file("lease copy.pdf")]);
  await flush();
  expect(getUploadToasts().map((toast) => toast.state)).toEqual([
    { kind: "uploaded", itemId: "i1" },
    { kind: "uploaded", itemId: "i0", existing: "lease.pdf" },
  ]);
});
