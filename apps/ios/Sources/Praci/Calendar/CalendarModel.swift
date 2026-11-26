import Foundation
import Observation
import RakazoAPI
import RakazoCore

private struct AgendaInput: Encodable, Sendable {
  let from: String
  let to: String
  let sources: String
}
private struct ScratchpadDoneInput: Encodable, Sendable {
  let itemId: String
  let status = "done"
}

struct CalendarClient {
  var agenda: (String, String, String) async throws -> CalendarAgenda
  var waitingOnYou: () async throws -> [WaitingOnYouItem]
  var markDone: (String) async throws -> Void

  @MainActor
  static func live(_ app: AppModel) -> CalendarClient {
    CalendarClient(
      agenda: { from, to, sources in
        try await app.call("calendar/agenda", input: AgendaInput(from: from, to: to, sources: sources))
      },
      waitingOnYou: { try await app.call("scratchpad/waitingOnYou") },
      markDone: { itemId in
        let _: OKResult = try await app.call("scratchpad/update", input: ScratchpadDoneInput(itemId: itemId))
      })
  }
}

@MainActor
@Observable
final class CalendarModel {
  var state: Loadable<[CalendarItem]> = .idle
  var refreshError: String?
  var actionError: String?
  var googleConnected = false
  var googleNeedsAction = false
  var googleNeedsReconnect = false
  private(set) var completing = Set<String>()

  @ObservationIgnored private let client: CalendarClient
  @ObservationIgnored private let now: () -> Date
  @ObservationIgnored private let timeZone: TimeZone
  @ObservationIgnored private var visibleDays = Set<String>()

  init(client: CalendarClient, now: @escaping () -> Date = Date.init, timeZone: TimeZone = .current) {
    self.client = client
    self.now = now
    self.timeZone = timeZone
  }

  convenience init(app: AppModel) {
    self.init(client: .live(app))
  }

  var items: [CalendarItem] { state.value ?? [] }

  func load() async {
    if state.value == nil { state = .loading }
    let visibleStart = now()
    let priorGoogle = items.filter { $0.account != nil }
    let priorLocal = items.filter { $0.account == nil }
    var localLoaded = false
    visibleDays = makeVisibleDays(startingAt: visibleStart)
    let range = AgendaDays.requestRange(startingAt: visibleStart, visibleDays: 30, timeZone: timeZone)
    let bounds = (iso(range.from), iso(range.to))

    do {
      let local = try await client.agenda(bounds.0, bounds.1, "local")
      googleConnected = local.googleConnected
      googleNeedsAction = !local.googleConnected
      localLoaded = true
      update(items: local.items + priorGoogle)
      refreshError = nil
    } catch {
      if state.value == nil { state = .failed(error.localizedDescription) }
      refreshError = error.localizedDescription
    }

    // The two agenda reads stay independent: the local list is already on screen before Google.
    do {
      let waiting = try await client.waitingOnYou()
      addWaitingItems(waiting)
    } catch {
      // The agenda endpoint already supplies dated items; this auxiliary list is best effort.
    }

    do {
      let google = try await client.agenda(bounds.0, bounds.1, "google")
      googleConnected = google.googleConnected
      googleNeedsAction = !google.googleConnected || !google.errors.isEmpty
      googleNeedsReconnect = google.errors.contains { $0.reconnect == true }
      let failedAccounts = Set(google.errors.map(\.account))
      let returnedIDs = Set(google.items.map(\.id))
      let kept = priorGoogle.filter {
        guard let account = $0.account else { return false }
        return failedAccounts.contains(account) && !returnedIDs.contains($0.id)
      }
      let retainedLocal = localLoaded ? items.filter { $0.account == nil } : priorLocal
      update(items: retainedLocal + google.items + kept)
    } catch {
      googleNeedsAction = true
      googleNeedsReconnect = false
    }
  }

  func markDone(_ item: CalendarItem) async {
    guard item.kind == .todo, item.id.hasPrefix("todo:"), let value = state.value,
      !completing.contains(item.id)
    else { return }
    completing.insert(item.id)
    actionError = nil
    let itemId = String(item.id.dropFirst("todo:".count))
    do {
      try await client.markDone(itemId)
      update(items: items.filter { $0.id != item.id })
    } catch {
      actionError = error.localizedDescription
    }
    completing.remove(item.id)
  }

  private func addWaitingItems(_ waiting: [WaitingOnYouItem]) {
    var merged = items
    var known = Set(merged.map(\.id))
    for row in waiting where known.insert("todo:\(row.id)").inserted {
      guard let dueAt = row.dueAt, let date = parseISO(dueAt),
        visibleDays.contains(AgendaDays.day(of: date, allDay: false, timeZone: timeZone))
      else { continue }
      merged.append(CalendarItem(
        id: "todo:\(row.id)", kind: .todo, title: row.title, start: dueAt, end: nil,
        allDay: false, botId: row.botId, botName: row.botName, account: nil, href: nil,
        joinUrl: nil, mailId: nil))
    }
    update(items: merged)
  }

  private func makeVisibleDays(startingAt date: Date) -> Set<String> {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let first = calendar.startOfDay(for: date)
    return Set((0..<30).compactMap { offset in
      guard let day = calendar.date(byAdding: .day, value: offset, to: first) else { return nil }
      return AgendaDays.day(of: day, allDay: false, timeZone: timeZone)
    })
  }

  private func update(items: [CalendarItem]) {
    let visible = items.filter { item in
      guard let date = parseISO(item.start) else { return false }
      return visibleDays.contains(AgendaDays.day(of: date, allDay: item.allDay, timeZone: timeZone))
    }
    let sorted = visible.sorted { ($0.start, $0.id) < ($1.start, $1.id) }
    let collapsed = AgendaDays.collapseRepeatingRoutines(
      sorted, id: \.id, isRoutine: { $0.kind == .routine }, start: \.start)
    state = .loaded(collapsed)
  }

  private func iso(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  private func parseISO(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }
}
