import Foundation
import RakazoAPI
import Testing

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

private let everyone = ["inbox", "chat", "b", "c", "d"]
private func agent(_ id: String, _ name: String, key: String? = nil) -> AccessAgent {
  AccessAgent(id: id, name: name, spawnKey: key)
}
private let roster = [
  agent("inbox", "Inbox agent", key: "inbox-agent:u1"),
  agent("chat", "Re: Lunch", key: "mail-thread:c1:t1"),
  agent("b", "Beta"), agent("c", "alpha"), agent("d", "Delta"),
]

@Test
func decodesAccountAddressAndSharing() throws {
  let list = try decode([Connection].self, "connections-list")
  #expect(list[0].account == "founder@example.com" && list[0].agentBotId == "bot-inbox")
  #expect(list[1].account == nil && list[1].agentBotId == nil && !list[1].writesEnabled)
  let access = try decode(ConnectionAccess.self, "connections-access")
  #expect(!access.allAgents && access.botIds == ["bot-inbox", "bot-b"] && access.agentShared)
  #expect(access.writeBotIds == ["bot-b"])
  let effective = try decode([String: EffectiveAccess].self, "connections-effective-access")
  #expect(effective["conn-second"]?.shared == "all" && effective["conn-placeholder"]?.botIds.count == 2)
}

@Test
func decodesAgentsServersAndAssignments() throws {
  let agents = try decode([AccessAgent].self, "bots-list-access")
  #expect(agents[0].isInboxAgent && agents[1].isMailChat && !agents[2].isMailChat)
  #expect(agents[3].archivedAt == nil && agents[3].restricted && agents[4].restricted && !agents[2].restricted)
  let servers = try decode([McpServer].self, "mcp-servers-list")
  #expect(servers[0].agentBotId == "bot-b" && servers[0].agentExclusive)
  #expect(servers[1].agentBotId == nil && !servers[1].enabled && !servers[1].agentExclusive)
  let all = try decode([McpAssignment].self, "mcp-assignments-all")
  #expect(all[0].botId == "bot-c" && !all[0].allowAllTools && all[0].allowedTools == ["read"])
}

@Test
func namesAreOneToSixtyCharactersAfterTrimming() {
  #expect(AccessLogic.validName("  Work  ") == "Work")
  #expect(AccessLogic.validName("   ") == nil)
  #expect(AccessLogic.validName("") == nil)
  #expect(AccessLogic.validName(String(repeating: "a", count: 60)) != nil)
  #expect(AccessLogic.validName(String(repeating: "a", count: 61)) == nil)
  #expect(AccessLogic.validName(String(repeating: "a", count: 61), limit: 120) != nil)
}

@Test
func allAndNoneActOnTheOtherAgentsOnly() {
  let keep = AccessLogic.keptIDs(agents: roster, ownerID: "inbox")
  #expect(keep == ["inbox", "chat"])
  let none = AccessLogic.setOthers(
    AccessGrant(allAgents: true, botIds: []), allBotIDs: everyone, keep: keep, on: false)
  #expect(!none.allAgents && Set(none.botIds) == ["inbox", "chat"])
  let all = AccessLogic.setOthers(none, allBotIDs: everyone, keep: keep, on: true)
  #expect(all == AccessGrant(allAgents: true, botIds: []))
  // A kept agent that was off stays off.
  let owned = AccessLogic.setOthers(
    AccessGrant(allAgents: false, botIds: ["b"]), allBotIDs: everyone, keep: ["inbox"], on: false)
  #expect(owned.botIds.isEmpty && !owned.allAgents)
  // None stays an explicit list even when the kept agents are the whole roster.
  let solo = AccessLogic.setOthers(
    AccessGrant(allAgents: true, botIds: []), allBotIDs: ["inbox"], keep: ["inbox"], on: false)
  #expect(!solo.allAgents && solo.botIds == ["inbox"])
  // Only a mail account keeps the email chats; other owners keep themselves.
  #expect(AccessLogic.keptIDs(agents: roster, ownerID: "b") == ["b"])
  #expect(AccessLogic.keptIDs(agents: roster, ownerID: nil).isEmpty)
}

@Test
func listPinsTheMailGroupAndSortsOnFirstThenByName() {
  let layout = AccessLogic.layout(agents: roster, ownerID: "inbox", on: ["d", "inbox"])
  #expect(layout.mail && layout.owner?.id == "inbox" && layout.chats.map(\.id) == ["chat"])
  #expect(layout.others.map(\.id) == ["d", "c", "b"])
}

@Test
func listSearchesAndFiltersTheOthers() {
  let on: Set = ["d", "c"]
  func ids(_ query: String, _ filter: AccessLogic.Filter) -> [String] {
    AccessLogic.layout(agents: roster, ownerID: nil, on: on, query: query, filter: filter)
      .others.map(\.id)
  }
  #expect(ids("", .on) == ["c", "d"])
  #expect(ids("", .off) == ["b", "inbox"])
  #expect(ids(" BET ", .all) == ["b"])
  #expect(ids("zzz", .all).isEmpty)
  #expect(AccessLogic.layout(agents: roster, ownerID: nil, on: on).chats.count == 1)
}

private func connection(_ id: String, owner: String? = nil, writes: Bool = false) throws -> Connection {
  let json = """
    {"id":"\(id)","connectorId":"c","provider":"GMAIL","displayName":"Mail \(id)","account":"\(id)@example.com","status":"connected","error":null,"writesEnabled":\(writes),"agentBotId":\(owner.map { "\"\($0)\"" } ?? "null")}
    """
  return try JSONDecoder().decode(Connection.self, from: Data(json.utf8))
}

private func rows(
  _ agent: AccessAgent, _ connections: [Connection], servers: [McpServer] = [],
  accesses: [String: ConnectionAccess] = [:], effective: [String: [String]] = [:],
  assigned: Set<String> = []
) -> [AccessLogic.Row] {
  AccessLogic.rows(
    for: agent, connections: connections, servers: servers,
    effective: effective.mapValues { EffectiveAccess(shared: "some", botIds: $0) },
    accesses: accesses, assigned: assigned)
}

@Test
func anAgentSeesItsAccountsAndServers() throws {
  let list = try decode([Connection].self, "connections-list")
  let servers = try decode([McpServer].self, "mcp-servers-list")
  let beta = AccessAgent(id: "bot-b", name: "Beta")
  let access = ConnectionAccess(allAgents: false, botIds: ["bot-b"], agentShared: true)
  let result = rows(
    beta, list, servers: servers, accesses: ["conn-placeholder": access],
    effective: ["conn-placeholder": ["bot-b"]])
  #expect(result.map(\.name) == ["Example MCP", "Founder mail", "Support mail"])
  #expect(result[0].on && result[0].locked)  // Beta is that server's own agent
  #expect(result[1].on && !result[1].locked && result[1].address == "founder@example.com")
  #expect(servers.filter(\.enabled).count == 1)  // the disabled server is not listed
}

@Test
func anAccountNotSharedWithOtherAgentsIsLockedAndFollowsTheServer() throws {
  let list = [try connection("a", owner: "owner")]
  let hidden = ConnectionAccess(allAgents: true, botIds: [], agentShared: false)
  let row = rows(AccessAgent(id: "x", name: "X"), list, accesses: ["a": hidden])[0]
  #expect(row.locked && !row.on)  // the stored "all agents" does not count while private
  let own = rows(AccessAgent(id: "owner", name: "Owner"), list, accesses: ["a": hidden])[0]
  #expect(own.locked && own.on)
}

@Test
func emailChatsFollowTheInboxAgentOnEveryAccount() throws {
  let chat = AccessAgent(id: "chat", name: "Re: Lunch", spawnKey: "mail-thread:a:t")
  let plain = [try connection("a"), try connection("b", owner: "inbox", writes: true)]
  let grant = ConnectionAccess(allAgents: true, botIds: [], agentShared: true)
  let result = rows(
    chat, plain, accesses: ["a": grant, "b": grant], effective: ["a": [], "b": ["chat"]])
  #expect(result.map(\.locked) == [true, true])
  #expect(result.map(\.on) == [false, true])  // the real access, not the stored grant
  #expect(result.map(\.write) == [nil, nil])  // chats get no "Allow changes"
}

@Test
func allAgentsDoesNotReachARestrictedAgent() throws {
  let list = [try connection("a")]
  let everyone = ConnectionAccess(allAgents: true, botIds: [], agentShared: true)
  let listed = ConnectionAccess(allAgents: false, botIds: ["x"], agentShared: true)
  let firewalled = AccessAgent(id: "x", name: "X", restricted: true)
  #expect(!rows(firewalled, list, accesses: ["a": everyone])[0].on)
  #expect(rows(AccessAgent(id: "x", name: "X"), list, accesses: ["a": everyone])[0].on)
  #expect(rows(firewalled, list, accesses: ["a": listed], effective: ["a": ["x"]])[0].on)
}

@Test
func aSavedGrantThatIsNotEffectiveSaysSo() throws {
  let list = [try connection("a")]
  let grant = ConnectionAccess(allAgents: false, botIds: ["x"], agentShared: true)
  let saved = rows(AccessAgent(id: "x", name: "X"), list, accesses: ["a": grant])[0]
  #expect(saved.on && saved.limited && !saved.locked)  // can still be switched off
  let working = rows(
    AccessAgent(id: "x", name: "X"), list, accesses: ["a": grant], effective: ["a": ["x"]])[0]
  #expect(working.on && !working.limited)
}

@Test
func anExclusiveServerIsOffAndLockedForOtherAgents() {
  let server = McpServer(id: "s", name: "S", agentBotId: "owner", agentExclusive: true)
  let other = rows(AccessAgent(id: "x", name: "X"), [], servers: [server], assigned: ["s"])[0]
  #expect(!other.on && other.locked)
  let own = rows(AccessAgent(id: "owner", name: "O"), [], servers: [server])[0]
  #expect(own.on && own.locked)
  let open = McpServer(id: "s", name: "S", agentBotId: "owner", agentExclusive: false)
  let shared = rows(AccessAgent(id: "x", name: "X"), [], servers: [open], assigned: ["s"])[0]
  #expect(shared.on && !shared.locked)
}

@Test
func allowChangesFollowsTheAccountsOwnSwitch() throws {
  let off = [try connection("a", owner: "owner", writes: false)]
  let on = [try connection("a", owner: "owner", writes: true)]
  let grant = ConnectionAccess(
    allAgents: false, botIds: ["x"], agentShared: true, writeBotIds: ["x"])
  let x = AccessAgent(id: "x", name: "X")
  let granted = try #require(rows(x, on, accesses: ["a": grant])[0].write)
  #expect(granted.on && !granted.fixed && granted.enabled)
  let gated = try #require(rows(x, off, accesses: ["a": grant])[0].write)
  #expect(gated.on && !gated.enabled)  // the account's own switch gates it
  let owner = try #require(rows(AccessAgent(id: "owner", name: "O"), on, accesses: ["a": grant])[0].write)
  #expect(owner.on && owner.fixed)  // shows the account's switch, not editable
  let bare = try connection("b")
  #expect(rows(x, [bare])[0].write == nil)  // no agent, no switch
}

@Test
func someServersHideSharingOrChanges() {
  func server(_ endpoint: String) -> McpServer { McpServer(id: "s", name: "S", endpoint: endpoint) }
  #expect(server("https://mcp.zernio.com/mcp").hidesSharing && server("https://mcp.zernio.com/mcp").hidesWrites)
  #expect(server("rakazo+brex://cards").hidesSharing && !server("rakazo+brex://cards").hidesWrites)
  #expect(server("https://mcp.granola.ai/mcp").hidesWrites && !server("https://mcp.granola.ai/mcp").hidesSharing)
  #expect(server("https://mcp.devin.ai/mcp").hidesWrites)
  #expect(!server("https://mcp.example.com/").hidesSharing && !McpServer(id: "s", name: "S").hidesWrites)
}
