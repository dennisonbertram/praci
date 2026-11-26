import Foundation
import Observation
import RakazoAPI
import RakazoCore

extension ProductEvent: @retroactive SequencedEvent {}

private struct ThreadInput: Encodable, Sendable {
  var botId: String?
  var groupId: String?
  var before: Int?
  var cursor: Int?
  var toEnd: Bool?
  var messageId: String?
  var upToMessageId: String?

  init(_ target: ThreadTarget) {
    switch target {
    case .bot(let id): botId = id
    case .group(let id): groupId = id
    }
  }
}

private struct BotInfo: Decodable, Sendable {
  var name: String
  var color: String?
}

/// One screen's worth of thread state: the snapshot, the live stream folded into it, paging
/// and read marks. The server owns everything; this only mirrors it.
@MainActor
@Observable
final class ThreadModel {
  let target: ThreadTarget
  var state: Loadable<ThreadSnapshot> = .idle
  /// Set when a refresh fails while earlier messages are still on screen.
  var refreshError: String?
  var botName: String?
  var botColor: String?
  var anchor: UnreadAnchor?
  var loadingOlder = false
  /// Set when loading an earlier page fails; the thread shows a retry row instead of the spinner.
  var olderError: String?
  var archiveError: String?
  /// "Mark unread" must not be undone by the very next scroll to the bottom.
  private var readHeld = false
  private var markingRead = false

  let composer: ComposerModel

  init(target: ThreadTarget) {
    self.target = target
    composer = ComposerModel(target: target)
  }

  var snapshot: ThreadSnapshot? { state.value }

  var title: String {
    switch target {
    case .bot: botName ?? ""
    case .group: snapshot?.groupName ?? ""
    }
  }

  var storedMessages: [ThreadMessage] { snapshot?.messages ?? [] }

  var dividerID: String? {
    unreadDividerID(anchor: anchor, messages: storedMessages.map(\.readBoundary))
  }

  var runningRuns: [ThreadRun] { activeThreadRuns(snapshot).filter { $0.status == "running" } }

  /// "Last run failed" is shown only while the primary run is the failed one.
  var failureText: String? {
    guard let run = snapshot?.run, run.status == "failed", runningRuns.isEmpty else { return nil }
    return run.error ?? ""
  }

  func memberName(_ botID: String?) -> String? {
    snapshot?.members?.first { $0.botId == botID }?.name
  }

  func memberColor(_ botID: String?) -> String? {
    snapshot?.members?.first { $0.botId == botID }?.color
  }

  // MARK: Loading and the live stream

  /// Loads the snapshot, then follows the thread until the task is cancelled.
  func run(_ app: AppModel) async {
    if case .bot(let id) = target, botName == nil {
      struct Input: Encodable, Sendable { var botId: String }
      if let info: BotInfo = try? await app.call("bots/get", input: Input(botId: id)) {
        botName = info.name
        botColor = info.color
      }
    }
    await refresh(app)
    guard let cursor = snapshot?.cursor else { return }
    let target = target
    let stream = EventStream<ProductEvent>(
      auth: app.authentication.client, procedure: "threads/subscribe", spaceID: app.spaceID,
      input: { cursor in
        var input = ThreadInput(target)
        input.cursor = cursor
        return input
      },
      resync: { [weak self] in await self?.refresh(app) })
    do {
      for try await event in stream.events(after: cursor) { apply(event) }
    } catch {
      // A 401 ends the stream; this call lets the app model end the session or fix the space.
      await refresh(app)
    }
  }

  func refresh(_ app: AppModel) async {
    if snapshot == nil { state = .loading }
    do {
      let fresh: ThreadSnapshot = try await app.call("threads/get", input: ThreadInput(target))
      if Task.isCancelled { return }
      state = .loaded(Self.merged(fresh, keeping: snapshot))
      refreshError = nil
      anchor = openUnreadAnchor(
        previous: anchor, key: fresh.threadId, lastReadSeq: fresh.lastReadSeq,
        messages: fresh.messages.map(\.readBoundary))
    } catch {
      if Task.isCancelled { return }
      if snapshot == nil {
        state = .failed(error.localizedDescription)
      } else {
        refreshError = error.localizedDescription
      }
    }
  }

  /// A refresh replaces the newest page; older pages the reader already loaded stay.
  static func merged(_ fresh: ThreadSnapshot, keeping old: ThreadSnapshot?) -> ThreadSnapshot {
    // The response is older than events already folded in; keep them, take only the read mark.
    if let old, old.threadId == fresh.threadId, old.cursor > fresh.cursor {
      var kept = old
      kept.lastReadSeq = fresh.lastReadSeq ?? old.lastReadSeq
      return kept
    }
    guard let old, old.threadId == fresh.threadId,
      let firstSeq = fresh.messages.first(where: { isStoredMessage(id: $0.id) })?.seq
    else { return fresh }
    // Messages folded from events carry the event's seq, so the same message can appear in both.
    let freshIDs = Set(fresh.messages.map(\.id))
    let older = old.messages.filter {
      isStoredMessage(id: $0.id) && $0.seq < firstSeq && !freshIDs.contains($0.id)
    }
    guard !older.isEmpty else { return fresh }
    var merged = fresh
    merged.messages = older + fresh.messages
    merged.olderCursor = old.olderCursor
    return merged
  }

  func apply(_ event: ProductEvent) {
    guard let current = snapshot, isThreadSnapshotEvent(event), event.seq > current.cursor,
      let next = reduceThreadSnapshot(current, event)
    else { return }
    state = .loaded(next)
  }

  func loadOlder(_ app: AppModel) async {
    guard let before = snapshot?.olderCursor, !loadingOlder else { return }
    loadingOlder = true
    defer { loadingOlder = false }
    var input = ThreadInput(target)
    input.before = before
    let page: ThreadMessagePage
    do {
      page = try await app.call("threads/messages", input: input)
    } catch {
      olderError = error.localizedDescription
      return
    }
    olderError = nil
    guard var current = snapshot else { return }
    let known = Set(current.messages.map(\.id))
    current.messages = page.messages.filter { !known.contains($0.id) } + current.messages
    current.olderCursor = page.olderCursor
    state = .loaded(current)
  }

  // MARK: Read marks

  /// Marks the thread read once the newest message is on screen and something is unread.
  func markRead(_ app: AppModel) async {
    guard !readHeld, !markingRead, let current = snapshot else { return }
    let stored = current.messages.filter { isStoredMessage(id: $0.id) }
    guard let newest = stored.last(where: { $0.role != "user" }),
      newest.seq > (current.lastReadSeq ?? -1)
    else { return }
    markingRead = true
    defer { markingRead = false }
    var input = ThreadInput(target)
    input.toEnd = true
    guard (try? await app.call("threads/markRead", input: input) as JSONValue) != nil else { return }
    if var latest = snapshot {
      latest.lastReadSeq = max(latest.lastReadSeq ?? -1, stored.last?.seq ?? newest.seq)
      state = .loaded(latest)
    }
  }

  func markUnread(_ messageID: String, _ app: AppModel) async {
    guard isStoredMessage(id: messageID) else { return }
    var input = ThreadInput(target)
    input.messageId = messageID
    guard (try? await app.call("threads/markUnread", input: input) as JSONValue) != nil else {
      return
    }
    readHeld = true
    anchor = nil
    await refresh(app)
  }

  /// Archives the agent, returns to Home and offers Undo; true when it worked.
  func archive(_ app: AppModel) async -> Bool {
    guard case .bot(let id) = target else { return false }
    do {
      try await ManageClient.archive(.bot(id), name: title, app: app) {
        NotificationCenter.default.post(name: .agentsChanged, object: nil)
      }
      return true
    } catch {
      archiveError = error.localizedDescription
      return false
    }
  }
}

extension Notification.Name {
  /// Posted when an agent is archived or restored from a thread, so Home reloads its list.
  static let agentsChanged = Notification.Name("praci.agentsChanged")
}
