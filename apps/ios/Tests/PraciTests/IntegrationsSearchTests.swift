import Foundation
import RakazoAPI
import Testing

@testable import Praci

private func snapshot() throws -> IntegrationsSnapshot {
  let decoder = JSONDecoder()
  let connections = try decoder.decode(
    [Connection].self,
    from: Data(
      """
      [{"id":"c1","provider":"gmail","displayName":"Work Mail","account":"ana@example.com","status":"connected"},
       {"id":"c2","provider":"slack","displayName":"Café Team","status":"connected"}]
      """.utf8))
  let catalog = try decoder.decode(
    [ConnectorEntry].self,
    from: Data(
      """
      [{"connectorId":"k","slug":"gmail","name":"Gmail","connected":true,"description":"Email"},
       {"connectorId":"k","slug":"notion","name":"Notion Calendar","description":"Plan your day"},
       {"connectorId":"k","slug":"linear","name":"Linear","description":"Issue tracking"}]
      """.utf8))
  return IntegrationsSnapshot(
    connections: connections, catalog: catalog, servers: [McpServer(id: "s1", name: "Docs Server")])
}

private func names(_ snapshot: IntegrationsSnapshot) -> [String] {
  snapshot.connections.map(\.displayName) + snapshot.servers.map(\.name)
}

@Test func emptyOrBlankQueryKeepsEverything() throws {
  let all = try snapshot()
  #expect(names(all.matching("")) == names(all))
  #expect(names(all.matching("  \n ")) == names(all))
}

@Test func matchesIgnoreCaseAndDiacritics() throws {
  let all = try snapshot()
  #expect(names(all.matching("CAFE")) == ["Café Team"])
  #expect(names(all.matching("café")) == ["Café Team"])
}

@Test func matchesTrimmedPartialWordsAnywhere() throws {
  let all = try snapshot()
  #expect(names(all.matching("  wor ")) == ["Work Mail"])
  #expect(names(all.matching("mail work")) == ["Work Mail"])
}

@Test func searchesConnectedAndServers() throws {
  let all = try snapshot()
  #expect(names(all.matching("work")) == ["Work Mail"])
  #expect(names(all.matching("example.com")) == ["Work Mail"])
  #expect(names(all.matching("docs")) == ["Docs Server"])
}

@Test func connectedRowMatchesItsAppName() throws {
  #expect(names(try snapshot().matching("gmail")) == ["Work Mail"])
}

@Test func noMatchIsEmpty() throws {
  #expect(try snapshot().matching("zzz").isEmpty)
  #expect(try !snapshot().matching("wor").isEmpty)
}
