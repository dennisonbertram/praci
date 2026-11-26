import Foundation

/// Calendar schedule date rules shared by the native screen and its tests.
public enum AgendaDays {
  public struct Range: Equatable, Sendable {
    public let from: Date
    public let to: Date
  }

  /// All-day values are UTC-midnight dates and keep their UTC calendar day. Timed values use the
  /// viewer's calendar day, including daylight-saving transitions.
  public static func day(of instant: Date, allDay: Bool, timeZone: TimeZone = .current) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = allDay ? (TimeZone(secondsFromGMT: 0) ?? .gmt) : timeZone
    let parts = calendar.dateComponents([.year, .month, .day], from: instant)
    return String(format: "%04d-%02d-%02d", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
  }

  /// Widens a visible day range by one day at each edge for UTC-midnight all-day events, while
  /// respecting the server's 93-day maximum. `visibleDays` counts calendar days.
  public static func requestRange(
    startingAt start: Date, visibleDays: Int, timeZone: TimeZone = .current
  ) -> Range {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let first = calendar.startOfDay(for: start)
    let count = max(1, min(visibleDays, 91))
    let from = calendar.date(byAdding: .day, value: -1, to: first) ?? first
    let requestedTo = calendar.date(byAdding: .day, value: count + 1, to: first) ?? first
    return cappedRange(from: from, to: requestedTo)
  }

  /// Clamp arbitrary half-open request bounds to the server's 93-day limit.
  public static func cappedRange(from: Date, to: Date) -> Range {
    let maximum = 93 * 86_400.0
    return Range(from: from, to: min(to, from.addingTimeInterval(maximum)))
  }

  /// Schedule views show only the next occurrence for each repeating routine.
  public static func collapseRepeatingRoutines<Item>(
    _ items: [Item], id: (Item) -> String, isRoutine: (Item) -> Bool, start: (Item) -> String
  ) -> [Item] {
    var seen = Set<String>()
    return items.sorted {
      let lhs = start($0), rhs = start($1)
      return lhs == rhs ? id($0) < id($1) : lhs < rhs
    }.filter { item in
      guard isRoutine(item) else { return true }
      let pieces = id(item).split(separator: ":", omittingEmptySubsequences: false)
      let routineID = pieces.count > 1 ? String(pieces[1]) : id(item)
      guard seen.insert(routineID).inserted else { return false }
      return true
    }.sorted { start($0) < start($1) }
  }
}
