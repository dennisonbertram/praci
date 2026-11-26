import Foundation
import RakazoAPI

// Port of the read-boundary helpers in packages/core/src/thread-scroll.ts and the unread
// divider anchor in apps/mobile/lib/thread-unread.ts.

public struct ReadBoundaryMessage: Equatable, Sendable {
  public var id: String
  public var seq: Int
  public var role: String

  public init(id: String, seq: Int, role: String) {
    self.id = id
    self.seq = seq
    self.role = role
  }
}

public extension ThreadMessage {
  var readBoundary: ReadBoundaryMessage {
    ReadBoundaryMessage(id: id, seq: seq, role: role)
  }
}

/// Stored messages only: live progress and subagent rows have no place in the read boundary.
public func isStoredMessage(id: String) -> Bool {
  !id.hasPrefix("progress:") && !id.hasPrefix("subagent:")
}

/// The first message from the other party after the read boundary, where the "New" divider goes.
public func firstUnreadMessageID(_ messages: [ReadBoundaryMessage], lastReadSeq: Int?) -> String? {
  guard let lastReadSeq else { return nil }
  return messages.first { $0.role != "user" && $0.seq > lastReadSeq }?.id
}

/// Live rows carry the event's seq, not the message's, so positions after the thread opened are
/// compared by list order and id, never by seq.
private func indexOfID(_ messages: [ReadBoundaryMessage], _ id: String?) -> Int {
  guard let id else { return -1 }
  return messages.firstIndex { $0.id == id } ?? -1
}

/// The newest message at or before the read boundary; only valid on a freshly loaded page.
public func lastReadMessageID(_ messages: [ReadBoundaryMessage], lastReadSeq: Int?) -> String? {
  guard let lastReadSeq else { return messages.last?.id }
  return messages.last { $0.seq <= lastReadSeq }?.id
}

/// Whichever of two message ids comes later in the list.
public func laterMessageID(_ messages: [ReadBoundaryMessage], _ first: String?, _ second: String?)
  -> String?
{
  indexOfID(messages, second) > indexOfID(messages, first) ? second : first
}

/// Messages from the other party after `afterID`, for the "n new messages" pill.
public func newMessagesAfter(
  _ messages: [ReadBoundaryMessage], afterID: String?,
  counts: (ReadBoundaryMessage) -> Bool = { _ in true }
) -> Int {
  let index = indexOfID(messages, afterID)
  guard index >= 0 else { return 0 }
  return messages[(index + 1)...].count(where: { $0.role != "user" && counts($0) })
}

/// The divider clears once the reader sends a message after `afterID`.
public func userRepliedAfter(_ messages: [ReadBoundaryMessage], afterID: String?) -> Bool {
  let index = indexOfID(messages, afterID)
  return index >= 0 && messages[(index + 1)...].contains { $0.role == "user" }
}

/// Where the "New" divider sits for one open thread, fixed when its first live snapshot arrives.
public struct UnreadAnchor: Equatable, Sendable {
  public var key: String
  public var dividerID: String?
  public var openedLatestID: String?

  public init(key: String, dividerID: String?, openedLatestID: String?) {
    self.key = key
    self.dividerID = dividerID
    self.openedLatestID = openedLatestID
  }
}

/// Keeps the anchor for `key`, or builds it from the first snapshot that carries a read boundary.
public func openUnreadAnchor(
  previous: UnreadAnchor?, key: String, lastReadSeq: Int?, messages: [ReadBoundaryMessage]
) -> UnreadAnchor? {
  if let previous, previous.key == key { return previous }
  guard let lastReadSeq else { return nil }
  return UnreadAnchor(
    key: key,
    dividerID: firstUnreadMessageID(messages, lastReadSeq: lastReadSeq),
    openedLatestID: messages.last?.id
  )
}

/// The anchored message while it is still listed and the reader has not replied since opening.
public func unreadDividerID(anchor: UnreadAnchor?, messages: [ReadBoundaryMessage]) -> String? {
  guard let dividerID = anchor?.dividerID, messages.contains(where: { $0.id == dividerID }) else {
    return nil
  }
  return userRepliedAfter(messages, afterID: anchor?.openedLatestID) ? nil : dividerID
}
