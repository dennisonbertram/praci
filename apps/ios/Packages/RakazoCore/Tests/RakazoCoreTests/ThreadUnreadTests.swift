import Foundation
@testable import RakazoCore
import Testing

// Ported from apps/mobile/lib/thread-unread.test.ts and the "read boundary" block of
// packages/core/src/thread-scroll.test.ts (same case names).

private func m(_ id: String, _ seq: Int, _ role: String) -> ReadBoundaryMessage {
  ReadBoundaryMessage(id: id, seq: seq, role: role)
}

/// seq 0 bot, 1 user, 2 bot, 3 user, 4 bot
private let thread = [
  m("m0", 0, "bot"), m("m1", 1, "user"), m("m2", 2, "bot"), m("m3", 3, "user"), m("m4", 4, "bot"),
]

private func anchor(
  _ lastRead: Int?, key: String = "t1", previous: UnreadAnchor? = nil,
  in list: [ReadBoundaryMessage] = thread
) -> UnreadAnchor? {
  openUnreadAnchor(previous: previous, key: key, lastReadSeq: lastRead, messages: list)
}

@Test("sits before the first unread message from the other party, not the user's own")
func dividerBeforeFirstUnread() {
  #expect(unreadDividerID(anchor: anchor(1), messages: thread) == "m2")
  #expect(unreadDividerID(anchor: anchor(2), messages: thread) == "m4")
}

@Test("is absent when everything is read, or when the snapshot has no read boundary")
func dividerAbsent() {
  #expect(unreadDividerID(anchor: anchor(4), messages: thread) == nil)
  #expect(anchor(nil) == nil)
}

@Test("stays where it opened while newer messages arrive and the boundary moves")
func dividerStaysPut() {
  let opened = anchor(1)
  let later = thread + [m("m5", 5, "bot")]
  #expect(anchor(5, previous: opened, in: later) == opened)
  #expect(unreadDividerID(anchor: opened, messages: later) == "m2")
}

@Test("clears after the reader sends a message and starts over for another thread")
func dividerClearsOnReply() {
  let opened = anchor(1)
  let sent = thread + [m("m5", 5, "user")]
  #expect(unreadDividerID(anchor: opened, messages: sent) == nil)
  let other = anchor(1, key: "t2", previous: opened)
  #expect(other != opened)
  #expect(unreadDividerID(anchor: other, messages: thread) == "m2")
}

private let boundary = [
  m("a", 0, "bot"), m("b", 1, "user"), m("c", 2, "bot"), m("d", 3, "user"), m("e", 4, "bot"),
]

@Test("puts the divider before the first unread message from the other party")
func firstUnreadBeforeOther() {
  #expect(firstUnreadMessageID(boundary, lastReadSeq: 0) == "c")
  #expect(firstUnreadMessageID(boundary, lastReadSeq: -1) == "a")
}

@Test("skips the user's own messages and shows nothing when everything is read")
func skipsOwnMessages() {
  #expect(firstUnreadMessageID(boundary, lastReadSeq: 1) == "c")
  #expect(firstUnreadMessageID(boundary, lastReadSeq: 4) == nil)
  #expect(firstUnreadMessageID([m("u", 5, "user")], lastReadSeq: 4) == nil)
  #expect(firstUnreadMessageID(boundary, lastReadSeq: nil) == nil)
}

@Test("counts only the other party's messages after an id, by list order")
func countsAfterID() {
  #expect(newMessagesAfter(boundary, afterID: "a") == 2)
  #expect(newMessagesAfter(boundary, afterID: "e") == 0)
  #expect(newMessagesAfter(boundary, afterID: "missing") == 0)
}

@Test("ignores event seqs on live rows and in-place updates")
func ignoresLiveSeqs() {
  // SSE rows carry the event seq (here far larger than the stored seqs).
  var live = boundary.enumerated().map { m($1.id, 900 + $0, $1.role) }
  #expect(newMessagesAfter(live, afterID: "c") == 1)
  live[2].seq = 999
  #expect(newMessagesAfter(live, afterID: "c") == 1)
  #expect(newMessagesAfter(live, afterID: "e") == 0)
}

@Test("skips rows the caller says do not count, such as live progress rows")
func skipsUncounted() {
  let withProgress = boundary + [m("progress:run1", 5, "bot")]
  #expect(newMessagesAfter(withProgress, afterID: "e") { isStoredMessage(id: $0.id) } == 0)
  #expect(newMessagesAfter(withProgress, afterID: "e") == 1)
}

@Test("finds the last read message and the later of two ids")
func lastReadAndLater() {
  #expect(lastReadMessageID(boundary, lastReadSeq: 3) == "d")
  #expect(lastReadMessageID(boundary, lastReadSeq: -1) == nil)
  #expect(lastReadMessageID(boundary, lastReadSeq: nil) == "e")
  #expect(laterMessageID(boundary, "b", "d") == "d")
  #expect(laterMessageID(boundary, "d", "b") == "d")
  #expect(laterMessageID(boundary, nil, "b") == "b")
}

@Test("notices a reply from the reader after a message")
func noticesReply() {
  #expect(userRepliedAfter(boundary, afterID: "c"))
  #expect(!userRepliedAfter(boundary, afterID: "d"))
  #expect(!userRepliedAfter(boundary, afterID: nil))
}
