// @vitest-environment jsdom
import type { RakazoDesktopScanner, ScannerDocument } from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), folder: vi.fn(), notice: vi.fn() }));
vi.mock("@lingui/core/macro", () => ({ t: (strings: TemplateStringsArray) => strings.join("") }));
vi.mock("./data-room", () => ({ ensureDataRoomFolder: mocks.folder }));
vi.mock("./rpc", () => ({ selectedSpaceId: () => "space" }));
vi.mock("../components/data-room/upload-toasts", () => ({
  uploadFilesToDataRoom: mocks.upload,
  showNoticeToast: mocks.notice,
  uploadScopeToken: () => 1,
}));

import { SCANNER_RETRY, startScannerDelivery } from "./scanner-delivery";

const scope = { userId: "user", spaceId: "space" };
const document: ScannerDocument = {
  ...scope,
  id: "scan",
  name: "Scan.pdf",
  folder: ["Scans"],
  bytes: new Uint8Array([37, 80, 68, 70]),
  sha256: "a".repeat(64),
  pages: 1,
};
let listener: (doc: ScannerDocument) => void;
let scanner: RakazoDesktopScanner;
let stop: (() => void) | undefined;
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.folder.mockResolvedValue("folder");
  mocks.upload.mockImplementation(async (_files, _folder, _callback, options) => {
    await options.onStored({ sha256: document.sha256 });
  });
  scanner = {
    state: vi.fn(),
    scan: vi.fn(),
    cancel: vi.fn(),
    setAutoScan: vi.fn(),
    setFolder: vi.fn(),
    onState: vi.fn(),
    setScope: vi.fn().mockResolvedValue(undefined),
    pending: vi.fn().mockResolvedValue([document]),
    confirm: vi.fn().mockResolvedValue({ ok: true }),
    onDocument: vi.fn((fn) => {
      listener = fn;
      return vi.fn();
    }),
  };
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

it("replays outbox files through the shared upload flow with captured folder, source and identity, confirming only the stored hash", async () => {
  stop = startScannerDelivery(scanner, scope);
  await flush();
  expect(scanner.setScope).toHaveBeenCalledWith(scope);
  expect(mocks.folder).toHaveBeenCalledWith(["Scans"], "space");
  expect(mocks.upload).toHaveBeenCalledWith(
    [expect.any(File)],
    "folder",
    undefined,
    expect.objectContaining({ scope: { source: "scan", ...scope } }),
  );
  expect(scanner.confirm).toHaveBeenCalledWith("scan", document.sha256);
});

it("never confirms missing or mismatched hashes; retries only when requested", async () => {
  mocks.upload.mockImplementation(async (_files, _folder, _callback, options) =>
    options.onStored({ sha256: "b".repeat(64) }),
  );
  stop = startScannerDelivery(scanner, scope);
  await flush();
  expect(scanner.confirm).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event(SCANNER_RETRY));
  await flush();
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it("does not deliver another account or space's document", async () => {
  vi.mocked(scanner.pending).mockResolvedValue([
    { ...document, userId: "other" },
    { ...document, spaceId: "other" },
  ]);
  stop = startScannerDelivery(scanner, scope);
  await flush();
  expect(mocks.upload).not.toHaveBeenCalled();
});

it("deduplicates events while an upload is in flight and stops on scope teardown", async () => {
  let folderReady!: (value: string) => void;
  mocks.folder.mockReturnValue(
    new Promise((resolve) => {
      folderReady = resolve;
    }),
  );
  stop = startScannerDelivery(scanner, scope);
  await flush();
  listener(document);
  expect(mocks.folder).toHaveBeenCalledTimes(1);
  stop();
  folderReady("folder");
  await flush();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(scanner.setScope).toHaveBeenLastCalledWith(null);
});

it("restores the verified scope after a failed session check so retries resume", async () => {
  // The desktop clears its scope when a later session check fails, so pending() stays empty
  // until the scope is verified again.
  let verified = false;
  vi.mocked(scanner.setScope).mockImplementation(async (next) => {
    if (next) verified = true;
  });
  vi.mocked(scanner.pending).mockImplementation(async () => (verified ? [document] : []));
  stop = startScannerDelivery(scanner, scope);
  await flush();
  expect(scanner.confirm).toHaveBeenCalledTimes(1);

  verified = false;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(scanner.setScope).toHaveBeenLastCalledWith(scope);
  expect(scanner.confirm).toHaveBeenCalledTimes(2);
});

it("retries an offline server and pending upload without deleting the outbox first", async () => {
  vi.mocked(scanner.setScope).mockRejectedValueOnce(new Error("offline"));
  mocks.upload.mockResolvedValueOnce([false]);
  stop = startScannerDelivery(scanner, scope);
  await flush();
  expect(mocks.upload).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(scanner.confirm).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(scanner.confirm).toHaveBeenCalledWith("scan", document.sha256);
});

it("notifies when a requested retry cannot reach the server, but keeps automatic retries silent", async () => {
  vi.mocked(scanner.setScope)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("offline"))
    .mockRejectedValueOnce(new Error("offline"));
  vi.mocked(scanner.pending).mockResolvedValueOnce([]);
  stop = startScannerDelivery(scanner, scope);
  await flush();

  window.dispatchEvent(new Event(SCANNER_RETRY));
  await flush();

  expect(mocks.notice).toHaveBeenCalledTimes(1);
  expect(mocks.notice).toHaveBeenCalledWith(
    "Scan kept on this device. Retry when the server is available.",
    1,
  );
  expect(mocks.upload).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.notice).toHaveBeenCalledTimes(1);
});
