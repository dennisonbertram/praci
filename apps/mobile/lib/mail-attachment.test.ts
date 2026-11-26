import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  download: vi.fn(),
  authHeaders: vi.fn(),
  file: { uri: "file:///mail-attachment", delete: vi.fn() },
  fetch: vi.fn(),
}));

vi.mock("expo-file-system", () => ({
  Directory: class {
    exists = true;
    create = vi.fn();
  },
  File: Object.assign(
    class {
      uri = state.file.uri;
      exists = true;
      delete = state.file.delete;
      create = vi.fn();
      write = vi.fn();
    },
    { downloadFileAsync: state.download },
  ),
  Paths: { cache: "cache" },
}));
vi.mock("./api", () => ({
  authHeaders: state.authHeaders,
  currentApiBase: () => "https://example.test",
}));
vi.mock("./artifact-file", () => ({ artifactCacheFileName: () => "attachment.pdf" }));
vi.mock("./session", () => ({ registerSessionDiskCache: vi.fn() }));
vi.mock("@rakazo/contracts", () => ({ isAttachmentImageMimeType: () => false }));
vi.mock("@rakazo/core", () => ({ canPreviewSpreadsheet: () => false }));

const { downloadMailAttachment } = await import("./mail-attachment");

beforeEach(() => {
  state.download.mockReset();
  state.authHeaders.mockReset().mockResolvedValue({ Authorization: "Bearer test-token" });
  state.file.delete.mockReset();
  state.fetch.mockReset();
  vi.stubGlobal("fetch", state.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("downloadMailAttachment", () => {
  it("downloads directly to the cache file with auth and cancellation", async () => {
    const file = { uri: state.file.uri, delete: state.file.delete };
    const signal = new AbortController().signal;
    state.download.mockResolvedValue(file);

    const result = await downloadMailAttachment(
      "message / id",
      { id: "attachment / id", filename: "file.pdf", mimeType: "application/pdf", size: 10 },
      signal,
    );

    expect(state.download).toHaveBeenCalledWith(
      "https://example.test/api/inbox/messages/message%20%2F%20id/attachments/attachment%20%2F%20id",
      expect.anything(),
      { headers: { Authorization: "Bearer test-token" }, idempotent: true, signal },
    );
    expect(state.fetch).not.toHaveBeenCalled();
    expect(result).toBe(file);
  });

  it("deletes a partial file and rethrows a failed download", async () => {
    const cause = new Error("failed");
    state.download.mockRejectedValue(cause);

    await expect(
      downloadMailAttachment("message-a", {
        id: "attachment-a",
        filename: "file.pdf",
        mimeType: "application/pdf",
        size: 10,
      }),
    ).rejects.toBe(cause);
    expect(state.file.delete).toHaveBeenCalledOnce();
  });
});
