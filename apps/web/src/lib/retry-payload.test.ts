import type { ThreadMessage } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { retryPayload } from "./retry-payload.js";

function message(blocks: ThreadMessage["blocks"]): Pick<ThreadMessage, "blocks"> {
  return { blocks };
}

describe("retryPayload", () => {
  it("keeps text and artifact IDs from file and image blocks", () => {
    expect(
      retryPayload(
        message([
          { kind: "text", text: "Review these files" },
          {
            kind: "file",
            artifactId: "file-1",
            mimeType: "text/plain",
            name: "notes.txt",
            size: 1,
          },
          { kind: "image", artifactId: "image-1", mimeType: "image/png", name: "photo.png" },
        ]),
      ),
    ).toEqual({ text: "Review these files", artifactIds: ["file-1", "image-1"] });
  });

  it("returns a sendable payload when the message contains only a file", () => {
    expect(
      retryPayload(
        message([
          {
            kind: "file",
            artifactId: "file-1",
            mimeType: "text/plain",
            name: "notes.txt",
            size: 1,
          },
        ]),
      ),
    ).toEqual({ artifactIds: ["file-1"] });
  });
});
