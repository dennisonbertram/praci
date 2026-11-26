import Foundation
@testable import RakazoCore
import Testing

// Ported from apps/mobile/lib/call-session.test.ts (same case names where the behaviour exists).

private struct Boom: LocalizedError { var errorDescription: String? { "boom" } }

@MainActor
private final class Harness {
  let clock = VoiceClock()
  var session: CallSession!
  var handlers: DictationHandlers?
  var onDevice = true
  // swiftlint:disable:next large_tuple
  var sent: [(bot: String, text: String, nonce: String)] = []
  var spoken: [String] = []
  var closed: [(bot: String, call: String)] = []
  var stopSpeakingCount = 0
  var stopDictationCount = 0
  var recordCount = 0
  var runID: String? = "run-1"
  var sendError: (any Error)?
  var speakError: (any Error)?
  var recordError: (any Error)?
  var holdSpeech = false
  private var speechWaiters: [CheckedContinuation<Void, Never>] = []
  var onReply: ((String, String, String?) -> Void)?
  var onEnded: ((CallEnded) -> Void)?
  var watchStops = 0

  init() {
    session = CallSession(
      deps: CallDeps(
        dictate: { [unowned self] handlers in
          guard onDevice else { return false }
          self.handlers = handlers
          return true
        },
        stopDictation: { [unowned self] in stopDictationCount += 1 },
        record: { [unowned self] in
          recordCount += 1
          if let recordError { throw recordError }
          return nil
        },
        transcribe: { _ in "" },
        send: { [unowned self] bot, text, nonce in
          sent.append((bot, text, nonce))
          if let sendError { throw sendError }
          return runID
        },
        endCall: { [unowned self] bot, call in closed.append((bot, call)) },
        speak: { [unowned self] _, text in
          spoken.append(text)
          if let speakError { throw speakError }
          if holdSpeech { await withCheckedContinuation { speechWaiters.append($0) } }
        },
        stopSpeaking: { [unowned self] in
          stopSpeakingCount += 1
          finishSpeech()
        },
        watch: { [unowned self] _, _, reply, ended in
          onReply = reply
          onEnded = ended
          return { [unowned self] in watchStops += 1 }
        }),
      schedule: clock.scheduler)
  }

  func finishSpeech() {
    let waiters = speechWaiters
    speechWaiters = []
    for waiter in waiters { waiter.resume() }
  }

  @discardableResult
  func start(transcribe: Bool = true, greeting: String? = nil) async -> String {
    let id = session.start(
      botID: "bot-1", botName: "Chief", transcribe: transcribe, greeting: greeting)
    await settleVoice()
    return id
  }

  func hear(_ text: String) async {
    handlers?.onFinal(text)
    await settleVoice()
  }

  func reply(_ id: String, _ text: String, run: String? = "run-1") async {
    onReply?(id, text, run)
    await settleVoice()
  }
}

// swiftlint:disable identifier_name type_body_length
@MainActor
@Suite("mobile call session")
struct CallSessionTests {
  @Test("starts listening for the bot on the call")
  func starts() async {
    let h = Harness()
    await h.start()
    #expect(h.session.state?.botID == "bot-1")
    #expect(h.session.state?.phase == .listening)
    #expect(h.handlers != nil)
  }

  @Test("sends what it heard to the call's bot")
  func sends() async {
    let h = Harness()
    await h.start()
    await h.hear("  how is the deploy  ")
    #expect(h.sent.map(\.text) == ["how is the deploy"])
    #expect(h.sent.first?.bot == "bot-1")
    #expect(h.session.state?.phase == .thinking)
    #expect(h.session.state?.exchanges == [CallExchange(role: .user, text: "how is the deploy")])
  }

  @Test("tags every message in one call with the same call id")
  func tags() async {
    let h = Harness()
    let id = await h.start()
    await h.hear("first question")
    await h.hear("second question")
    #expect(h.sent.count == 2)
    #expect(h.sent.allSatisfy { CallNonce.callID(from: $0.nonce) == id })
    #expect(Set(h.sent.map(\.nonce)).count == 2)
  }

  @Test("speaks a reply, then listens again")
  func speaks() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    await h.reply("m1", "It is green.")
    #expect(h.spoken == ["It is green."])
    #expect(h.session.state?.phase == .listening)
    #expect(h.session.state?.exchanges.last == CallExchange(role: .bot, text: "It is green."))
  }

  @Test("speaks each reply once")
  func once() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    await h.reply("m1", "It is green.")
    await h.reply("m1", "It is green.")
    #expect(h.spoken == ["It is green."])
  }

  @Test("speaks the greeting before the first turn")
  func greeting() async {
    let h = Harness()
    await h.start(greeting: "Hi, it's Chief.")
    #expect(h.spoken == ["Hi, it's Chief."])
    #expect(h.session.state?.phase == .listening)
  }

  @Test("leaves a reply from another run out of the call")
  func otherRun() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    await h.reply("typed", "Reply to something typed.", run: "run-9")
    #expect(h.spoken.isEmpty)
  }

  @Test("drops the reply leaking back into the microphone")
  func leak() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.holdSpeech = true
    await h.reply("m1", "I am checking the deploy now")
    #expect(h.session.state?.phase == .speaking)
    await h.hear("I am checking the deploy")
    #expect(h.sent.count == 1)
    #expect(h.stopSpeakingCount == 0)
    #expect(h.session.state?.phase == .speaking)
  }

  @Test("cuts the reply short when the caller talks over it, and still sends that turn")
  func bargeIn() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.holdSpeech = true
    await h.reply("m1", "The deploy is green and the tests all passed today")
    #expect(h.session.state?.phase == .speaking)

    h.handlers?.onInterim("wait what about staging")
    h.clock.advance(.milliseconds(299))
    #expect(h.stopSpeakingCount == 0)
    h.clock.advance(.milliseconds(1))
    await settleVoice()
    #expect(h.stopSpeakingCount == 1)
    #expect(h.session.state?.phase == .listening)

    await h.hear("wait what about staging")
    #expect(h.sent.map(\.text) == ["how is the deploy", "wait what about staging"])
    #expect(h.session.state?.phase == .thinking)
  }

  @Test("keeps playing through a one-word backchannel")
  func backchannel() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.holdSpeech = true
    await h.reply("m1", "The deploy is green")
    h.handlers?.onInterim("yeah")
    h.clock.advance(.seconds(1))
    await settleVoice()
    #expect(h.stopSpeakingCount == 0)
    #expect(h.session.state?.phase == .speaking)
  }

  @Test("a full final over the reply cuts it and sends the turn")
  func finalBargeIn() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.holdSpeech = true
    await h.reply("m1", "The deploy is green")
    await h.hear("stop")
    #expect(h.stopSpeakingCount == 1)
    #expect(h.sent.map(\.text).last == "stop")
  }

  @Test("hangs up once the bot has answered a goodbye")
  func farewell() async {
    let h = Harness()
    let id = await h.start()
    await h.hear("ok thanks, bye!")
    #expect(h.session.state != nil)
    await h.reply("m1", "Talk soon.")
    #expect(h.session.state == nil)
    #expect(h.closed.map(\.call) == [id])
    #expect(h.watchStops == 1)
  }

  @Test("hangs up on a goodbye the bot never answers")
  func farewellTimeout() async {
    let h = Harness()
    await h.start()
    await h.hear("that's all")
    h.clock.advance(.seconds(19))
    #expect(h.session.state != nil)
    h.clock.advance(.seconds(1))
    await settleVoice()
    #expect(h.session.state == nil)
    #expect(h.closed.count == 1)
  }

  @Test("does not let an earlier farewell timer end the next call")
  func staleTimer() async {
    let h = Harness()
    await h.start()
    await h.hear("goodbye")
    h.session.end()
    await settleVoice()
    await h.start()
    h.clock.advance(.seconds(30))
    #expect(h.session.state != nil)
  }

  @Test("speaks the farewell and hangs up when the bot ends the call itself")
  func botEnds() async {
    let h = Harness()
    let id = await h.start()
    h.onEnded?(CallEnded(callID: id, farewell: "Bye for now."))
    await settleVoice()
    #expect(h.spoken == ["Bye for now."])
    #expect(h.session.state == nil)
    #expect(h.closed.isEmpty)
  }

  @Test("ignores a call ended event from another call")
  func otherCall() async {
    let h = Harness()
    await h.start()
    h.onEnded?(CallEnded(callID: "someone-else", farewell: "Bye"))
    await settleVoice()
    #expect(h.session.state != nil)
    #expect(h.spoken.isEmpty)
  }

  @Test("never speaks the work the bot files after it hung up")
  func afterHangUp() async {
    let h = Harness()
    let id = await h.start()
    h.onEnded?(CallEnded(callID: id, farewell: "Bye"))
    await settleVoice()
    await h.reply("late", "Here is the report you asked for.")
    #expect(h.spoken == ["Bye"])
  }

  @Test("closes the call server-side when the caller presses hang up")
  func hangUp() async {
    let h = Harness()
    let id = await h.start()
    h.session.end()
    await settleVoice()
    #expect(h.closed.map(\.bot) == ["bot-1"])
    #expect(h.closed.map(\.call) == [id])
    #expect(h.session.state == nil)
  }

  @Test("mutes after a consent refusal instead of reopening the microphone or resending")
  func consentRefusal() async {
    let h = Harness()
    await h.start()
    h.sendError = AIConsentBlocked()
    await h.hear("how is the deploy")
    #expect(h.session.state?.muted == true)
    #expect(h.session.state?.caption == AIConsent.required)
    #expect(h.sent.count == 1)
  }

  @Test("mutes after a speech-provider consent refusal without recording another turn")
  func speechConsent() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.speakError = AIConsentBlocked()
    await h.reply("m1", "It is green.")
    #expect(h.session.state?.muted == true)
    #expect(h.session.state?.phase == .listening)
  }

  @Test("keeps retrying ordinary speech errors")
  func speechErrors() async {
    let h = Harness()
    await h.start()
    await h.hear("how is the deploy")
    h.speakError = Boom()
    await h.reply("m1", "It is green.")
    #expect(h.session.state?.muted == false)
    #expect(h.session.state?.phase == .listening)
  }

  @Test("stops recording while muted")
  func muted() async {
    let h = Harness()
    await h.start()
    let before = h.stopDictationCount
    h.session.toggleMute()
    #expect(h.session.state?.muted == true)
    #expect(h.stopDictationCount > before)
    let opens = h.handlers
    h.handlers = nil
    h.session.toggleMute()
    await settleVoice()
    #expect(h.handlers != nil)
    _ = opens
  }

  @Test("reports a failed recording and retries, then hangs up cleanly")
  func failedRecording() async {
    let h = Harness()
    h.onDevice = false
    h.recordError = Boom()
    await h.start()
    await settleVoice()
    #expect(h.session.state == nil)
    #expect(h.recordCount == CallSession.maxTurnFailures)
    #expect(h.closed.count == 1)
  }

  @Test("tells the caller to open Settings instead of retrying when permission is denied")
  func permissionDenied() async {
    let h = Harness()
    h.onDevice = false
    h.recordError = VoicePermissionError("Allow microphone access to call an agent.")
    await h.start()
    await settleVoice()
    #expect(h.session.state?.needsSettings == true)
    #expect(h.session.state?.caption == "Allow microphone access to call an agent.")
    #expect(h.recordCount == 1)
  }

  @Test("explains when the device cannot listen and the provider cannot transcribe")
  func noTranscription() async {
    let h = Harness()
    h.onDevice = false
    await h.start(transcribe: false)
    #expect(h.session.state?.needsSettings == true)
    #expect(h.recordCount == 0)
  }
}
// swiftlint:enable identifier_name type_body_length
