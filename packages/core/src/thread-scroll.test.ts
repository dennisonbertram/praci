import { describe, expect, it } from "vitest";
import {
  firstUnreadMessageId,
  newMessagesSince,
  reconcileThreadScrollState,
  userRepliedAfter,
} from "./thread-scroll.js";

describe("thread scroll state publication", () => {
  const states = [
    { detached: false, unread: false, newCount: 0 },
    { detached: false, unread: true, newCount: 0 },
    { detached: true, unread: false, newCount: 0 },
    { detached: true, unread: true, newCount: 2 },
    { detached: true, unread: true, newCount: 3 },
  ];

  for (const previous of states) {
    for (const next of states) {
      it(`preserves identity only for unchanged fields: ${JSON.stringify(previous)} → ${JSON.stringify(next)}`, () => {
        const snapshot = Object.freeze({ ...next });
        const unchanged = JSON.stringify(previous) === JSON.stringify(next);
        expect(reconcileThreadScrollState(previous, snapshot)).toBe(
          unchanged ? previous : snapshot,
        );
        expect(snapshot).toEqual(next);
      });
    }
  }
});

describe("read boundary", () => {
  const messages = [
    { id: "a", seq: 0, role: "bot" },
    { id: "b", seq: 1, role: "user" },
    { id: "c", seq: 2, role: "bot" },
    { id: "d", seq: 3, role: "user" },
    { id: "e", seq: 4, role: "bot" },
  ];

  it("puts the divider before the first unread message from the other party", () => {
    expect(firstUnreadMessageId(messages, 0)).toBe("c");
    expect(firstUnreadMessageId(messages, -1)).toBe("a");
  });

  it("skips the user's own messages and shows nothing when everything is read", () => {
    expect(firstUnreadMessageId(messages, 1)).toBe("c");
    expect(firstUnreadMessageId(messages, 4)).toBeNull();
    expect(firstUnreadMessageId([{ id: "u", seq: 5, role: "user" }], 4)).toBeNull();
    expect(firstUnreadMessageId(messages, undefined)).toBeNull();
  });

  it("counts only the other party's newer messages", () => {
    expect(newMessagesSince(messages, 0)).toBe(2);
    expect(newMessagesSince(messages, 4)).toBe(0);
  });

  it("notices a reply from the reader after the first unread message", () => {
    expect(userRepliedAfter(messages, 2)).toBe(true);
    expect(userRepliedAfter(messages, 3)).toBe(false);
  });
});
