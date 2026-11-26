import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesComputerStatusWhileTheAgentDrives() throws {
  let status = try decode(ComputerStatus.self, "computer-status-running-bot")
  #expect(status.state == .running)
  #expect(status.mode == .team)
  #expect(status.controlHolder == .bot)
  #expect(status.busyBotName == "Finance agent")
  #expect(status.userHasControl(of: "bot-placeholder") == false)
}

@Test
func decodesComputerStatusWhileTheUserDrives() throws {
  let status = try decode(ComputerStatus.self, "computer-status-user-control")
  #expect(status.userHasControl(of: "bot-placeholder"))
  #expect(status.userHasControl(of: "other") == false)
}

@Test
func computerStatusToleratesUnknownValuesAndMissingFields() throws {
  let json = #"{"json":{"botId":"b","state":"hibernating","controlHolder":"robot"}}"#
  let status = try JSONDecoder().decode(RPCEnvelope<ComputerStatus>.self, from: Data(json.utf8)).json
  #expect(status.state == .unknown("hibernating"))
  #expect(status.controlHolder == .unknown("robot"))
  #expect(status.screenWidth == nil)
}

@Test
func decodesScreenTakeoverAndAck() throws {
  #expect(try decode(ComputerScreenResponse.self, "computer-screen-url").url?.hasPrefix("fake://") == true)
  #expect(try decode(ComputerTakeover.self, "computer-takeover").leaseId == "lease-placeholder")
  #expect(try decode(ComputerAck.self, "computer-ack").ok)
  let none = #"{"json":{"url":null}}"#
  #expect(try JSONDecoder().decode(RPCEnvelope<ComputerScreenResponse>.self, from: Data(none.utf8)).json.url == nil)
}

@Test
func encodesReleaseInput() throws {
  let data = try JSONEncoder().encode(ComputerReleaseInput(botId: "b", reason: .skipped))
  #expect(String(bytes: data, encoding: .utf8)?.contains(#""reason":"skipped""#) == true)
}
