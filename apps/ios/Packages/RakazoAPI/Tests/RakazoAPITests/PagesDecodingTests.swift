import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesPageList() throws {
  let list = try decode([PageSummary].self, "pages-list")
  #expect(list.map(\.id) == ["pg_cash", "pg_html"])
  #expect(list.map(\.kind) == ["blocks", "html"])
  #expect(list[0].title == "Cash")
  #expect(list[0].revision == 1)
}

@Test
func decodesBlocksPageWithEmptyChartSvgs() throws {
  let page = try #require(try decode(AgentPage?.self, "pages-get-blocks"))
  #expect(page.id == "pg_cash")
  #expect(!page.isHTML)
  #expect(page.revision == 1)
  #expect(page.chartSvgs == [])
  #expect(page.content.hasPrefix("# Cash"))
}

@Test
func decodesHTMLPage() throws {
  let page = try #require(try decode(AgentPage?.self, "pages-get-html"))
  #expect(page.isHTML)
  #expect(page.title == "Board")
  #expect(page.chartSvgs == nil)
}

@Test
func decodesNullPage() throws {
  #expect(try decode(AgentPage?.self, "pages-get-null") == nil)
}

@Test
func decodesBlocksData() throws {
  let data = try decode(PageData.self, "pages-data-blocks")
  guard case .blocks(let pageId, let revision, let blocks) = data else { Issue.record("not blocks"); return }
  #expect(pageId == "pg_cash")
  #expect(revision == 1)
  #expect(blocks.map(\.status) == ["ok", "missing", "failed"])
  #expect(blocks[0].text == "$1,533,221")
  #expect(blocks[1].fetchedAt == nil)
  #expect(blocks[2].error == "Mercury: request timed out")
  #expect(blocks[2].rows?.count == 3)
}

@Test
func decodesHTMLData() throws {
  let data = try decode(PageData.self, "pages-data-html")
  guard case .html(let pageId, _, .object(let sources)) = data else { Issue.record("not html"); return }
  #expect(pageId == "pg_html")
  guard case .object(let overview)? = sources["Overview"] else { Issue.record("no Overview"); return }
  #expect(overview["status"] == .string("ok"))
  #expect(overview["value"] != nil)
}

@Test
func decodesShare() throws {
  let share = try decode(PageShare?.self, "pages-share")
  #expect(share?.url.hasSuffix("#SHARE_TOKEN_PLACEHOLDER") == true)
  #expect(share?.artifactId == "cmvvf94y500887tc9iirwxp0u")
  #expect(share?.expiresAt.hasPrefix("2026-11-29") == true)
}
