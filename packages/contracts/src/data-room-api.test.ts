import { describe, expect, it } from "vitest";
import { DataRoomApiItemSchema, DataRoomApiUploadResponseSchema } from "./data-room-api.js";

const item = {
  id: "item1",
  name: "plan.pdf",
  mimeType: "application/pdf",
  size: 6 * 1024 ** 3,
  folderId: null,
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  notIndexed: true,
  facets: {
    docType: null,
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-01T12:00:00.000Z",
  hasThumbnail: false,
  previewText: null,
};

describe("Data room API items", () => {
  it("carries a size past 2 GiB and the not-indexed flag", () => {
    expect(DataRoomApiItemSchema.parse(item)).toMatchObject({
      size: 6 * 1024 ** 3,
      notIndexed: true,
    });
    const { notIndexed: _omitted, ...without } = item;
    expect(() => DataRoomApiItemSchema.parse(without)).toThrow();
  });

  it("answers an upload with an item or, for a zip, with the import to follow", () => {
    expect(DataRoomApiUploadResponseSchema.parse({ item, duplicate: false })).toMatchObject({
      duplicate: false,
    });
    expect(DataRoomApiUploadResponseSchema.parse({ importId: "import1" })).toEqual({
      importId: "import1",
    });
    expect(() => DataRoomApiUploadResponseSchema.parse({ duplicate: true })).toThrow();
  });
});
