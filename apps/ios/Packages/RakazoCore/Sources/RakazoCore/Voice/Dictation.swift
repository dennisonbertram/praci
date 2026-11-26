import Foundation

// Port of apps/mobile/lib/dictation.ts. The recognizer reports words, and only a quiet gap
// measured here ends a turn. The recognizer's own final result or end is a breath or an OS
// limit, never the caller finishing a sentence.

/// Quiet gap that ends an utterance. A natural breath is well under it, a finished turn well over.
public let dictationEndpointSilence = Duration.milliseconds(1_200)
private let restartMin = Duration.milliseconds(250)
private let restartMax = Duration.milliseconds(2_000)
/// Restarts in a row that hear nothing: the recognizer is wedged, stop churning the microphone.
private let maxDeadRestarts = 5

public enum DictationEvent: Sendable, Equatable {
  case result(String, isFinal: Bool)
  case ended
  /// The turn cannot recover (permission revoked, microphone lost); other errors are routine.
  case fatalError
}

/// The slice of `SFSpeechRecognizer` this module needs, so tests can drive the events.
@MainActor
public protocol SpeechRecognizing: AnyObject {
  var onEvent: (@MainActor (DictationEvent) -> Void)? { get set }
  func start(language: String)
  func abort()
}

public typealias CancelTimer = @MainActor () -> Void
/// Runs `work` once after the delay; the returned closure cancels it.
public typealias VoiceScheduler = @MainActor (Duration, @escaping @MainActor () -> Void) -> CancelTimer

public let systemScheduler: VoiceScheduler = { delay, work in
  let task = Task { @MainActor in
    try? await Task.sleep(for: delay)
    if !Task.isCancelled { work() }
  }
  return { task.cancel() }
}

@MainActor
public final class DictationSession {
  private let recognizer: any SpeechRecognizing
  private let schedule: VoiceScheduler
  private let language: String
  private let onInterim: (String) -> Void
  private let onFinal: (String) -> Void
  private let onDone: () -> Void
  private var active = false
  private var carried = ""
  private var heard = ""
  private var cancelSilence: CancelTimer?
  private var cancelRestart: CancelTimer?
  private var backoff = restartMin
  private var deadRestarts = 0

  public init(
    recognizer: any SpeechRecognizing, schedule: @escaping VoiceScheduler = systemScheduler,
    language: String = "en-US", onInterim: @escaping (String) -> Void = { _ in },
    onFinal: @escaping (String) -> Void, onDone: @escaping () -> Void = {}
  ) {
    self.recognizer = recognizer
    self.schedule = schedule
    self.language = language
    self.onInterim = onInterim
    self.onFinal = onFinal
    self.onDone = onDone
  }

  /// Opens the microphone until a quiet gap ends the utterance, or `stop()` cancels it.
  public func begin() {
    active = true
    recognizer.onEvent = { [weak self] in self?.handle($0) }
    recognizer.start(language: language)
  }

  public func stop() {
    guard active else { return }
    active = false
    cancelSilence?()
    cancelRestart?()
    cancelSilence = nil
    cancelRestart = nil
    recognizer.onEvent = nil
    recognizer.abort()
  }

  private func handle(_ event: DictationEvent) {
    guard active else { return }
    switch event {
    case .result(let text, let isFinal): onResult(text, isFinal: isFinal)
    case .ended: onEnd()
    case .fatalError: finish()
    }
  }

  private func onResult(_ text: String, isFinal: Bool) {
    backoff = restartMin
    deadRestarts = 0
    // Android reports a phrase once and starts over, iOS grows one transcript: folding a final
    // into the carried text and clearing the live one covers both.
    if isFinal {
      carried = Self.join(carried, text)
      heard = ""
    } else {
      heard = text
    }
    let all = Self.join(carried, heard)
    if all.isEmpty { return }
    onInterim(all)
    // Any result means the caller was just heard, so the quiet gap restarts here.
    cancelSilence?()
    cancelSilence = schedule(dictationEndpointSilence) { [weak self] in self?.finish() }
  }

  private func onEnd() {
    // The system ends a session on a pause, an interruption or its own cap; that says nothing
    // about whether the caller finished. Pick the microphone straight back up.
    carried = Self.join(carried, heard)
    heard = ""
    deadRestarts += 1
    if deadRestarts > maxDeadRestarts {
      // ponytail: a wedged recognizer just ends the turn; the call opens the microphone again next turn.
      finish()
      return
    }
    cancelRestart?()
    let delay = backoff
    backoff = min(restartMax, backoff * 2)
    cancelRestart = schedule(delay) { [weak self] in
      guard let self, active else { return }
      recognizer.start(language: language)
    }
  }

  private func finish() {
    guard active else { return }
    let text = Self.join(carried, heard)
    stop()
    if !text.isEmpty { onFinal(text) }
    onDone()
  }

  private static func join(_ left: String, _ right: String) -> String {
    "\(left) \(right)".split(whereSeparator: \.isWhitespace).joined(separator: " ")
  }
}
