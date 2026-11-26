import Foundation
import Testing

@testable import Praci

private func route(_ string: String) -> Route? { Route(url: URL(string: string)!) }

@Test
func openURLsMapToRoutes() {
  #expect(route("rakazo://open/bot/b1") == .thread(.bot("b1")))
  #expect(route("rakazo://open/group/g1") == .thread(.group("g1")))
  #expect(route("rakazo://open/inbox") == .inbox)
  #expect(route("rakazo://open/inbox/m1") == .inboxMessage(messageID: "m1"))
  #expect(route("rakazo://open/bot/b1/computer") == .computer(botID: "b1"))
  #expect(route("rakazo://open/bot/b1/artifacts") == .artifacts(botID: "b1"))
  #expect(route("rakazo://open/bot/b1/page") == .agentPage(botID: "b1"))
  #expect(route("rakazo://open/bot/b1/routines") == .routines(botID: "b1"))
  #expect(route("rakazo://open/bot/b1/settings") == .botSettings(botID: "b1"))
  #expect(route("rakazo://open/group/g1/settings") == .groupSettings(groupID: "g1"))
  #expect(route("rakazo://open/artifact/a1") == .artifact(artifactID: "a1"))
  #expect(route("rakazo://open/routine/r1") == .routine(routineID: "r1"))
  #expect(route("rakazo://open/finance") == .finance)
  #expect(route("rakazo://open/calendar") == .calendar)
  #expect(route("rakazo://open/legal") == .legal)
  #expect(route("rakazo://open/cap-table") == .capTable)
  #expect(route("rakazo://open/data-room") == .dataRoom)
  #expect(route("rakazo://open/scanner") == .scanner)
  #expect(route("rakazo://open/meetings") == .meetings)
  #expect(route("rakazo://open/meeting/m1") == .meeting(id: "m1"))
}

@Test
func otherURLsAreIgnored() {
  #expect(route("rakazo://sign-in?attempt=1") == nil)
  #expect(route("rakazo://other/inbox") == nil)
  #expect(route("https://open/inbox") == nil)
  #expect(route("rakazo://open") == nil)
  #expect(route("rakazo://open/unknown") == nil)
  #expect(route("rakazo://open/bot") == nil)
  #expect(route("rakazo://open/bot/b1/unknown") == nil)
  #expect(route("rakazo://open/inbox/m1/extra") == nil)
}

@Test
func appPathsFromAgentLinksMapToRoutes() {
  #expect(Route(appPath: "/app/pages/b1/p1") == .agentPage(botID: "b1", pageID: "p1"))
  #expect(Route(appPath: "/app/artifacts/a1") == .artifact(artifactID: "a1"))
  #expect(Route(appPath: "/app/data-room?item=i1") == .dataRoomItem(itemID: "i1"))
  #expect(Route(appPath: "/app/data-room") == .dataRoom)
  #expect(Route(appPath: "/app/scanner") == .scanner)
  #expect(Route(appPath: "/app/finance") == nil)
  #expect(Route(appPath: "/app/pages/b1") == nil)
  #expect(Route(appPath: "//evil.test/app/pages/b/p") == nil)
  #expect(Route(appPath: "https://evil.test/app/pages/b/p") == nil)
}
