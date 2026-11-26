import AVFoundation
import Foundation

/// Plays a reply: the device voice (`AVSpeechSynthesizer`) or hosted MP3 clips (`AVAudioPlayer`).
/// `stop()` cuts it off at once, which is how a caller talking over the reply is honoured.
@MainActor
final class SpeechPlayer: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private var player: AVAudioPlayer?
  private var waiter: CheckedContinuation<Void, Never>?
  private var stopped = false

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  /// Marks the start of a new reply; `stop()` then cancels only what plays after this.
  func begin() { stopped = false }

  var isStopped: Bool { stopped }

  func speakOnDevice(_ text: String) async {
    guard !stopped, !text.isEmpty else { return }
    try? VoiceAudio.activate()
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
    await withCheckedContinuation { continuation in
      waiter = continuation
      synthesizer.speak(utterance)
    }
  }

  func play(_ clip: Data) async throws {
    guard !stopped else { return }
    try VoiceAudio.activate()
    let player = try AVAudioPlayer(data: clip)
    player.delegate = self
    self.player = player
    player.prepareToPlay()
    await withCheckedContinuation { continuation in
      waiter = continuation
      if !player.play() { finish() }
    }
  }

  func stop() {
    stopped = true
    synthesizer.stopSpeaking(at: .immediate)
    player?.stop()
    finish()
  }

  private func finish() {
    player = nil
    let continuation = waiter
    waiter = nil
    continuation?.resume()
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish _: AVSpeechUtterance) {
    Task { @MainActor in self.finish() }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel _: AVSpeechUtterance) {
    Task { @MainActor in self.finish() }
  }

  nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully _: Bool) {
    Task { @MainActor in self.finish() }
  }
}
