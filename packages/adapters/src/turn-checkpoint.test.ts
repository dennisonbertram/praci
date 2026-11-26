import type { Message } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { restoreTurnCheckpoint, serializeTurnCheckpoint } from "./turn-checkpoint.js";

const assistant = {
  role: "assistant",
  content: [
    { type: "thinking", thinking: "synthetic thought", thinkingSignature: "fixture-signature" },
    { type: "toolCall", id: "pending", name: "write_file", arguments: {} },
  ],
  api: "openai-completions",
  provider: "fixture",
  model: "first",
  stopReason: "toolUse",
  timestamp: 0,
} as Message;
const checkpoint = {
  version: 1 as const,
  provider: "fixture",
  model: "first",
  systemPrompt: "Stable system",
  pendingToolCallId: "pending",
  messages: [{ role: "user", content: "Fixture request", timestamp: 0 } as Message, assistant],
};

describe("turn checkpoint", () => {
  it("round trips deterministically and preserves its original prefix", () => {
    const blob = serializeTurnCheckpoint(checkpoint);
    const first = restoreTurnCheckpoint(blob, { provider: "fixture", id: "first" });
    expect(first).toEqual(checkpoint);
    expect(JSON.stringify(first)).toBe(
      JSON.stringify(restoreTurnCheckpoint(blob, { provider: "fixture", id: "first" })),
    );
  });
  it("drops the aborted assistant tail while retaining the pending call", () => {
    const tail = { ...assistant, content: [], stopReason: "aborted" } as Message;
    expect(
      restoreTurnCheckpoint(
        serializeTurnCheckpoint({ ...checkpoint, messages: [...checkpoint.messages, tail] }),
        { provider: "fixture", id: "first" },
      ).messages,
    ).toEqual(checkpoint.messages);
  });
  it("strips thinking when the model changes", () => {
    const restored = restoreTurnCheckpoint(serializeTurnCheckpoint(checkpoint), {
      provider: "fixture",
      id: "second",
    });
    expect(JSON.stringify(restored.messages)).not.toContain("synthetic thought");
    expect(JSON.stringify(restored.messages)).toContain("pending");
  });
});
