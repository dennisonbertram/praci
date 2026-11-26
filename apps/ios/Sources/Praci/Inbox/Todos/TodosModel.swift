import Foundation
import Observation
import RakazoAPI

struct TodosClient {
  var list: @MainActor () async throws -> MailTodoList
  var setDone: @MainActor (_ id: String, _ done: Bool) async throws -> Void
}

private struct ListInput: Encodable, Sendable { var connectionId: String? }
private struct DoneInput: Encodable, Sendable { let id: String, done: Bool }

extension TodosClient {
  @MainActor
  static func live(_ app: AppModel) -> TodosClient {
    TodosClient(
      list: { try await app.call("inbox/todos/list", input: ListInput()) },
      setDone: { id, done in
        let _: MailTodo = try await app.call("inbox/todos/setDone", input: DoneInput(id: id, done: done))
      })
  }
}

@MainActor
@Observable
final class TodosModel {
  private(set) var todos: [MailTodo] = []
  private(set) var enabled = false
  var actionError: String?

  @ObservationIgnored private let client: TodosClient
  init(client: TodosClient) { self.client = client }

  /// The card shows only when triage is on and something is open. A failed load hides it too.
  var isVisible: Bool { enabled && !todos.isEmpty }

  func load() async {
    do {
      let list = try await client.list()
      enabled = list.enabled
      todos = list.todos.filter { $0.doneAt == nil }
    } catch {
      enabled = false
      todos = []
    }
  }

  /// The row leaves the card at once; a failed save puts it back where it was.
  func complete(_ todo: MailTodo) async {
    guard let index = todos.firstIndex(of: todo) else { return }
    todos.remove(at: index)
    do {
      try await client.setDone(todo.id, true)
    } catch {
      todos.insert(todo, at: min(index, todos.count))
      actionError = (error as? LocalizedError)?.errorDescription ?? "Couldn’t save that. Try again."
    }
  }
}

enum TodoDue {
  /// "Today", "Tomorrow", "Yesterday" or the month and day, from a `yyyy-MM-dd` date.
  static func label(_ dueOn: String, now: Date = .now, calendar: Calendar = .current) -> String? {
    let parts = dueOn.prefix(10).split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
      let due = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    else { return nil }
    let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: due).day ?? 0
    switch days {
    case 0: return "Today"
    case 1: return "Tomorrow"
    case -1: return "Yesterday"
    default: return due.formatted(.dateTime.month(.abbreviated).day())
    }
  }
}
