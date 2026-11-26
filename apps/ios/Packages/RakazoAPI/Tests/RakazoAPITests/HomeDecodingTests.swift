import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesBootstrap() throws {
  let b = try decode(Bootstrap.self, "home-bootstrap")
  #expect(b.me.spaceId == "space-placeholder")
  #expect(b.me.needsModel == false)
  #expect(b.me.ticketBoardEnabled == true)
  #expect(b.bots.count == 5)
  #expect(b.bots[1].status == .running)
  #expect(b.bots[2].status == .waitingInput)
  #expect(b.bots[4].status == .unknown("someFutureStatus"))
  #expect(b.groups.first?.members.count == 2)
  #expect(b.botSections.first?.collapsed == true)
  #expect(b.spaces.map(\.name) == ["Placeholder Space", "Second space"])
  #expect(b.spaces[0].canDelete == false)
}

@Test
func rosterRowsCarryTheStoredAvatarValue() throws {
  let b = try decode(Bootstrap.self, "home-bootstrap")
  let roster = Roster(bots: b.bots, groups: b.groups, sections: b.botSections)
  let rows = roster.pinned + roster.agents + roster.sections.flatMap(\.rows)
  #expect(rows.compactMap(\.color).contains("#3EC5A8"))
  #expect(b.bots.first?.color == "#3EC5A8")
}

@Test
func decodesNoModelMe() throws {
  let me = try decode(Me.self, "home-me-no-model")
  #expect(me.needsModel)
  #expect(me.hiddenPages == ["legal"])
  #expect(me.ticketBoardEnabled == nil)
}

@Test
func decodesSpaceAndInboxResponses() throws {
  #expect(try decode(SpacesList.self, "home-spaces-list").spaces.count == 2)
  #expect(try decode(SpaceSummary.self, "home-spaces-create").name == "New space")
  #expect(try decode(RenamedSpace.self, "home-spaces-rename").name == "Renamed space")
  #expect(try decode(RemovedSpace.self, "home-spaces-remove").activeSpaceId == "space-placeholder")
  #expect(try decode(UnreadCount.self, "home-unread-count").count == 14)
}

@Test
func rosterOrdersPinnedThenRecentAndSplitsSections() throws {
  let b = try decode(Bootstrap.self, "home-bootstrap")
  let roster = Roster(bots: b.bots, groups: b.groups, sections: b.botSections)
  #expect(roster.pinned.map(\.name) == ["Chief"])
  // Newest first; Chief is pinned and Carta agent is in the section.
  #expect(roster.agents.map(\.name) == ["Leadership sync", "Inbox agent", "Legal agent", "Finance agent"])
  #expect(roster.sections.first?.rows.map(\.name) == ["Carta agent"])
}

@Test
func collapsedAgentsKeepFourRecentPlusUnread() {
  func row(_ i: Int, unread: Bool) -> BotSummary {
    let json = #"{"id":"b\#(i)","name":"A\#(i)","unread":\#(unread),"updatedAt":"2026-01-\#(String(format: "%02d", 30 - i))"}"#
    return try! JSONDecoder().decode(BotSummary.self, from: Data(json.utf8))
  }
  let bots = (0..<7).map { row($0, unread: $0 == 6) }
  let roster = Roster(bots: bots, groups: [], sections: [])
  let collapsed = roster.visibleAgents(expanded: false)
  #expect(collapsed.rows.map(\.name) == ["A0", "A1", "A2", "A3", "A6"])
  #expect(collapsed.hiddenCount == 2)
  #expect(roster.visibleAgents(expanded: true).hiddenCount == 0)
  #expect(Roster(bots: Array(bots[0..<4]), groups: [], sections: []).visibleAgents(expanded: false).hiddenCount == 0)
}
