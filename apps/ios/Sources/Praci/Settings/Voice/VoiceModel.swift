import AVFoundation
import Foundation
import Observation
import RakazoAPI

/// On-device choices. They stay on this phone and are not part of the server's voice settings.
struct VoicePreferences {
  static let deviceVoiceKey = "voice.useDeviceVoice"
  static let callSoundsKey = "voice.callSounds"
  static let waitSoundKey = "voice.waitSound"
}

struct VoiceSnapshot: Sendable {
  var status: VoiceStatus
  var providers: [VoiceProvider]
  var credentials: [VoiceCredential]

  func credential(for provider: String) -> VoiceCredential? {
    credentials.first { $0.provider == provider }
  }

  /// The provider the hosted voice screen shows: the active one, else the first in the catalog.
  var activeProviderID: String? { status.provider ?? providers.first?.id }

  /// The line under "Hosted voice" on the main screen.
  var hostedSummary: String {
    if status.ready { return "Connected" }
    if status.configured { return "Not connected" }
    return credentials.isEmpty ? "Not set up" : "Not connected"
  }
}

struct VoiceConnectInput: Encodable, Sendable {
  var provider: String
  var apiKey: String
}

struct VoiceSetVoiceInput: Encodable, Sendable {
  var voiceId: String
  var provider: String
}

struct VoiceProviderInput: Encodable, Sendable { var provider: String }

struct VoiceSpeechModelInput: Encodable, Sendable {
  var provider: String
  var speechModel: String
}

struct VoiceVoicesInput: Encodable, Sendable { var provider: String }

@MainActor
@Observable
final class VoiceModel {
  var state: Loadable<VoiceSnapshot> = .idle
  var voices: [VoiceOption] = []
  var busy = false
  var error: String?

  func load(_ app: AppModel) async {
    if state.value == nil { state = .loading }
    do {
      async let status: VoiceStatus = app.call("voice/status")
      async let catalog: [VoiceProvider] = app.call("voice/catalog")
      async let credentials: [VoiceCredential] = app.call("voice/credentials")
      let snapshot = try await VoiceSnapshot(status: status, providers: catalog, credentials: credentials)
      state = .loaded(snapshot)
    } catch {
      state = .failed(settingsErrorText(error))
    }
  }

  func loadVoices(_ app: AppModel, provider: String) async {
    do {
      voices = try await app.call("voice/voices", input: VoiceVoicesInput(provider: provider))
    } catch {
      voices = []
      self.error = settingsErrorText(error)
    }
  }

  /// Runs one change, shows the server's message when it fails, then reloads. Returns whether it worked.
  @discardableResult
  private func change(_ app: AppModel, _ work: () async throws -> Void) async -> Bool {
    busy = true
    error = nil
    defer { busy = false }
    do {
      try await work()
      await load(app)
      return true
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }

  /// The key goes straight to the server and is not kept.
  func connect(_ app: AppModel, provider: String, apiKey: String) async -> Bool {
    await change(app) {
      let _: VoiceCredential = try await app.call(
        "voice/connect", input: VoiceConnectInput(provider: provider, apiKey: apiKey))
    }
  }

  func disconnect(_ app: AppModel, provider: String) async {
    await change(app) {
      let _: OKResult = try await app.call("voice/disconnect", input: VoiceProviderInput(provider: provider))
    }
  }

  func setVoice(_ app: AppModel, provider: String, voiceID: String) async {
    await change(app) {
      let _: VoiceStatus = try await app.call(
        "voice/setVoice", input: VoiceSetVoiceInput(voiceId: voiceID, provider: provider))
    }
  }

  func setSpeechModel(_ app: AppModel, provider: String, model: String) async {
    await change(app) {
      let _: VoiceCredential = try await app.call(
        "voice/setSpeechModel", input: VoiceSpeechModelInput(provider: provider, speechModel: model))
    }
  }

  func setTranscription(_ app: AppModel, provider: String, apiKey: String) async -> Bool {
    await change(app) {
      let _: TranscriptionResult = try await app.call(
        "voice/setTranscription", input: VoiceConnectInput(provider: provider, apiKey: apiKey))
    }
  }

  func clearTranscription(_ app: AppModel) async {
    await change(app) {
      let _: OKResult = try await app.call("voice/clearTranscription")
    }
  }
}

struct TranscriptionResult: Decodable, Sendable { let provider: String }

/// Speaks the sample with the phone's built-in voice.
@MainActor
final class DeviceSpeaker {
  private let synthesizer = AVSpeechSynthesizer()

  func speak(_ text: String) {
    synthesizer.stopSpeaking(at: .immediate)
    synthesizer.speak(AVSpeechUtterance(string: text))
  }
}
