import Foundation
import Testing

@testable import Praci

private struct Boom: LocalizedError { var errorDescription: String? { "Address is not allowed." } }

@Test func requestTrimsAndDropsBlankHeaderNames() throws {
  var secret = McpHeaderRow()
  secret.name = " Authorization "
  secret.value = " Bearer s3cret "
  let blank = McpHeaderRow(name: "  ", value: "ignored")
  let input = try #require(
    AddMcpServerLogic.request(name: "  ", url: "  https://api.brex.com/mcp \n", headers: [secret, blank]))
  #expect(input.endpoint == "https://api.brex.com/mcp")
  #expect(input.name == "Brex")
  #expect(input.headers == ["Authorization": "Bearer s3cret"])
  #expect(input.transport == "streamable_http" && input.enabled)
  #expect(input.slug.hasPrefix("integration-") && input.slug.count == 20)
  let json = String(decoding: try JSONEncoder().encode(input), as: UTF8.self)
  #expect(json.contains("Bearer s3cret"))
}

@Test func givenNameWins() throws {
  let input = try #require(AddMcpServerLogic.request(name: " Docs ", url: "https://x.example/mcp", headers: []))
  #expect(input.name == "Docs")
  #expect(input.headers.isEmpty)
}

@Test func urlValidationMatchesTheWebRules() {
  for ok in ["https://a.example/mcp", "http://localhost:8080/mcp", "http://192.168.1.2/mcp"] {
    #expect(AddMcpServerLogic.isValidURL(ok), "\(ok)")
  }
  for bad in [
    "", "example.com/mcp", "ftp://a.example", "https://", "https://u:p@a.example/", "https://a.example/#x",
    "https://a.example/mcp#", "javascript:alert(1)",
  ] {
    #expect(!AddMcpServerLogic.isValidURL(bad), "\(bad)")
  }
}

@Test func derivedNameFallsBackForIPs() {
  #expect(AddMcpServerLogic.derivedName("https://10.0.0.1/mcp") == "MCP server")
  #expect(AddMcpServerLogic.derivedName("https://mcp.example.co.uk/x") == "Example")
}

@MainActor
@Test func failureKeepsInputAndShowsServerError() async {
  let model = AddMcpServerModel { _ in throw Boom() }
  model.url = "https://a.example/mcp"
  model.headers = [McpHeaderRow(name: "X-Key", value: "v")]
  #expect(await model.submit() == false)
  #expect(model.error == "Address is not allowed.")
  #expect(model.url == "https://a.example/mcp" && model.headers.count == 1)
  #expect(!model.busy)
}

@MainActor
@Test func invalidURLNeverCallsTheServer() async {
  var calls = 0
  let model = AddMcpServerModel { _ in calls += 1; return nil }
  model.url = "not a url"
  #expect(await model.submit() == false)
  #expect(calls == 0 && model.error != nil)
}

@MainActor
@Test func successClearsHeaderSecrets() async {
  var sent: CreateMcpServerInput?
  let model = AddMcpServerModel { sent = $0; return nil }
  model.url = "https://a.example/mcp"
  model.headers = [McpHeaderRow(name: "X-Key", value: "v")]
  #expect(await model.submit())
  #expect(sent?.headers == ["X-Key": "v"])
  #expect(model.headers.isEmpty)
}
