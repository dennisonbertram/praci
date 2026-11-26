import Foundation
import RakazoAPI

// Port of splitPage (packages/core/src/pages.ts) and pageBlocks (apps/mobile/lib/agent-page.ts).

/// A table cell or metric value; `usd` values are masked while amounts are hidden.
public struct LiveCell: Equatable, Sendable {
  public var text: String
  public var usd: Bool
  public init(text: String, usd: Bool) {
    self.text = text
    self.usd = usd
  }
}

public enum PageBlock: Equatable, Sendable {
  case markdown(String)
  case chart(name: String, svg: String)
  case chartError
  case metric(label: String, status: String, error: String?, value: LiveCell?)
  case table(name: String, status: String, error: String?, rows: [TableRow])

  public struct TableRow: Equatable, Sendable {
    public var title: LiveCell
    public var details: [LiveCell]
  }
}

enum PageSegment: Equatable {
  case markdown(String)
  case chart(name: String, hasSource: Bool)
  case metric(label: String, format: String)
  case table(name: String, columns: [Column]?)
  /// An invalid chart, metric or table fence.
  case invalid

  struct Column: Equatable, Decodable {
    var key: String
    var label: String
    var format: String?
  }
}

private struct ChartFence: Decodable {
  var name: String
  var source: String?
}

private struct MetricFence: Decodable {
  var label: String
  var format: String?
}

private struct TableFence: Decodable {
  var name: String
  var columns: [PageSegment.Column]?
}

private func isFenceClose(_ line: String) -> Bool {
  let body = line.reversed().drop(while: { $0 == " " || $0 == "\t" })
  return body.count >= 3 && body.allSatisfy { $0 == "`" }
}

private func fenceName(_ line: String) -> String? {
  for name in ["chart", "metric", "table"] {
    let rest = line.dropFirst(3 + name.count)
    if line.hasPrefix("```" + name), rest.allSatisfy({ $0 == " " || $0 == "\t" }) { return name }
  }
  return nil
}

/// A metric or table fence with text after its name is a mistake, not a code block.
private func liveFenceWithInfo(_ line: String) -> Bool {
  for name in ["metric", "table"] where line.hasPrefix("```" + name) {
    let rest = line.dropFirst(3 + name.count)
    if let first = rest.first, first == " " || first == "\t", rest.contains(where: { !$0.isWhitespace }) {
      return true
    }
  }
  return false
}

/// The run of 3 or more backticks or tildes that starts `line`, if any.
private func codeFenceRun(_ line: String) -> (Character, Int)? {
  guard let c = line.first, c == "`" || c == "~" else { return nil }
  let count = line.prefix(while: { $0 == c }).count
  return count >= 3 ? (c, count) : nil
}

private func decode<T: Decodable>(_ type: T.Type, _ raw: String) -> T? {
  try? JSONDecoder().decode(type, from: Data(raw.utf8))
}

/// Splits a page into Markdown runs and chart, metric and table fences, in document order.
/// GTM blocks are not shown on the phone and are dropped. An unclosed fence is reported as
/// invalid rather than swallowing the rest of the page.
func splitPage(_ content: String) -> [PageSegment] {
  var segments: [PageSegment] = []
  let lines = content.components(separatedBy: "\n")
  var text: [String] = []
  func flush() {
    if text.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) {
      segments.append(.markdown(text.joined(separator: "\n")))
    }
    text = []
  }
  func closing(after i: Int) -> Int? {
    lines.indices.first { $0 > i && isFenceClose(lines[$0]) }
  }
  var i = 0
  while i < lines.count {
    defer { i += 1 }
    let line = lines[i]
    if line.hasPrefix("```gtm-") {
      flush()
      guard let end = closing(after: i) else { return segments }
      i = end
      continue
    }
    if liveFenceWithInfo(line) {
      flush()
      segments.append(.invalid)
      guard let end = closing(after: i) else { return segments }
      i = end
      continue
    }
    guard let name = fenceName(line) else {
      text.append(line)
      if let (char, length) = codeFenceRun(line) {
        // Another code fence: its lines are plain Markdown until a matching closer.
        while i + 1 < lines.count {
          i += 1
          text.append(lines[i])
          let tail = lines[i].reversed().drop(while: { $0 == " " || $0 == "\t" })
          if tail.count >= length, tail.allSatisfy({ $0 == char }) { break }
        }
      }
      continue
    }
    let end = closing(after: i)
    flush()
    guard let end else {
      segments.append(.invalid)
      return segments
    }
    let raw = lines[(i + 1) ..< end].joined(separator: "\n")
    i = end
    switch name {
    case "metric":
      if let m = decode(MetricFence.self, raw) {
        segments.append(.metric(label: m.label, format: m.format ?? "number"))
      } else {
        segments.append(.invalid)
      }
    case "table":
      if let t = decode(TableFence.self, raw) {
        segments.append(.table(name: t.name, columns: t.columns))
      } else {
        segments.append(.invalid)
      }
    default:
      if let c = decode(ChartFence.self, raw) {
        segments.append(.chart(name: c.name, hasSource: c.source != nil))
      } else {
        segments.append(.invalid)
      }
    }
  }
  flush()
  return segments
}

private let enUS = Locale(identifier: "en_US")

private func jsNumber(_ n: Double) -> String {
  n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(n)
}

/// Same rules as the server's pin formatter, for table cells (metric text arrives formatted).
public func formatCell(_ value: JSONValue?, format: String? = nil) -> String {
  guard let value, value != .null else { return "" }
  var number: Double?
  switch value {
  case let .number(n): number = n
  case let .string(s):
    let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
    number = trimmed.isEmpty ? nil : Double(trimmed)
  default: break
  }
  if let format, format != "text", let n = number, n.isFinite {
    switch format {
    case "percent": return String(format: "%.1f%%", n)
    case "number": return n.formatted(.number.locale(enUS))
    default:
      let digits = abs(n) >= 1000 ? 0 : 2
      return n.formatted(.currency(code: "USD").locale(enUS).rounded(rule: .toNearestOrAwayFromZero).precision(.fractionLength(digits)))
    }
  }
  switch value {
  case let .string(s): return s
  case let .number(n): return jsNumber(n)
  case let .bool(b): return b ? "true" : "false"
  default:
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return (try? String(data: encoder.encode(value), encoding: .utf8)) ?? ""
  }
}

private func tableRows(_ columns: [PageSegment.Column]?, _ rows: [JSONValue]) -> [PageBlock.TableRow] {
  var cols = columns
  if cols == nil {
    if case let .object(first)? = rows.first {
      cols = first.keys.sorted().map { .init(key: $0, label: $0, format: nil) }
    } else {
      cols = [.init(key: "value", label: "value", format: nil)]
    }
  }
  guard let cols, let titleColumn = cols.first else { return [] }
  func cell(_ row: JSONValue, _ column: PageSegment.Column) -> LiveCell {
    var value: JSONValue?
    if case let .object(object) = row {
      value = object[column.key]
    } else if column.key == "value" {
      value = row
    }
    return LiveCell(text: formatCell(value, format: column.format), usd: column.format == "usd")
  }
  return rows.map { row in
    PageBlock.TableRow(
      title: cell(row, titleColumn),
      details: cols.dropFirst().map { column in
        var detail = cell(row, column)
        detail.text = "\(column.label): \(detail.text)"
        return detail
      }
    )
  }
}

/// Pairs each valid chart with the Nth server-rendered SVG, and each live segment (metric, table,
/// chart with a source, in document order) with the Nth entry of `pages/data`.
public func pageBlocks(
  content: String, chartSvgs: [String] = [], live: [PageLiveBlock] = []
) -> [PageBlock] {
  var chartIndex = 0
  var liveIndex = 0
  func nextLive() -> PageLiveBlock? {
    defer { liveIndex += 1 }
    return live.indices.contains(liveIndex) ? live[liveIndex] : nil
  }
  return splitPage(content).map { segment in
    switch segment {
    case let .markdown(text): return .markdown(text)
    case .invalid: return .chartError
    case let .metric(label, format):
      let data = nextLive()
      return .metric(
        label: label, status: data?.status ?? "empty", error: data?.error,
        value: data?.text.map { LiveCell(text: $0, usd: format == "usd") }
      )
    case let .table(name, columns):
      let data = nextLive()
      return .table(
        name: name, status: data?.status ?? "empty", error: data?.error,
        rows: tableRows(columns, data?.rows ?? [])
      )
    case let .chart(name, hasSource):
      if hasSource { liveIndex += 1 }
      defer { chartIndex += 1 }
      if chartSvgs.indices.contains(chartIndex), !chartSvgs[chartIndex].isEmpty {
        return .chart(name: name, svg: chartSvgs[chartIndex])
      }
      return .chartError
    }
  }
}

/// Live blocks only for the shown page and revision; data for another revision would pair with the
/// wrong blocks.
public func liveBlocks(for page: AgentPage?, data: PageData?) -> [PageLiveBlock]? {
  guard let page, case let .blocks(pageId, revision, blocks)? = data,
        pageId == page.id, revision == page.revision
  else { return nil }
  return blocks
}

/// An HTML page receives only data for its own page id and revision.
public func htmlSources(for page: AgentPage?, data: PageData?) -> JSONValue? {
  guard let page, case let .html(pageId, revision, sources)? = data,
        pageId == page.id, revision == page.revision
  else { return nil }
  return sources
}
