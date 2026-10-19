import { describe, expect, it } from "vitest";
import {
  firstUnreadMessageId,
  isStoredMessage,
  lastReadMessageId,
  laterMessageId,
  newMessagesAfter,
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

  it("counts only the other party's messages after an id, by list order", () => {
    expect(newMessagesAfter(messages, "a")).toBe(2);
    expect(newMessagesAfter(messages, "e")).toBe(0);
    expect(newMessagesAfter(messages, "missing")).toBe(0);
  });

  it("ignores event seqs on live rows and in-place updates", () => {
    // SSE rows carry the event seq (here far larger than the stored seqs).
    const live = messages.map((m, i) => ({ ...m, seq: 900 + i }));
    expect(newMessagesAfter(live, "c")).toBe(1);
    expect(
      newMessagesAfter([...live.slice(0, 2), { ...live[2]!, seq: 999 }, ...live.slice(3)], "c"),
    ).toBe(1);
    expect(newMessagesAfter(live, "e")).toBe(0);
  });

  it("skips rows the caller says do not count, such as live progress rows", () => {
    const withProgress = [...messages, { id: "progress:run1", seq: 5, role: "bot" }];
    expect(newMessagesAfter(withProgress, "e", (m) => isStoredMessage(m))).toBe(0);
    expect(newMessagesAfter(withProgress, "e")).toBe(1);
  });

  it("finds the last read message and the later of two ids", () => {
    expect(lastReadMessageId(messages, 3)).toBe("d");
    expect(lastReadMessageId(messages, -1)).toBeNull();
    expect(lastReadMessageId(messages, undefined)).toBe("e");
    expect(laterMessageId(messages, "b", "d")).toBe("d");
    expect(laterMessageId(messages, "d", "b")).toBe("d");
    expect(laterMessageId(messages, null, "b")).toBe("b");
  });

  it("notices a reply from the reader after a message", () => {
    expect(userRepliedAfter(messages, "c")).toBe(true);
    expect(userRepliedAfter(messages, "d")).toBe(false);
    expect(userRepliedAfter(messages, null)).toBe(false);
  });
});
