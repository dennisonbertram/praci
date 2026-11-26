import AVFoundation
import Foundation
import RakazoCore
import Speech

/// The device's own speech recognition (`SFSpeechRecognizer`) behind the core's `SpeechRecognizing`.
/// iOS ends a recognition task on a pause or its own limit; `DictationSession` restarts it.
@MainActor
final class DeviceSpeechRecognizer: SpeechRecognizing {
  var onEvent: (@MainActor (DictationEvent) -> Void)?

  private let engine = AVAudioEngine()
  private let sink = RequestSink()
  private var task: SFSpeechRecognitionTask?
  private var tapInstalled = false
  private static let isSimulator: Bool = {
    #if targetEnvironment(simulator)
      true
    #else
      false
    #endif
  }()

  func start(language: String) {
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)),
      recognizer.isAvailable, recognizer.supportsOnDeviceRecognition
    else {
      onEvent?(.fatalError)
      return
    }
    task?.cancel()
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.requiresOnDeviceRecognition = true
    sink.set(request)
    do {
      try VoiceAudio.activate()
      // No input route (a device without a microphone): do not touch the engine.
      guard AVAudioSession.sharedInstance().isInputAvailable else { throw VoicePermissionError(VoiceAudio.micDenied) }
      // The simulator's audio host times out when the engine asks for input, which aborts the app.
      guard !Self.isSimulator else { throw VoicePermissionError(VoiceAudio.micDenied) }
      try startEngine()
    } catch {
      onEvent?(.fatalError)
      return
    }
    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      let text = result?.bestTranscription.formattedString
      let isFinal = result?.isFinal ?? false
      let failed = error != nil
      Task { @MainActor in self?.deliver(text, isFinal: isFinal, failed: failed) }
    }
  }

  func abort() {
    task?.cancel()
    task = nil
    sink.set(nil)
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    engine.stop()
    VoiceAudio.deactivate()
  }

  private func startEngine() throws {
    if !tapInstalled {
      let input = engine.inputNode
      let sink = sink
      input.installTap(onBus: 0, bufferSize: 1_024, format: input.outputFormat(forBus: 0)) { buffer, _ in
        sink.append(buffer)
      }
      tapInstalled = true
    }
    if !engine.isRunning {
      engine.prepare()
      try engine.start()
    }
  }

  private func deliver(_ text: String?, isFinal: Bool, failed: Bool) {
    if let text, !text.isEmpty { onEvent?(.result(text, isFinal: isFinal)) }
    // A finished or failed task is a session end; the dictation session decides whether to restart.
    if isFinal || failed { onEvent?(.ended) }
  }
}

// Hands microphone buffers from the audio thread to the current recognition request.
// @unchecked: the request is only touched under the lock, and `append` is documented as thread-safe.
private final class RequestSink: @unchecked Sendable {
  private let lock = NSLock()
  private var request: SFSpeechAudioBufferRecognitionRequest?

  func set(_ next: SFSpeechAudioBufferRecognitionRequest?) {
    lock.lock()
    defer { lock.unlock() }
    request?.endAudio()
    request = next
  }

  func append(_ buffer: AVAudioPCMBuffer) {
    lock.lock()
    defer { lock.unlock() }
    request?.append(buffer)
  }
}
