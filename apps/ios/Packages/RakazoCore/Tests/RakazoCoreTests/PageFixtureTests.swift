import Foundation
import RakazoAPI
import Testing

@testable import RakazoCore

/// Recorded responses live with the API tests; read them from there.
private func fixture<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  let url = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appending(path: "RakazoAPI/Tests/RakazoAPITests/Fixtures/\(name).json")
  return try JSONDecoder().decode(RPCEnvelope<T>.self, from: Data(contentsOf: url)).json
}

@Test
func recordedBlocksPagePairsMetricMissingAndTable() throws {
  let page = try #require(try fixture(AgentPage?.self, "pages-get-blocks"))
  let data = try fixture(PageData.self, "pages-data-blocks")
  let live = try #require(liveBlocks(for: page, data: data))
  let blocks = pageBlocks(content: page.content, chartSvgs: page.chartSvgs ?? [], live: live)
  #expect(blocks.count == 4)
  #expect(blocks[0] == .markdown("# Cash\n"))
  #expect(blocks[1] == .metric(label: "Cash", status: "ok", error: nil, value: LiveCell(text: "$1,533,221", usd: true)))
  #expect(blocks[2] == .metric(label: "Missing", status: "missing", error: nil, value: nil))
  guard case .table("Vendors", "failed", "Mercury: request timed out", let rows) = blocks[3] else {
    Issue.record("table"); return
  }
  #expect(rows.count == 3)
  #expect(rows[0].title == LiveCell(text: "Cloudnine Hosting (Mock)", usd: false))
  #expect(rows[0].details == [LiveCell(text: "Monthly: $4,812", usd: true)])
}

@Test
func recordedHTMLDataIsAcceptedOnlyForItsPage() throws {
  let page = try #require(try fixture(AgentPage?.self, "pages-get-html"))
  let data = try fixture(PageData.self, "pages-data-html")
  #expect(htmlSources(for: page, data: data) != nil)
  let other = try #require(try fixture(AgentPage?.self, "pages-get-blocks"))
  #expect(htmlSources(for: other, data: data) == nil)
}
