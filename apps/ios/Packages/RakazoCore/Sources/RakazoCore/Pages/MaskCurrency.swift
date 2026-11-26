import Foundation

// Port of packages/chat-ui/src/mask-currency.ts: money is masked, plain numbers, dates and percentages stay.

private let currencyPattern: NSRegularExpression = {
  let sc = #"\p{Sc}"#
  let codes = "(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR|CNY|MXN|BRL|SEK|NOK|DKK|NZD|SGD|HKD)"
  let num = #"(?:\d{1,3}(?:[ ,.  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)"#
  let scale = #"(?:\s?(?:million|billion|thousand)\b|[kKmMbB](?![\p{L}\p{N}_]))"#
  let sign = "[-−+]?"
  let word = #"[\p{L}\p{N}_]"#
  let grouped = #"\d{1,3}(?:[,.  ]\d{3})+"#
  let pattern = [
    #"(?<s1>\#(sign))(?<y1>\#(sc))\s?\#(sign)\#(num)\#(scale)?"#,
    #"(?<![\p{L}\p{N}_])(?<s2>\#(sign))\#(codes)\s?\#(sign)\#(num)\#(scale)?"#,
    #"(?<![\p{L}\p{N}_$.,])(?<s3>\#(sign))\#(num)\#(scale)?\s?(?:\#(codes)(?!\#(word))|(?<y3>\#(sc))(?!\d))"#,
    #"(?<![\p{L}\p{N}_$.,/])(?<ct>\#(grouped))(?![\p{N}_]|[.,]\d)"#,
  ].joined(separator: "|")
  // The pattern is a constant; a failure here is a programming error caught by the tests.
  return try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
}()

/// Replaces each currency amount and grouped count with a fixed mask. Currency keeps its sign
/// and symbol (`-$•••`, `€•••`), a spelled-out code like USD masks as `$•••`, and a count
/// written with thousands groups becomes `•••`.
public func maskCurrencyText(_ text: String) -> String {
  let whole = NSRange(text.startIndex..., in: text)
  var out = ""
  var at = text.startIndex
  for match in currencyPattern.matches(in: text, range: whole) {
    guard let range = Range(match.range, in: text) else { continue }
    func group(_ name: String) -> String? {
      let r = match.range(withName: name)
      return r.location == NSNotFound ? nil : Range(r, in: text).map { String(text[$0]) }
    }
    let replacement = if group("ct") != nil {
      "•••"
    } else {
      "\(group("s1") ?? group("s2") ?? group("s3") ?? "")\(group("y1") ?? group("y3") ?? "$")•••"
    }
    out += text[at ..< range.lowerBound] + replacement
    at = range.upperBound
  }
  return out + text[at...]
}

/// Masks the figures in a chart's text labels (`<text>` and `<tspan>`).
public func maskSVGText(_ svg: String) -> String {
  let labels = try! NSRegularExpression(pattern: #">([^<>]+)</(text|tspan)>"#)
  var out = ""
  var at = svg.startIndex
  for match in labels.matches(in: svg, range: NSRange(svg.startIndex..., in: svg)) {
    guard let all = Range(match.range, in: svg), let label = Range(match.range(at: 1), in: svg),
          let tag = Range(match.range(at: 2), in: svg)
    else { continue }
    out += svg[at ..< all.lowerBound] + ">" + maskCurrencyText(String(svg[label])) + "</" + svg[tag] + ">"
    at = all.upperBound
  }
  return out + svg[at...]
}
