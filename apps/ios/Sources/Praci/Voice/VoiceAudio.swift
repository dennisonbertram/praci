import AVFoundation
import Foundation
import RakazoCore
import Speech

/// Microphone and speech-recognition permissions, and the one audio session calls and dictation share.
enum VoiceAudio {
  static let micDenied =
    "Allow microphone access in Settings to talk to your agent."
  static let speechDenied =
    "Allow speech recognition in Settings to dictate."

  /// Asks for the microphone (the system prompt shows once). False when it is denied.
  static func requestMicrophone() async -> Bool {
    await AVAudioApplication.requestRecordPermission()
  }

  /// Speech recognition that stays on the phone. Without it nothing is captured: audio is never
  /// sent to Apple's servers, and hosted transcription needs its own consent.
  static func onDeviceSupported() -> Bool {
    recognizer()?.supportsOnDeviceRecognition == true
  }

  static let meetingMicDenied = "Allow microphone access in Settings to record meetings."

  /// True while a meeting is being recorded. Calls and dictation must not touch the audio session
  /// then: `activate()` and `deactivate()` do nothing, so the recording keeps its input.
  nonisolated(unsafe) static var meetingActive = false

  static let dictationUnavailable = "Dictation isn't available on this device."

  /// Asks for speech recognition. False when denied or the device cannot recognise speech.
  static func requestSpeech() async -> Bool {
    let status = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
    }
    return status == .authorized && recognizer()?.isAvailable == true
  }

  static func recognizer() -> SFSpeechRecognizer? {
    SFSpeechRecognizer(locale: Locale(identifier: language))
  }

  /// The user's first preferred language, which is what the recognizer is asked to hear.
  static var language: String { Locale.preferredLanguages.first ?? "en-US" }

  /// Play and record together, with the system's echo cancellation for speech.
  static func activate() throws {
    if meetingActive { return }
    let session = AVAudioSession.sharedInstance()
    #if targetEnvironment(simulator)
      // The simulator's audio host cannot start voice-processing input; plain recording works.
      try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
    #else
      try session.setCategory(
        .playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetoothHFP])
    #endif
    try session.setActive(true)
  }

  static func deactivate() {
    if meetingActive { return }
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}

extension VoiceAudio {
  /// Record-only input for a meeting, which keeps running with the screen locked (audio background mode).
  static func activateForMeeting() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .default)
    try session.setActive(true)
  }

  static func deactivateForMeeting() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
