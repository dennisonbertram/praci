import Testing

@testable import Praci

struct ThreadMarkdownTests {
  @Test func splitsBlocks() {
    let source = """
      # Title
      Intro **bold**
      still intro

      - one
      * two
      1. first
      > quote
      ```json
      {"a": 1}
      ```
      | Vendor | Amount |
      | --- | --- |
      | Acme | 10 |
      """
    #expect(
      parseMarkdown(source) == [
        .heading(level: 1, text: "Title"),
        .paragraph("Intro **bold**\nstill intro"),
        .bullet("one"), .bullet("two"), .numbered(1, "first"), .quote("quote"),
        .code(language: "json", text: "{\"a\": 1}"),
        .table(rows: [["Vendor", "Amount"], ["Acme", "10"]]),
      ])
  }

  @Test func unclosedFenceKeepsStreamedCode() {
    #expect(parseMarkdown("```\nlet x = 1") == [.code(language: nil, text: "let x = 1")])
  }

  @Test func hashWithoutSpaceIsText() {
    #expect(parseMarkdown("#hashtag") == [.paragraph("#hashtag")])
  }
}
