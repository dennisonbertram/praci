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
import { getUploadToasts, setUploadScope, uploadFilesToDataRoom } from "./upload-toasts";

const names = () => getUploadToasts().map((toast) => toast.name);
const file = (name: string) => new File(["x"], name);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.space.id = "s1";
  setUploadScope(null);
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
