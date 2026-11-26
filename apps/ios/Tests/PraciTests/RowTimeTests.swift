import Foundation
import Testing

@testable import Praci

@Test
func rowTimestampPicksTimeYesterdayWeekdayOrDate() throws {
  var cal = Calendar(identifier: .gregorian)
  cal.timeZone = try #require(TimeZone(secondsFromGMT: 0))
  let en = Locale(identifier: "en_US")
  let now = try #require(ISO8601DateFormatter().date(from: "2026-01-10T15:00:00Z"))
  func stamp(_ s: String) -> String { rowTimestamp(s, now: now, calendar: cal, locale: en) }
  #expect(stamp("2026-01-10T09:05:00.000Z").contains("9:05"))
  #expect(stamp("2026-01-09T09:05:00.000Z") == "Yesterday")
  #expect(stamp("2026-01-07T09:05:00.000Z") == "Wed")
  #expect(stamp("2025-12-01T09:05:00.000Z") == "Dec 1")
  #expect(stamp("garbage") == "")
}
