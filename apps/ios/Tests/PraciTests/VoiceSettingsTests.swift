import Foundation
import RakazoAPI
import Testing

@testable import Praci

private func snapshot(_ statusJSON: String, credentials: String = "[]") throws -> VoiceSnapshot {
  let decoder = JSONDecoder()
  return VoiceSnapshot(
    status: try decoder.decode(VoiceStatus.self, from: Data(statusJSON.utf8)),
    providers: [],
    credentials: try decoder.decode([VoiceCredential].self, from: Data(credentials.utf8)))
}

// swiftlint:disable line_length
private let bare = #"{"configured":false,"ready":false,"transcribe":false,"provider":null,"voiceId":"","transcriptionProvider":null,"transcriptionReady":false}"#
private let ready = #"{"configured":true,"ready":true,"transcribe":true,"provider":"openai","voiceId":"a","transcriptionProvider":null,"transcriptionReady":false}"#
private let lost = #"{"configured":true,"ready":false,"transcribe":false,"provider":"openai","voiceId":"a","transcriptionProvider":null,"transcriptionReady":false}"#
// swiftlint:enable line_length

@Test
func hostedSummaryFollowsTheServerStatus() throws {
  #expect(try snapshot(bare).hostedSummary == "Not set up")
  #expect(try snapshot(ready).hostedSummary == "Connected")
  #expect(try snapshot(lost).hostedSummary == "Not connected")
}
