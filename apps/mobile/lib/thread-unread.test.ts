import { describe, expect, it } from "vitest";
import { openUnreadAnchor, unreadDividerId } from "./thread-unread";

// seq 0 bot, 1 user, 2 bot, 3 user, 4 bot
const thread = [
  { id: "m0", seq: 0, role: "bot" },
  { id: "m1", seq: 1, role: "user" },
  { id: "m2", seq: 2, role: "bot" },
  { id: "m3", seq: 3, role: "user" },
  { id: "m4", seq: 4, role: "bot" },
];

describe("mobile unread divider", () => {
  it("sits before the first unread message from the other party, not the user's own", () => {
    const anchor = openUnreadAnchor(null, "t1", 1, thread);
    expect(unreadDividerId(anchor, thread)).toBe("m2");
    expect(unreadDividerId(openUnreadAnchor(null, "t1", 2, thread), thread)).toBe("m4");
  });

  it("is absent when everything is read, or when the snapshot has no read boundary", () => {
    expect(unreadDividerId(openUnreadAnchor(null, "t1", 4, thread), thread)).toBeNull();
    expect(openUnreadAnchor(null, "t1", undefined, thread)).toBeNull();
  });

  it("stays where it opened while newer messages arrive and the boundary moves", () => {
    const anchor = openUnreadAnchor(null, "t1", 1, thread);
    const later = [...thread, { id: "m5", seq: 5, role: "bot" }];
    expect(openUnreadAnchor(anchor, "t1", 5, later)).toBe(anchor);
    expect(unreadDividerId(anchor, later)).toBe("m2");
  });

  it("clears after the reader sends a message and starts over for another thread", () => {
    const anchor = openUnreadAnchor(null, "t1", 1, thread);
    const sent = [...thread, { id: "m5", seq: 5, role: "user" }];
    expect(unreadDividerId(anchor, sent)).toBeNull();
    const other = openUnreadAnchor(anchor, "t2", 1, thread);
    expect(other).not.toBe(anchor);
    expect(unreadDividerId(other, thread)).toBe("m2");
  });
});
