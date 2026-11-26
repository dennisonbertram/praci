import { describe, expect, it } from "vitest";
import {
  appContract,
  MessageBlock,
  THREAD_MESSAGE_MAX_LENGTH,
  validateThreadsSendInput,
} from "./index.js";

describe("attachment contracts", () => {
  it("parses image and file message blocks", () => {
    expect(
      MessageBlock.parse({
        kind: "image",
        artifactId: "art_1",
        mimeType: "image/png",
        name: "shot.png",
      }),
    ).toMatchObject({ kind: "image", name: "shot.png" });
    expect(
      MessageBlock.parse({
        kind: "file",
        artifactId: "art_2",
        mimeType: "application/pdf",
        name: "brief.pdf",
        size: 1234,
      }),
    ).toMatchObject({ kind: "file", size: 1234 });
  });

  it("requires text or attachments for threads.send", () => {
    expect(validateThreadsSendInput({ text: "hello" })).toBe(true);
    expect(validateThreadsSendInput({ artifactIds: ["art_1"] })).toBe(true);
    expect(validateThreadsSendInput({})).toBe(false);
    expect(validateThreadsSendInput({ artifactIds: ["a", "b", "c", "d", "e"] })).toBe(true);
  });

  it("caps threads.send text", () => {
    const schema = appContract.threads.send["~orpc"].inputSchema as {
      safeParse(value: unknown): { success: boolean };
    };
    const send = (text: string) => schema.safeParse({ botId: "bot_1", text }).success;
    expect(send("a".repeat(THREAD_MESSAGE_MAX_LENGTH))).toBe(true);
    expect(send("a".repeat(THREAD_MESSAGE_MAX_LENGTH + 1))).toBe(false);
  });
});
