import AVFoundation
import Foundation
import Observation
import RakazoCore

/// Owns one phone call with an agent: wires the core `CallSession` to the device (speech
/// recognition, audio playback) and the server (`VoiceServer`).
@MainActor
@Observable
final class CallCoordinator {
  private(set) var session: CallSession?
  private(set) var starting = false
  /// Why the call could not start (consent declined, for example).
  var failure: String?

  @ObservationIgnored private let player = SpeechPlayer()
  @ObservationIgnored private var dictation: DictationSession?
  /// Bumped by `end()` so a call still waiting on consent or a permission prompt does not start.
  @ObservationIgnored private var epoch = 0

  var isActive: Bool { session?.state != nil }

  func begin(app: AppModel, botID: String, name: String, color: String?) async {
    guard !starting, !isActive, !VoiceAudio.meetingActive else { return }
    starting = true
    failure = nil
    let started = epoch
    defer { starting = false }
    let server = VoiceServer(app: app)
    let status = (try? await server.status()) ?? CallVoiceStatus()
    let hosted = status.canSpeak && !VoiceServer.useDeviceVoice
    do {
      try await app.consent.ensure(procedure: "threads/send", app: app)
      if hosted || status.canTranscribe {
        try await app.consent.ensure(procedure: "voice/prepare", app: app)
      }
    } catch {
      failure = error.localizedDescription
      return
    }
    guard epoch == started else { return }
    let call = CallSession(deps: deps(server: server, hosted: hosted, botID: botID))
    session = call
    call.start(
      botID: botID, botName: name, botColor: color ?? "", transcribe: status.canTranscribe)
  }

  func end() {
    epoch += 1
    session?.end()
    dictation?.stop()
    dictation = nil
    player.stop()
    VoiceAudio.deactivate()
    session = nil
  }

  // MARK: Wiring

  private func deps(server: VoiceServer, hosted: Bool, botID: String) -> CallDeps {
    CallDeps(
      dictate: { [weak self] handlers in await self?.dictate(handlers) ?? false },
      stopDictation: { [weak self] in
        self?.dictation?.stop()
        self?.dictation = nil
      },
      record: { try await Self.recordClip() },
      transcribe: { try await server.transcribe($0) },
      send: { try await server.send(botID: $0, text: $1, nonce: $2) },
      endCall: { try await server.endCall(botID: $0, callID: $1) },
      speak: { [weak self] bot, text in try await self?.speak(text, botID: bot, hosted: hosted, server: server) },
      stopSpeaking: { [weak self] in self?.player.stop() },
      watch: { bot, call, onReply, onEnded in
        let task = server.watch(
          botID: bot, callID: call,
          onReply: { onReply($0.messageID, $0.text, $0.runID) }, onEnded: onEnded)
        return { task.cancel() }
      })
  }

  private func dictate(_ handlers: DictationHandlers) async -> Bool {
    // Without on-device recognition the call records clips and sends them to hosted transcription
    // (which asks for consent itself) instead; nothing is captured for Apple's servers.
    guard VoiceAudio.onDeviceSupported() else { return false }
    let started = epoch
    guard await VoiceAudio.requestMicrophone(), await VoiceAudio.requestSpeech() else { return false }
    guard epoch == started else { return false }
    dictation?.stop()
    let next = DictationSession(
      recognizer: DeviceSpeechRecognizer(), language: VoiceAudio.language,
      onInterim: handlers.onInterim, onFinal: handlers.onFinal)
    dictation = next
    next.begin()
    return true
  }

  private func speak(_ text: String, botID: String, hosted: Bool, server: VoiceServer) async throws {
    player.begin()
    if hosted {
      let prepared = try await server.prepare(text: text, botID: botID)
      if prepared.ready {
        for piece in prepared.utterances where !player.isStopped {
          try await player.play(try await server.speakClip(piece, botID: botID))
        }
        return
      }
    }
    await player.speakOnDevice(text)
  }

  /// Fallback when the device cannot listen: record until the speaker goes quiet.
  private static func recordClip() async throws -> CallClip? {
    guard await VoiceAudio.requestMicrophone() else { throw VoicePermissionError(VoiceAudio.micDenied) }
    try VoiceAudio.activate()
    let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).m4a")
    let recorder = try AVAudioRecorder(
      url: url,
      settings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44_100, AVNumberOfChannelsKey: 1,
      ])
    recorder.isMeteringEnabled = true
    defer {
      recorder.stop()
      try? FileManager.default.removeItem(at: url)
    }
    recorder.record()
    var endpointer = SilenceEndpointer()
    while !Task.isCancelled {
      try await Task.sleep(for: SilenceEndpointer.poll)
      recorder.updateMeters()
      if endpointer.feed(level: recorder.averagePower(forChannel: 0)) { break }
    }
    recorder.stop()
    guard endpointer.heardSpeech, !Task.isCancelled else { return nil }
    return CallClip(data: try Data(contentsOf: url), mimeType: "audio/m4a")
  }
}
