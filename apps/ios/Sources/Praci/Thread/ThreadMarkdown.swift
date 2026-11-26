import Foundation

/// A block-level piece of agent markdown. Inline styling (bold, links, code) is left to
/// `AttributedString(markdown:)`, which does not handle headings, lists, fences or tables itself.
enum MarkdownBlock: Equatable {
  case paragraph(String)
  case heading(level: Int, text: String)
  case bullet(String)
  case numbered(Int, String)
  case quote(String)
  case code(language: String?, text: String)
  case table(rows: [[String]])
  case rule
}

// ponytail: line-based parser; nested lists and lazy continuation lines are flattened.
// A line-based parser reads best as one loop.
// swiftlint:disable:next function_body_length cyclomatic_complexity
func parseMarkdown(_ source: String) -> [MarkdownBlock] {
  var blocks: [MarkdownBlock] = []
  var paragraph: [String] = []
  var code: (language: String?, lines: [String])?
  var table: [[String]] = []

  func flushParagraph() {
    if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: "\n"))) }
    paragraph = []
  }
  func flushTable() {
    if !table.isEmpty { blocks.append(.table(rows: table)) }
    table = []
  }

  for raw in source.components(separatedBy: "\n") {
    let line = raw.trimmingCharacters(in: .whitespaces)
    if var open = code {
      if line.hasPrefix("```") {
        blocks.append(.code(language: open.language, text: open.lines.joined(separator: "\n")))
        code = nil
      } else {
        open.lines.append(raw)
        code = open
      }
      continue
    }
    if line.hasPrefix("|"), line.hasSuffix("|"), line.count > 1 {
      flushParagraph()
      let cells = line.dropFirst().dropLast().split(
        separator: "|", omittingEmptySubsequences: false
      ).map { $0.trimmingCharacters(in: .whitespaces) }
      let isSeparator = cells.allSatisfy { !$0.isEmpty && $0.allSatisfy { "-: ".contains($0) } }
      if !isSeparator { table.append(cells) }
      continue
    }
    flushTable()
    if line.hasPrefix("```") {
      flushParagraph()
      let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
      code = (language.isEmpty ? nil : language, [])
    } else if line.isEmpty {
      flushParagraph()
    } else if line.count >= 3, line.allSatisfy({ "-*_".contains($0) }) {
      flushParagraph()
      blocks.append(.rule)
    } else if let heading = headingMatch(line) {
      flushParagraph()
      blocks.append(heading)
    } else if let rest = bulletRest(line) {
      flushParagraph()
      blocks.append(.bullet(rest))
    } else if let (number, rest) = numberedRest(line) {
      flushParagraph()
      blocks.append(.numbered(number, rest))
    } else if line.hasPrefix(">") {
      flushParagraph()
      blocks.append(.quote(String(line.dropFirst()).trimmingCharacters(in: .whitespaces)))
    } else {
      paragraph.append(line)
    }
  }
  flushParagraph()
  flushTable()
  if let open = code { blocks.append(.code(language: open.language, text: open.lines.joined(separator: "\n"))) }
  return blocks
}

private func headingMatch(_ line: String) -> MarkdownBlock? {
  let hashes = line.prefix { $0 == "#" }.count
  guard (1...6).contains(hashes), line.dropFirst(hashes).first == " " else { return nil }
  return .heading(level: hashes, text: line.dropFirst(hashes).trimmingCharacters(in: .whitespaces))
}

private func bulletRest(_ line: String) -> String? {
  for marker in ["- ", "* ", "+ "] where line.hasPrefix(marker) {
    return String(line.dropFirst(2))
  }
  return nil
}

private func numberedRest(_ line: String) -> (Int, String)? {
  let digits = line.prefix { $0.isNumber }
  guard !digits.isEmpty, let number = Int(digits) else { return nil }
  let rest = line.dropFirst(digits.count)
  guard rest.hasPrefix(". ") else { return nil }
  return (number, String(rest.dropFirst(2)))
}

/// Inline markdown to styled text; falls back to the raw string when it does not parse.
func inlineMarkdown(_ text: String) -> AttributedString {
  let options = AttributedString.MarkdownParsingOptions(
    interpretedSyntax: .inlineOnlyPreservingWhitespace)
  return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
}
