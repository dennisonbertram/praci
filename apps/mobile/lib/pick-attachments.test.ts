import { inferAttachmentMimeType } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import { filterPickedAttachments, readPickedAttachments } from "./pick-attachments-filter.js";

describe("filterPickedAttachments", () => {
  it("skips unsupported mime types and oversize files", () => {
    const result = filterPickedAttachments(0, [
      {
        name: "notes.txt",
        mimeType: "text/plain",
        size: 12,
        contentBase64: "aGVsbG8=",
      },
      {
        name: "bundle.zip",
        mimeType: inferAttachmentMimeType("bundle.zip", "application/x-zip-compressed"),
        size: 12,
        contentBase64: "UEsDBA==",
      },
      {
        name: "payload.exe",
        mimeType: null,
        size: 12,
        contentBase64: "aGVsbG8=",
      },
      {
        name: "big.zip",
        mimeType: "application/zip",
        size: 10 * 1024 * 1024 + 1,
        contentBase64: "aGVsbG8=",
      },
    ]);
    expect(result.attachments.map((item) => item.name)).toEqual(["notes.txt", "bundle.zip"]);
    expect(result.attachments[1]).toMatchObject({
      name: "bundle.zip",
      mimeType: "application/zip",
    });
    expect(result.skipped.map((item) => item.name)).toEqual(["payload.exe", "big.zip"]);
  });

  it("assigns distinct ids to duplicate files", () => {
    const candidate = {
      name: "notes.txt",
      mimeType: "text/plain",
      size: 12,
      contentBase64: "aGVsbG8=",
    };
    const result = filterPickedAttachments(0, [candidate, candidate]);
    const ids = result.attachments.map((attachment) => attachment.id);
    expect(ids[0]).toMatch(/^notes\.txt-12-0-\d+$/);
    expect(ids[1]).toMatch(/^notes\.txt-12-1-\d+$/);
    expect(new Set(ids).size).toBe(2);
  });
});

// Cross-pick duplicates must remain distinct after an attachment is removed.
describe("picked attachment identity", () => {
  it("assigns a new id when the same candidate is picked again", () => {
    const candidate = {
      name: "scan.pdf",
      mimeType: "application/pdf",
      size: 12,
      contentBase64: "cGRm",
    };
    const first = filterPickedAttachments(0, [candidate]);
    const second = filterPickedAttachments(0, [candidate]);
    expect(first.attachments[0]?.id).not.toBe(second.attachments[0]?.id);
  });
});

describe("readPickedAttachments", () => {
  it("reads only candidates that can fit in the message", async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => ({
      name: `photo-${index}.jpg`,
      mimeType: "image/jpeg",
      uri: `file://${index}`,
    }));
    const read = vi.fn(async () => ({ size: 12, contentBase64: "aGVsbG8=" }));
    const result = await readPickedAttachments(1, candidates, read);

    expect(read).toHaveBeenCalledTimes(3);
    expect(result.attachments).toHaveLength(3);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map(({ reason }) => reason)).toEqual(Array(3).fill("max 4 attachments"));
  });

  it("keeps reading candidates after an oversized file", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      name: `photo-${index}.jpg`,
      mimeType: "image/jpeg",
      uri: `file://${index}`,
    }));
    const read = vi.fn(async (candidate: (typeof candidates)[number]) => ({
      size: candidate.uri.endsWith("0") ? 10 * 1024 * 1024 + 1 : 12,
      contentBase64: "aGVsbG8=",
    }));
    const result = await readPickedAttachments(0, candidates, read);

    expect(read).toHaveBeenCalledTimes(5);
    expect(result.attachments).toHaveLength(4);
    expect(result.attachments.at(-1)?.name).toBe("photo-4.jpg");
  });
});
