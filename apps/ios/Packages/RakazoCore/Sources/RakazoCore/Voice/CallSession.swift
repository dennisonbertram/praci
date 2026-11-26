// swiftlint:disable file_length type_body_length function_body_length cyclomatic_complexity
// A faithful port of call-session.ts keeps its one-loop shape.
import Foundation
import Observation
import RakazoAPI

// Port of apps/mobile/lib/call-session.ts: the hands-free loop. It listens, sends what it heard,
// speaks the bot's reply, lets the caller cut in, and hangs up on a goodbye. Everything that
// touches the device or the server arrives through `CallDeps`, so the loop is testable.
// Not ported (ponytail): the opening and closing cues, the waiting sound, and the voice hand-over
// to another bot. Add them when the audio assets and a bot picker exist.

public enum CallPhase: Sendable, Equatable { case listening, thinking, speaking }

public struct CallExchange: Sendable, Equatable {
  public enum Role: Sendable { case user, bot }
  public var role: Role
  public var text: String
}

public struct CallState: Sendable, Equatable {
  public var botID: String
  public var botName: String
  public var botColor: String
  public var phase: CallPhase = .listening
  public var muted = false
  public var transcriptOpen = false
  public var caption = ""
  public var heard = ""
  public var exchanges: [CallExchange] = []
  /// The caption is about a permission only the Settings app can change.
  public var needsSettings = false
}

public struct CallClip: Sendable {
  public var data: Data
  public var mimeType: String
  public init(data: Data, mimeType: String) {
    self.data = data
    self.mimeType = mimeType
  }
}

public struct CallEnded: Sendable {
  public var callID: String?
  public var farewell: String?
  public init(callID: String? = nil, farewell: String? = nil) {
    self.callID = callID
    self.farewell = farewell
  }
}

/// The caller refused (or the system blocks) the microphone or speech recognition.
public struct VoicePermissionError: LocalizedError {
  public let message: String
  public init(_ message: String) { self.message = message }
  public var errorDescription: String? { message }
}

public struct DictationHandlers {
  public var onInterim: (String) -> Void
  public var onFinal: (String) -> Void
}

@MainActor
public struct CallDeps {
  /// On-device dictation for one turn. False when the device cannot recognise speech.
  public var dictate: @MainActor (DictationHandlers) async -> Bool
  public var stopDictation: () -> Void
  /// Fallback when the device cannot: record a clip. Cancelling the task stops the recording.
  public var record: () async throws -> CallClip?
  public var transcribe: (CallClip) async throws -> String
  /// Resolves with the run the message started, so only that run's reply is spoken.
  public var send: (_ botID: String, _ text: String, _ clientNonce: String) async throws -> String?
  /// Tells the server the caller hung up, so it files the call marker and the wrap-up run.
  public var endCall: (_ botID: String, _ callID: String) async throws -> Void
  public var speak: (_ botID: String, _ text: String) async throws -> Void
  /// Cuts the reply off when the caller talks over it.
  public var stopSpeaking: () -> Void
  public var watch:
    (
      _ botID: String, _ callID: String,
      _ onReply: @escaping @MainActor @Sendable (_ messageID: String, _ text: String, _ runID: String?) -> Void,
      _ onEnded: @escaping @MainActor @Sendable (CallEnded) -> Void
    ) -> () -> Void

  public init(
    dictate: @escaping @MainActor (DictationHandlers) async -> Bool, stopDictation: @escaping () -> Void,
    record: @escaping () async throws -> CallClip?,
    transcribe: @escaping (CallClip) async throws -> String,
    send: @escaping (String, String, String) async throws -> String?,
    endCall: @escaping (String, String) async throws -> Void,
    speak: @escaping (String, String) async throws -> Void, stopSpeaking: @escaping () -> Void,
    watch: @escaping (
      String, String, @escaping @MainActor @Sendable (String, String, String?) -> Void,
      @escaping @MainActor @Sendable (CallEnded) -> Void
    ) -> () -> Void
  ) {
    self.dictate = dictate
    self.stopDictation = stopDictation
    self.record = record
    self.transcribe = transcribe
    self.send = send
    self.endCall = endCall
    self.speak = speak
    self.stopSpeaking = stopSpeaking
    self.watch = watch
  }
}

@MainActor
@Observable
public final class CallSession {
  /// How long a goodbye waits for a reply that may never come before hanging up anyway.
  public static let farewellTimeout = Duration.seconds(20)
  /// A call that cannot reach the microphone or the server this many turns in a row hangs up.
  public static let maxTurnFailures = 3

  public private(set) var state: CallState?
  public private(set) var callID = ""

  @ObservationIgnored private let deps: CallDeps
  @ObservationIgnored private let schedule: VoiceScheduler
  @ObservationIgnored private var memory = SpokenMemory()
  @ObservationIgnored private var canTranscribe = true
  @ObservationIgnored private var onDevice: Bool?
  @ObservationIgnored private var micOpen = false
  @ObservationIgnored private var micGeneration = 0
  @ObservationIgnored private var turn: Task<Void, Never>?
  @ObservationIgnored private var unwatch: (() -> Void)?
  @ObservationIgnored private var hangUpAfterReply = false
  @ObservationIgnored private var farewellSent = false
  @ObservationIgnored private var consentBlocked = false
  @ObservationIgnored private var botEndedCall = false
  @ObservationIgnored private var callRunID: String?
  @ObservationIgnored private var spokenMessageID: String?
  @ObservationIgnored private var failures = 0
  @ObservationIgnored private var bargedIn = false
  @ObservationIgnored private var cancelHangUp: CancelTimer?
  @ObservationIgnored private var cancelInterim: CancelTimer?
  @ObservationIgnored private var pendingSends: [String: [UUID: Task<Void, Never>]] = [:]

  public init(deps: CallDeps, schedule: @escaping VoiceScheduler = systemScheduler) {
    self.deps = deps
    self.schedule = schedule
  }

  /// `transcribe` says whether the voice provider can turn audio into text; a speak-only provider
  /// is fine as long as the device recognises speech itself.
  @discardableResult
  public func start(
    botID: String, botName: String, botColor: String = "", transcribe: Bool = true,
    greeting: String? = nil
  ) -> String {
    end()
    callID = UUID().uuidString.lowercased()
    callRunID = nil
    canTranscribe = transcribe
    onDevice = nil
    micOpen = false
    bargedIn = false
    memory.clear()
    state = CallState(botID: botID, botName: botName, botColor: botColor)
    unwatch = deps.watch(
      botID, callID,
      { [weak self] id, text, run in self?.onReply(id, text, run) },
      { [weak self] ended in self?.onCallEnded(ended) })
    if let greeting, !greeting.isEmpty { speakAndListen(greeting) } else { Task { await listen() } }
    return callID
  }

  public func end() {
    // The bot's own end_call already closed the call server-side; only a caller hang-up has to say so.
    if let state, !botEndedCall {
      let botID = state.botID
      let closing = callID
      let close = deps.endCall
      let pending = Array((pendingSends[closing] ?? [:]).values)
      // The server checks durable user messages, so its close must follow an in-flight write.
      Task {
        for task in pending { await task.value }
        try? await close(botID, closing)
      }
    }
    abortTurn()
    unwatch?()
    unwatch = nil
    cancelHangUp?()
    cancelHangUp = nil
    hangUpAfterReply = false
    farewellSent = false
    consentBlocked = false
    botEndedCall = false
    callRunID = nil
    spokenMessageID = nil
    failures = 0
    bargedIn = false
    clearInterim()
    memory.clear()
    state = nil
  }

  public func toggleMute() {
    guard var current = state else { return }
    current.muted.toggle()
    current.heard = ""
    state = current
    if current.muted {
      abortTurn()
      clearInterim()
      return
    }
    consentBlocked = false
    if current.phase == .listening { Task { await listen() } }
  }

  public func toggleTranscript() { state?.transcriptOpen.toggle() }

  // MARK: Listening

  private func abortTurn() {
    micGeneration += 1
    turn?.cancel()
    turn = nil
    micOpen = false
    deps.stopDictation()
  }

  private func listen() async {
    guard state != nil else { return }
    // The caller said goodbye: every path back to listening hangs up instead.
    if hangUpAfterReply { end(); return }
    state?.phase = .listening
    state?.heard = ""
    state?.caption = ""
    state?.needsSettings = false
    if state?.muted == true { return }
    await openMic()
  }

  /// Opens one microphone session, unless one is already running or the call is muted.
  private func openMic() async {
    guard let current = state, !micOpen, !current.muted else { return }
    micOpen = true
    micGeneration += 1
    let generation = micGeneration
    let botID = current.botID
    let mine = { [weak self] in self?.micGeneration == generation && self?.state?.botID == botID }
    if onDevice != false {
      // The session stays open until it delivers a turn, so the microphone is still the caller's
      // while the reply plays and a barge-in can land.
      let started = await deps.dictate(
        DictationHandlers(
          onInterim: { [weak self] text in if mine() { self?.heardInterim(text) } },
          onFinal: { [weak self] text in if mine() { Task { await self?.handleTranscript(text) } } }))
      if started {
        onDevice = true
        if !mine() { deps.stopDictation() }
        return
      }
      onDevice = false
    }
    // Muting or hanging up while the device was deciding: no microphone after all.
    if !mine() || state == nil || state?.muted == true {
      if mine() { micOpen = false }
      return
    }
    if !canTranscribe {
      micOpen = false
      state?.caption = "Allow the microphone and speech recognition in Settings to talk to your agent."
      state?.needsSettings = true
      return
    }
    let record = deps.record
    let transcribe = deps.transcribe
    turn = Task { [weak self] in
      do {
        let clip = try await record()
        guard mine() else { return }
        var text = ""
        if let clip { text = try await transcribe(clip) }
        guard mine(), let self else { return }
        micOpen = false
        await handleTranscript(text)
      } catch {
        guard mine() else { return }
        self?.micOpen = false
        self?.failTurn(error)
      }
    }
  }

  /// One finished turn: drop the reply leaking back, cut in over playback, or send it.
  func handleTranscript(_ raw: String) async {
    guard var current = state else { return }
    // The session stopped itself to deliver this.
    micOpen = false
    failures = 0
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { await listen(); return }
    if current.phase == .speaking {
      if !isCallBargeIn(text, memory: memory) {
        // The microphone caught the reply, not the caller: reopen so a real interruption still
        // lands, and let the reply play out.
        state?.heard = ""
        await openMic()
        return
      }
      // The caller talked over the reply: cut the audio, and never resume that message.
      bargedIn = true
      clearInterim()
      deps.stopSpeaking()
      state?.phase = .thinking
      state?.caption = ""
    }
    if memory.isEcho(text) {
      state?.heard = ""
      await listen()
      return
    }
    guard let live = state else { return }
    current = live
    let botID = current.botID
    // The call this turn belongs to: hanging up and calling again before send resolves must not
    // hand the new call the old run.
    let turnCallID = callID
    state?.phase = .thinking
    state?.heard = text
    state?.exchanges.append(CallExchange(role: .user, text: text))
    if isFarewell(text) {
      hangUpAfterReply = true
      // A second goodbye replaces this timer.
      cancelHangUp?()
      cancelHangUp = schedule(Self.farewellTimeout) { [weak self] in self?.end() }
    }
    guard let nonce = CallNonce.make(callID: turnCallID) else { return }
    let send = deps.send
    let request = Task { try await send(botID, text, nonce) }
    let pendingID = UUID()
    pendingSends[turnCallID, default: [:]][pendingID] = Task { _ = await request.result }
    defer {
      pendingSends[turnCallID]?[pendingID] = nil
      if pendingSends[turnCallID]?.isEmpty == true { pendingSends[turnCallID] = nil }
    }
    do {
      let runID = try await request.value
      if state?.botID == botID, callID == turnCallID {
        callRunID = runID
        if hangUpAfterReply { farewellSent = true }
      }
    } catch {
      guard state?.botID == botID, callID == turnCallID else { return }
      if let blocked = error as? AIConsentBlocked {
        // Bot already closed server-side: do not clear its hang-up into a muted stuck call.
        if botEndedCall { end(); return }
        // Goodbye was not delivered; drop the armed hang-up so mute and retry can continue.
        cancelHangUp?()
        cancelHangUp = nil
        hangUpAfterReply = false
        farewellSent = false
        blockForConsent(blocked)
        return
      }
      failTurn(error)
    }
  }

  private func failTurn(_ error: any Error) {
    if error is VoicePermissionError {
      // Retrying cannot help: only the Settings app can grant it.
      state?.phase = .listening
      state?.caption = error.localizedDescription
      state?.needsSettings = true
      return
    }
    failures += 1
    if failures >= Self.maxTurnFailures { end(); return }
    state?.phase = .listening
    state?.caption = Self.text(error, fallback: "Could not hear that.")
    Task { await listen() }
  }

  /// A denied disclosure is not a transient call failure: wait for an explicit retry.
  private func blockForConsent(_ error: AIConsentBlocked) {
    consentBlocked = true
    abortTurn()
    clearInterim()
    state?.phase = .listening
    state?.muted = true
    state?.heard = ""
    state?.caption = Self.text(error, fallback: "Could not hear that.")
  }

  /// A running guess: it shows what the caller is saying and, over a reply, is the only signal
  /// that arrives while they are still talking. A phrase that stands for 300 ms stops the audio
  /// at once; the session keeps running, so its silence window finishes the utterance.
  private func heardInterim(_ text: String) {
    guard let current = state else { return }
    if current.phase != .speaking {
      clearInterim()
      state?.heard = text
      return
    }
    if !isInterimCallBargeIn(text, memory: memory) {
      clearInterim()
      return
    }
    if cancelInterim != nil { return }
    cancelInterim = schedule(interimBargeInDelay) { [weak self] in
      guard let self else { return }
      cancelInterim = nil
      guard state?.phase == .speaking else { return }
      bargedIn = true
      deps.stopSpeaking()
      state?.phase = .listening
      state?.caption = ""
    }
  }

  private func clearInterim() {
    cancelInterim?()
    cancelInterim = nil
  }

  // MARK: Replies

  private func onReply(_ messageID: String, _ text: String, _ runID: String?) {
    // Work the bot files after hanging up belongs in the thread, not in the caller's ear.
    if state == nil || botEndedCall || messageID == spokenMessageID { return }
    // A reply to something typed into the thread mid-call belongs on screen only.
    if let callRunID, let runID, runID != callRunID { return }
    spokenMessageID = messageID
    speakAndListen(text)
  }

  private func speakAndListen(_ text: String) {
    guard let current = state else { return }
    let botID = current.botID
    let speakingCallID = callID
    bargedIn = false
    clearInterim()
    state?.exchanges.append(CallExchange(role: .bot, text: text))
    // A prior disclosure refusal stays muted until unmute; do not re-open speech consent.
    if consentBlocked {
      state?.phase = .listening
      state?.heard = ""
      return
    }
    memory.remember(text)
    // Only the on-device path can hear the caller over the reply; the recorder would just record
    // the speaker, so it stays shut until playback ends.
    if onDevice != true { abortTurn() }
    state?.phase = .speaking
    state?.heard = ""
    if onDevice == true { Task { await openMic() } }
    let speak = deps.speak
    Task { [weak self] in
      var blockedByConsent = false
      do {
        try await speak(botID, text)
      } catch {
        guard let self, state?.botID == botID, callID == speakingCallID else { return }
        if let blocked = error as? AIConsentBlocked {
          blockedByConsent = true
          // Hang-up already committed server-side or via a sent goodbye.
          if botEndedCall || farewellSent { end(); return }
          blockForConsent(blocked)
        } else {
          state?.caption = Self.text(error, fallback: "Could not speak that.")
        }
      }
      guard let self, state?.botID == botID, callID == speakingCallID else { return }
      // The caller cut in: the microphone is already theirs and their turn is on its way.
      if blockedByConsent || bargedIn { return }
      await listen()
    }
  }

  /// The bot hung up: speak the goodbye it wrote, then end; the rest lands in the thread.
  private func onCallEnded(_ ended: CallEnded) {
    guard state != nil, ended.callID == callID, !botEndedCall else { return }
    hangUpAfterReply = true
    botEndedCall = true
    cancelHangUp?()
    cancelHangUp = schedule(Self.farewellTimeout) { [weak self] in self?.end() }
    let farewell = ended.farewell?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    // Nothing to say: hang up instead of waiting out the fallback.
    if farewell.isEmpty { end(); return }
    speakAndListen(farewell)
  }

  private static func text(_ error: any Error, fallback: String) -> String {
    let text = (error as? any LocalizedError)?.errorDescription
    return text.flatMap { $0.isEmpty ? nil : $0 } ?? fallback
  }
}
// swiftlint:enable file_length type_body_length function_body_length cyclomatic_complexity
