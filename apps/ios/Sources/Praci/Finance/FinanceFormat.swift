import Foundation

/// Shown in place of every amount when Hide amounts is on.
let financeMask = "•••"

/// Money is integer cents. Whole units for lists, cents for a single transaction.
/// A hidden amount shows a fixed mask that reveals neither size nor digit count.
func financeMoney(
  _ cents: Int, currency: String = "USD", hidden: Bool = false, exact: Bool = false,
  locale: Locale = .current
) -> String {
  if hidden { return financeMask }
  let value = Decimal(abs(cents)) / 100
  let style = Decimal.FormatStyle.Currency(code: currency, locale: locale)
  return value.formatted(exact ? style : style.precision(.fractionLength(0)))
}

/// A net figure, which may be negative: the sign is kept so a loss never reads as a gain.
func financeSignedTotal(
  _ cents: Int, currency: String = "USD", hidden: Bool = false, locale: Locale = .current
) -> String {
  let text = financeMoney(abs(cents), currency: currency, hidden: hidden, locale: locale)
  return cents < 0 && !hidden ? "-\u{2009}\(text)" : text
}

/// A transaction amount: money in gets a plus sign, money out has none.
func financeSignedMoney(
  _ cents: Int, currency: String, hidden: Bool, exact: Bool = false, locale: Locale = .current
) -> String {
  let text = financeMoney(cents, currency: currency, hidden: hidden, exact: exact, locale: locale)
  return cents > 0 && !hidden ? "+\(text)" : text
}

func financeRunway(_ months: Double?, hidden: Bool) -> String {
  guard let months else { return "—" }
  return hidden ? String(localized: "•• mo") : String(localized: "\(Int(months.rounded())) mo")
}

/// The day before a `YYYY-MM-DD` date, which is how an exclusive range end is shown.
enum FinanceDay {
  static func before(_ iso: String) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
    let parts = iso.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
      let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
      let previous = calendar.date(byAdding: .day, value: -1, to: date)
    else { return iso }
    let back = calendar.dateComponents([.year, .month, .day], from: previous)
    guard let y = back.year, let m = back.month, let d = back.day else { return iso }
    return String(format: "%04d-%02d-%02d", y, m, d)
  }
}

/// `2025-11` becomes a short month name; anything else is returned unchanged.
func financeMonthLabel(_ month: String, locale: Locale = .current) -> String {
  let parts = month.split(separator: "-")
  guard parts.count == 2, let number = Int(parts[1]), (1...12).contains(number) else { return month }
  var calendar = Calendar(identifier: .gregorian)
  calendar.locale = locale
  return calendar.shortMonthSymbols[number - 1]
}

/// `Oct 16` for a day (`2026-10-16`) or an ISO date-time.
func financeDay(_ iso: String, locale: Locale = .current) -> String {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
  let parser = ISO8601DateFormatter()
  parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  let plain = ISO8601DateFormatter()
  plain.formatOptions = [.withFullDate]
  let datetime = ISO8601DateFormatter()
  guard let date = parser.date(from: iso) ?? datetime.date(from: iso) ?? plain.date(from: iso)
  else { return "" }
  return date.formatted(
    Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone)
      .month(.abbreviated).day())
}

func financeNonUSDNote(_ count: Int) -> String {
  count == 1
    ? String(localized: "1 non-USD transaction not counted")
    : String(localized: "\(count) non-USD transactions not counted")
}
