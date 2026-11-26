import Foundation
import Testing

@testable import RakazoAPI

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
  try JSONDecoder().decode(RPCEnvelope<T>.self, from: loadFixture(named: name)).json
}

@Test
func decodesVoiceStatusWithNoProvider() throws {
  let status = try decode(VoiceStatus.self, "voice-status")
  #expect(!status.configured && !status.ready && !status.transcribe)
  #expect(status.provider == nil && status.transcriptionProvider == nil)
  #expect(status.voiceId.isEmpty)
}

@Test
func decodesVoiceCatalogCapabilities() throws {
  let catalog = try decode([VoiceProvider].self, "voice-catalog")
  #expect(catalog.count == 4)
  #expect(catalog.first { $0.id == "cartesia" }?.transcribe == false)
  #expect(catalog.first { $0.id == "openai" }?.transcribe == true)
}

@Test
func decodesCredentialsAndVoiceList() throws {
  let credentials = try decode([VoiceCredential].self, "voice-credentials")
  #expect(credentials.first?.provider == "openai" && credentials.first?.hasKey == true)
  let voices = try decode([VoiceOption].self, "voice-voices")
  #expect(voices.map(\.id) == ["voice-a", "voice-b"])
  #expect(voices.last?.description == nil)
}

@Test
func decodesTheServerMessageForARejectedKey() throws {
  let error = try JSONDecoder().decode(
    RPCErrorEnvelope.self, from: loadFixture(named: "voice-error-rejected-key"))
  #expect(error.json.status == 400)
  #expect(error.json.message.hasPrefix("OpenAI rejected"))
}

@Test
func decodesTranscriptionConsent() throws {
  #expect(try decode(VoiceStatus.self, "voice-status").transcriptionConsented == false)
  let older = Data(#"{"json":{"configured":true,"ready":true,"transcribe":true}}"#.utf8)
  let status = try JSONDecoder().decode(RPCEnvelope<VoiceStatus>.self, from: older).json
  #expect(status.transcriptionConsented == nil)
}
