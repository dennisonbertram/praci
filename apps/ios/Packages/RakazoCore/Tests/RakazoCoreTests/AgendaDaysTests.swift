import Foundation
import RakazoCore
import Testing

private struct Entry {
  let id: String
  let kind: String
  let start: String
}

@Test
func allDayKeepsUTCDateWhileTimedItemsUseViewerDay() {
  let instant = ISO8601DateFormatter().date(from: "2026-03-01T00:00:00Z")!
  let west = TimeZone(secondsFromGMT: -8 * 3600)!
  let east = TimeZone(secondsFromGMT: 10 * 3600)!
  #expect(AgendaDays.day(of: instant, allDay: true, timeZone: west) == "2026-03-01")
  #expect(AgendaDays.day(of: instant, allDay: false, timeZone: west) == "2026-02-28")
  #expect(AgendaDays.day(of: instant, allDay: false, timeZone: east) == "2026-03-01")
}

@Test
func requestRangeUsesCalendarDaysAcrossShortAndLongDSTDays() throws {
  let tz = try #require(TimeZone(identifier: "America/New_York"))
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = tz
  let spring = try #require(ISO8601DateFormatter().date(from: "2026-03-08T12:00:00-04:00"))
  let springRange = AgendaDays.requestRange(startingAt: spring, visibleDays: 30, timeZone: tz)
  #expect(springRange.to.timeIntervalSince(springRange.from) == 32 * 86_400 - 3_600)
  let fall = try #require(ISO8601DateFormatter().date(from: "2026-11-01T12:00:00-05:00"))
  let fallRange = AgendaDays.requestRange(startingAt: fall, visibleDays: 30, timeZone: tz)
  #expect(fallRange.to.timeIntervalSince(fallRange.from) == 32 * 86_400 + 3_600)
}

@Test
func requestRangeCapsAtNinetyThreeDays() {
  let start = Date(timeIntervalSince1970: 1_800_000_000)
  let range = AgendaDays.cappedRange(from: start, to: start.addingTimeInterval(120 * 86_400))
  #expect(range.to.timeIntervalSince(range.from) == 93 * 86_400)
}

@Test
func scheduleKeepsOnlyTheNextRunForEachRepeatingRoutine() {
  let items = [
    Entry(id: "routine:r1:2026-05-04", kind: "routine", start: "2026-05-04"),
    Entry(id: "routine:r1:2026-05-03", kind: "routine", start: "2026-05-03"),
    Entry(id: "routine:r2:2026-05-02", kind: "routine", start: "2026-05-02"),
    Entry(id: "routine:check", kind: "check_back", start: "2026-05-01"),
  ]
  let result = AgendaDays.collapseRepeatingRoutines(
    items, id: \.id, isRoutine: { $0.kind == "routine" }, start: \.start)
  #expect(result.map(\.id) == ["routine:check", "routine:r2:2026-05-02", "routine:r1:2026-05-03"])
}
