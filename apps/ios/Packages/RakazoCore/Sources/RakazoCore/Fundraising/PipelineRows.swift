import Foundation

/// The contact fields needed to build and order one fundraising pipeline row.
public struct PipelineContact: Sendable, Equatable {
  public let id: String
  public let name: String
  public let stage: String?
  public let status: String?
  public let nextCallAt: String?
  public let nextCallHasTime: Bool

  public init(
    id: String, name: String, stage: String? = nil, status: String? = nil,
    nextCallAt: String? = nil, nextCallHasTime: Bool = false
  ) {
    self.id = id
    self.name = name
    self.stage = stage
    self.status = status
    self.nextCallAt = nextCallAt
    self.nextCallHasTime = nextCallHasTime
  }
}

public enum PipelineDayBand: Int, Sendable, Equatable, CaseIterable {
  case overdue, today, week, later, none
}

public struct PipelineRow: Sendable, Equatable, Identifiable {
  public let id: String
  public let name: String
  public let status: String
  public let nextCallAt: String?
  public let nextCallHasTime: Bool
  public let band: PipelineDayBand
}

private let pipelineStatusForStage: [String: String] = [
  "target": "not_reached",
  "intro": "intro_requested",
  "meeting": "meeting_booked",
  "diligence": "diligence",
  "committed": "committed",
  "passed": "passed",
]

/// A date-only pipeline call is stored at noon UTC; its visible day is still the ISO date prefix.
public func pipelineCallDay(at: String?, hasTime: Bool, timeZone: TimeZone = .current) -> String? {
  guard let at else { return nil }
  if !hasTime { return String(at.prefix(10)) }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  let fallback = ISO8601DateFormatter()
  guard let date = formatter.date(from: at) ?? fallback.date(from: at) else { return nil }
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = timeZone
  let parts = calendar.dateComponents([.year, .month, .day], from: date)
  guard let year = parts.year, let month = parts.month, let day = parts.day else { return nil }
  return String(format: "%04d-%02d-%02d", year, month, day)
}

private func utcDay(_ value: String) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withFullDate]
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  return formatter.date(from: String(value.prefix(10)))
}

private func daysFrom(_ day: String, _ today: String) -> Int? {
  guard let date = utcDay(day), let now = utcDay(today) else { return nil }
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
  return calendar.dateComponents([.day], from: now, to: date).day
}

public func pipelineDayBand(
  at: String?, hasTime: Bool, today: String, timeZone: TimeZone = .current
) -> PipelineDayBand {
  guard let day = pipelineCallDay(at: at, hasTime: hasTime, timeZone: timeZone),
    let away = daysFrom(day, today)
  else { return .none }
  if away < 0 { return .overdue }
  if away == 0 { return .today }
  if away <= 7 { return .week }
  return .later
}

private func pipelineSortValue(_ row: PipelineRow, timeZone: TimeZone) -> String? {
  guard let day = pipelineCallDay(at: row.nextCallAt, hasTime: row.nextCallHasTime, timeZone: timeZone)
  else { return nil }
  guard row.nextCallHasTime, let at = row.nextCallAt else { return "\(day)T00:00" }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  guard let date = formatter.date(from: at) ?? ISO8601DateFormatter().date(from: at) else { return "\(day)T00:00" }
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = timeZone
  let parts = calendar.dateComponents([.hour, .minute], from: date)
  return String(format: "%@T%02d:%02d", day, parts.hour ?? 0, parts.minute ?? 0)
}

/// Maps contacts to rows, defaults absent pipeline status from contact stage, excludes Passed by
/// default like the web page, and sorts by the web's next-call ascending order with blanks last.
public func pipelineRows(
  _ contacts: [PipelineContact], today: String, timeZone: TimeZone = .current
) -> [PipelineRow] {
  contacts.enumerated().compactMap { pair -> (offset: Int, element: PipelineRow)? in
    let offset = pair.offset
    let contact = pair.element
    let status = contact.status ?? pipelineStatusForStage[contact.stage ?? "target"] ?? "not_reached"
    guard status != "passed" else { return nil }
    return (offset: offset, element: PipelineRow(
      id: contact.id,
      name: contact.name,
      status: status,
      nextCallAt: contact.nextCallAt,
      nextCallHasTime: contact.nextCallHasTime,
      band: pipelineDayBand(
        at: contact.nextCallAt, hasTime: contact.nextCallHasTime, today: today, timeZone: timeZone)
    ))
  }.sorted { left, right in
    let l = left.element
    let r = right.element
    if l.band != r.band { return l.band.rawValue < r.band.rawValue }
    if let lValue = pipelineSortValue(l, timeZone: timeZone),
      let rValue = pipelineSortValue(r, timeZone: timeZone), lValue != rValue
    { return lValue < rValue }
    return left.offset < right.offset
  }.map(\.element)
}

/// Encodes a selected date at noon UTC, matching the web's `callIso(day, null)` convention.
public func pipelineCallISO(day: String, time: String? = nil, timeZone: TimeZone = .current) -> String? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  if let time {
    let localFormatter = DateFormatter()
    localFormatter.calendar = Calendar(identifier: .gregorian)
    localFormatter.locale = Locale(identifier: "en_US_POSIX")
    localFormatter.timeZone = timeZone
    localFormatter.dateFormat = "yyyy-MM-dd HH:mm"
    guard let date = localFormatter.date(from: "\(day) \(time)") else { return nil }
    return formatter.string(from: date)
  }
  var utcCalendar = Calendar(identifier: .gregorian)
  utcCalendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
  guard let date = utcDay(day), let noon = utcCalendar.date(byAdding: .hour, value: 12, to: date)
  else { return nil }
  return formatter.string(from: noon)
}
