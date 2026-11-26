import Foundation
import Testing

@testable import RakazoAPI

@Test
func decodesBotDetail() throws {
  let bot = try JSONDecoder().decode(
    RPCEnvelope<BotDetail>.self, from: loadFixture(named: "manage-bot-get")
  ).json
  #expect(bot.id == "bot-placeholder")
  #expect(bot.title == "Tester")
  #expect(bot.sectionId == "section-placeholder")
  #expect(bot.autoSpeak == true)
  #expect(bot.archivedAt == nil)
}

@Test
func createdGroupDecodesAsGroupSummary() throws {
  let group = try JSONDecoder().decode(
    RPCEnvelope<GroupSummary>.self, from: loadFixture(named: "manage-group-create")
  ).json
  #expect(group.id == "group-placeholder")
  #expect(group.members.map(\.botId) == ["bot-1", "bot-2"])
  #expect(group.threadId == "thread-placeholder")
}
