import Foundation
import Testing

@testable import Praci

@MainActor
@Test
func groupNeedsANameAndTwoToSixMembers() {
  #expect(!ManageClient.canCreateGroup(name: "Team", members: 1))
  #expect(ManageClient.canCreateGroup(name: "Team", members: 2))
  #expect(ManageClient.canCreateGroup(name: " Team ", members: 6))
  #expect(!ManageClient.canCreateGroup(name: "Team", members: 7))
  #expect(!ManageClient.canCreateGroup(name: "   ", members: 3))
}

@Test
func updateSendsNullOnlyWhenClearingTheSection() throws {
  var input = BotUpdateInput(botId: "b")
  input.pinned = true
  let withoutSection = try String(bytes: JSONEncoder().encode(input), encoding: .utf8)
  #expect(withoutSection?.contains("sectionId") == false)
  input.clearSection = true
  let clearing = try String(bytes: JSONEncoder().encode(input), encoding: .utf8)
  #expect(clearing?.contains(#""sectionId":null"#) == true)
}

@Test
func updateSendsFirewallOnlyWhenTheToggleChanged() throws {
  var input = BotUpdateInput(botId: "b")
  input.name = "Renamed"
  let withoutFirewall = try String(bytes: JSONEncoder().encode(input), encoding: .utf8)
  #expect(withoutFirewall?.contains("firewall") == false)
  input.firewall = false
  let turningOff = try String(bytes: JSONEncoder().encode(input), encoding: .utf8)
  #expect(turningOff?.contains(#""firewall":false"#) == true)
}

@MainActor
@Test
func renameIgnoresBlankAndUnchangedNames() {
  #expect(ManageClient.renamed("   ", from: "Ada") == nil)
  #expect(ManageClient.renamed(" Ada ", from: "Ada") == nil)
  #expect(ManageClient.renamed("  Grace ", from: "Ada") == "Grace")
}

@MainActor
@Test
func archiveMessageHasAFallbackForBlankNames() {
  #expect(ManageClient.archiveMessage("Ada") == "Archived Ada")
  #expect(ManageClient.archiveMessage("  ") == "Archived")
}
