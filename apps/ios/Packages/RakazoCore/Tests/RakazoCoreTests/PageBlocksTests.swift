import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

private func block(_ status: String, text: String? = nil, rows: [JSONValue]? = nil, error: String? = nil)
  -> PageLiveBlock
{
  PageLiveBlock(status: status, error: error, text: text, rows: rows)
}

struct PageBlocksTests {
  let content = """
  # Sales

  ```metric
  {"label":"MRR","source":"s","format":"usd"}
  ```

  ```chart
  {"name":"Static","spec":{},"data":[]}
  ```

  ```chart
  {"name":"Live","source":"s"}
  ```

  ```table
  {"name":"Deals","source":"s","columns":[{"key":"name","label":"Name"},{"key":"amount","label":"Amount","format":"usd"}]}
  ```

  ```gtm-plan
  {"group":"done"}
  ```

  ```js
  ```metric
  ```

  ```metric extra
  {}
  ```
  """

  @Test func pairsLiveBlocksInDocumentOrder() {
    let live = [
      block("ok", text: "$1,200"),
      block("ok"), // the chart with a source takes an entry; the static chart does not
      block(
        "ok",
        rows: [.object(["name": .string("Acme"), "amount": .number(2500)])]
      ),
    ]
    let blocks = pageBlocks(content: content, chartSvgs: ["<svg/>", "<svg id='2'/>"], live: live)
    #expect(blocks.count == 7)
    #expect(blocks[0] == .markdown("# Sales\n"))
    #expect(blocks[1] == .metric(label: "MRR", status: "ok", error: nil, value: LiveCell(text: "$1,200", usd: true)))
    #expect(blocks[2] == .chart(name: "Static", svg: "<svg/>"))
    #expect(blocks[3] == .chart(name: "Live", svg: "<svg id='2'/>"))
    guard case let .table(_, "ok", _, rows) = blocks[4] else { Issue.record("table")
      return
    }
    #expect(rows[0].title == LiveCell(text: "Acme", usd: false))
    #expect(rows[0].details == [LiveCell(text: "Amount: $2,500", usd: true)])
    // The gtm fence is dropped; the js fence keeps its inner metric text as Markdown.
    guard case let .markdown(code) = blocks[5] else { Issue.record("code")
      return
    }
    #expect(code.contains("```metric"))
    #expect(blocks[6] == .chartError)
  }

  @Test func missingDataKeepsStatusAndNoSvgBecomesError() {
    let blocks = pageBlocks(content: content)
    #expect(blocks[1] == .metric(label: "MRR", status: "empty", error: nil, value: nil))
    #expect(blocks[2] == .chartError)
  }

  @Test func failedMetricKeepsErrorAndLastValue() {
    let blocks = pageBlocks(
      content: "```metric\n{\"label\":\"A\",\"source\":\"s\"}\n```",
      live: [block("failed", text: "5", error: "boom")]
    )
    #expect(blocks == [.metric(label: "A", status: "failed", error: "boom", value: LiveCell(text: "5", usd: false))])
  }

  @Test func unclosedFenceIsInvalidAndEndsThePage() {
    let blocks = pageBlocks(content: "hi\n```metric\n{\"label\":\"A\"")
    #expect(blocks == [.markdown("hi"), .chartError])
  }

  @Test func formatsCellsLikeTheServer() {
    #expect(formatCell(.number(1234.5), format: "usd") == "$1,235")
    #expect(formatCell(.number(12.5), format: "usd") == "$12.50")
    #expect(formatCell(.number(0.256), format: "percent") == "0.3%")
    #expect(formatCell(.string("1234567"), format: "number") == "1,234,567")
    #expect(formatCell(.string("n/a"), format: "number") == "n/a")
    #expect(formatCell(.number(3)) == "3")
    #expect(formatCell(.bool(true)) == "true")
    #expect(formatCell(nil) == "")
    #expect(formatCell(.object(["a": .number(1)])) == "{\"a\":1}")
  }

  @Test func withoutColumnsTheFirstRowsKeysAreUsed() {
    let rows: [JSONValue] = [.object(["b": .number(2), "a": .string("x")])]
    let blocks = pageBlocks(
      content: "```table\n{\"name\":\"T\",\"source\":\"s\"}\n```", live: [block("ok", rows: rows)]
    )
    guard case let .table(_, _, _, out) = blocks[0] else { Issue.record("table")
      return
    }
    #expect(out[0].title.text == "x")
    #expect(out[0].details.first?.text == "b: 2")
  }

  @Test func dataIsAcceptedOnlyForTheShownPageAndRevision() {
    let page = AgentPage(id: "p1", botId: "b", content: "", revision: 3)
    let ok = PageData.blocks(pageId: "p1", revision: 3, blocks: [block("ok")])
    #expect(liveBlocks(for: page, data: ok)?.count == 1)
    #expect(liveBlocks(for: page, data: .blocks(pageId: "p1", revision: 2, blocks: [])) == nil)
    #expect(liveBlocks(for: page, data: .blocks(pageId: "p2", revision: 3, blocks: [])) == nil)
    #expect(liveBlocks(for: nil, data: ok) == nil)
    let sources = JSONValue.object(["a": .null])
    #expect(htmlSources(for: page, data: .html(pageId: "p1", revision: 3, sources: sources)) == sources)
    #expect(htmlSources(for: page, data: .html(pageId: "p1", revision: 4, sources: sources)) == nil)
    #expect(htmlSources(for: page, data: ok) == nil)
  }

  @Test func decodesBothDataShapes() throws {
    let blocks = #"{"pageId":"p","revision":1,"blocks":[{"status":"ok","fetchedAt":null,"text":"1"}]}"#
    let html = #"{"kind":"html","pageId":"p","revision":1,"sources":{"a":{"status":"ok","value":1}}}"#
    let decoder = JSONDecoder()
    #expect(try decoder.decode(PageData.self, from: Data(blocks.utf8)) == .blocks(pageId: "p", revision: 1, blocks: [block("ok", text: "1")]))
    guard case let .html(_, _, .object(sources)) = try decoder.decode(PageData.self, from: Data(html.utf8))
    else { Issue.record("html")
      return
    }
    #expect(sources.keys.contains("a"))
  }

  @Test func masksMoneyOnly() {
    #expect(maskCurrencyText("Amount: $1,234.50") == "Amount: $•••")
    #expect(maskCurrencyText("-€5k and 600,000 options in 2026, 12.5%") == "-€••• and ••• options in 2026, 12.5%")
    #expect(maskSVGText("<text>$40</text><text>May</text>") == "<text>$•••</text><text>May</text>")
  }

  @Test func masksTrailingCurrencySymbols() {
    #expect(maskCurrencyText("1,200 USD or 1.234,56 EUR") == "$••• or $•••")
    #expect(maskCurrencyText("1 234,56 € and 1,200 ¥ or 900 ₹") == "€••• and ¥••• or ₹•••")
    #expect(maskCurrencyText("-1.234,56 €") == "-€•••")
  }
}
