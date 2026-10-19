import { describe, expect, it } from "vitest";
import { threadReadInput } from "./thread-read";

const base = {
  target: { botId: "b1" },
  pinned: false,
  manuallyUnread: false,
  messageId: "m1",
  toEnd: true,
};

describe("threadReadInput", () => {
  it("names the last message the reader saw", () => {
    expect(threadReadInput(base)).toEqual({ botId: "b1", upToMessageId: "m1", toEnd: true });
    expect(threadReadInput({ ...base, target: { groupId: "g1" }, toEnd: false })).toEqual({
      groupId: "g1",
      upToMessageId: "m1",
      toEnd: false,
    });
  });

  it("sends nothing from a pinned search-jump window or a thread marked unread by hand", () => {
    expect(threadReadInput({ ...base, pinned: true })).toBeNull();
    expect(threadReadInput({ ...base, manuallyUnread: true })).toBeNull();
  });
});
