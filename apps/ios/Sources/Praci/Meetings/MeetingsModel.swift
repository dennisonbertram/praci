import Foundation
import Observation
import RakazoAPI

private struct ListInput: Encodable, Sendable {
  var cursor: String?
  var q: String?
}

private struct IDInput: Encodable, Sendable { let meetingId: String }
private struct DoneInput: Encodable, Sendable { let id: String, done: Bool }

extension Meeting {
  /// "Oct 29, 9:00 AM · 45 min · Granola"
  var subtitle: String {
    var parts = [startedAt.formatted(.dateTime.month(.abbreviated).day().hour().minute())]
    if let minutes { parts.append(String(localized: "\(minutes) min")) }
    parts.append(sourceName)
    return parts.joined(separator: " · ")
  }
}

@MainActor
@Observable
final class MeetingsModel {
  private(set) var state: Loadable<[Meeting]> = .idle
  private(set) var next: String?
  private var generation = 0

  /// Loads the first page for `query`; a slower earlier request never overwrites a newer one.
  func load(_ app: AppModel, query: String) async {
    generation += 1
    let mine = generation
    if state.value == nil { state = .loading }
    do {
      let page: MeetingsPage = try await app.call("meetings/list", input: ListInput(q: query.isEmpty ? nil : query))
      guard mine == generation else { return }
      state = .loaded(page.items)
      next = page.nextCursor
    } catch {
      guard mine == generation else { return }
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }

  func loadMore(_ app: AppModel, query: String) async {
    guard let cursor = next, case .loaded(let items) = state else { return }
    let mine = generation
    next = nil
    do {
      let page: MeetingsPage = try await app.call(
        "meetings/list", input: ListInput(cursor: cursor, q: query.isEmpty ? nil : query))
      guard mine == generation else { return }
      state = .loaded(items + page.items)
      next = page.nextCursor
    } catch {
      if mine == generation { next = cursor }
    }
  }
}

@MainActor
@Observable
final class MeetingDetailModel {
  let meetingID: String
  private(set) var state: Loadable<MeetingDetail> = .idle
  var actionError: String?

  init(meetingID: String) { self.meetingID = meetingID }

  /// The server reports when a recording's summary is still being written.
  var isSummarizing: Bool { state.value?.summarizing ?? false }

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      state = .loaded(try await app.call("meetings/get", input: IDInput(meetingId: meetingID)))
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
    }
  }

  /// Reloads every 5 seconds while the summary is pending.
  func pollWhileSummarizing(_ app: AppModel) async {
    while isSummarizing {
      try? await Task.sleep(for: .seconds(5))
      if Task.isCancelled { return }
      await load(app)
    }
  }

  /// The circle flips at once; a failed save puts it back.
  func setDone(_ todo: MeetingTodo, done: Bool, app: AppModel) async {
    let before = todo.doneAt
    apply(todo.id, doneAt: done ? Date.now.formatted(.iso8601) : nil)
    do {
      let saved: MailTodo = try await app.call(
        "inbox/todos/setDone", input: DoneInput(id: todo.id, done: done))
      apply(todo.id, doneAt: saved.doneAt)
    } catch {
      apply(todo.id, doneAt: before)
      actionError = error.localizedDescription
    }
  }

  /// Returns true when the meeting is gone.
  func delete(_ app: AppModel) async -> Bool {
    do {
      let _: OKResult = try await app.call("meetings/delete", input: IDInput(meetingId: meetingID))
      return true
    } catch {
      actionError = error.localizedDescription
      return false
    }
  }

  private func apply(_ id: String, doneAt: String?) {
    guard var detail = state.value, let index = detail.todos.firstIndex(where: { $0.id == id }) else { return }
    detail.todos[index].doneAt = doneAt
    state = .loaded(detail)
  }
}
