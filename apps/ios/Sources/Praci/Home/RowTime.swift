import Foundation

/// The short timestamp on a Home row: a time today, "Yesterday", a weekday this week, otherwise a date.
func rowTimestamp(
  _ iso: String, now: Date = .now, calendar: Calendar = .current, locale: Locale = .current
) -> String {
  let parser = ISO8601DateFormatter()
  parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  let plain = ISO8601DateFormatter()
  guard let date = parser.date(from: iso) ?? plain.date(from: iso) else { return "" }
  if calendar.isDate(date, inSameDayAs: now) {
    return date.formatted(Date.FormatStyle(date: .omitted, time: .shortened, locale: locale, calendar: calendar, timeZone: calendar.timeZone))
  }
  if calendar.date(byAdding: .day, value: -1, to: now).map { calendar.isDate(date, inSameDayAs: $0) } == true { return String(localized: "Yesterday") }
  let days = calendar.dateComponents([.day], from: date, to: now).day ?? 0
  if days > 0 && days < 7 {
    return date.formatted(Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).weekday(.abbreviated))
  }
  return date.formatted(Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day())
}
