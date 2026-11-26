import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesNotificationPreferencesAndTreatsMissingChannelsAsOn() throws {
  let prefs = try decode(NotificationPreferences.self, "settings-notification-preferences")
  #expect(prefs.finish && !prefs.help && prefs.takeover)
  #expect(!prefs.push)
  #expect(prefs.imessage)
  #expect(prefs.hasPhone && !prefs.hasImessage)
}

@Test
func encodesOnlyTheChangedNotificationFields() throws {
  let data = try JSONEncoder().encode(
    RPCRequest(json: NotificationPreferencesUpdate(channels: .init(push: false))))
  #expect(String(bytes: data, encoding: .utf8) == #"{"json":{"channels":{"push":false}}}"#)
}

@Test
func decodesUsageIncludingNullCounts() throws {
  let usage = try decode(UsageSummary.self, "settings-usage-summary")
  #expect(usage.inputTokens == 39 && usage.outputTokens == 3038 && usage.totalTokens == 129_449)
  #expect(usage.runs == 9)
  let empty = try decode(UsageSummary.self, "settings-usage-empty")
  #expect(empty.inputTokens == nil && empty.runs == 0)
}

@Test
func archivedListsDecodeAsRosterSummaries() throws {
  let bots = try decode([BotSummary].self, "settings-archived-bots")
  #expect(bots.first?.archivedAt == "2026-10-03T03:26:53.690Z")
  let groups = try decode([GroupSummary].self, "settings-archived-groups")
  #expect(groups.first?.name == "Planning group")
  #expect(try decode(OKResult.self, "settings-restore").ok)
}
