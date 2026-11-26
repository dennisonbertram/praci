import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

// Ported from packages/core/src/{echo,barge-in,farewell,call-nonce}.test.ts (same case names).

private let spoken = "I'm here and hearing you…"

@Suite("isEchoOfSpeech")
struct EchoTests {
  @Test("catches a fragment of the reply that just played")
  func fragment() { #expect(isEchoOfSpeech("I am here in", spoken: spoken)) }

  @Test("catches a fragment with filler around it")
  func filler() { #expect(isEchoOfSpeech("hey I am here and here", spoken: spoken)) }

  @Test("keeps a genuine short turn")
  func shortTurn() { #expect(!isEchoOfSpeech("what should we do next", spoken: spoken)) }

  @Test("keeps a long turn that happens to share words")
  func longTurn() {
    let heard = "I am not sure you are hearing me so let me say the whole thing again from the top"
    #expect(!isEchoOfSpeech(heard, spoken: spoken))
  }

  @Test("drops a looser overlap only at the playback threshold")
  func threshold() {
    #expect(!isEchoOfSpeech("I am here what about that", spoken: spoken))
    #expect(isEchoOfSpeech("I am here what about that", spoken: spoken, threshold: 0.4))
  }

  @Test("keeps everything when nothing was spoken")
  func nothingSpoken() { #expect(!isEchoOfSpeech("I am here in", spoken: "")) }

  private let newspaper = "Happy to, but I'm not sure which newspaper you mean"

  @Test("two-word echoes need adjacent words")
  func twoWords() {
    #expect(isEchoOfSpeech("happy to", spoken: newspaper))
    #expect(isEchoOfSpeech("tell me", spoken: "…just tell me the client…"))
    #expect(isEchoOfSpeech("new project", spoken: "…tell me which new project you meant…"))
    #expect(!isEchoOfSpeech("hello there", spoken: newspaper))
    #expect(!isEchoOfSpeech("happy sure", spoken: newspaper))
  }

  @Test("keeps a single word, never an echo")
  func oneWord() { #expect(!isEchoOfSpeech("yes", spoken: newspaper)) }
}

@Suite("SpokenMemory")
struct SpokenMemoryTests {
  @Test("catches an echo of a reply the bot has already spoken past")
  func earlier() {
    var memory = SpokenMemory()
    memory.remember(spoken, now: 0)
    memory.remember("Booked for Friday", now: 1)
    #expect(memory.isEcho("hey I am here and here", now: 2))
  }

  @Test("catches a line the mic heard across two spoken sentences")
  func acrossTwo() {
    var memory = SpokenMemory()
    memory.remember("Okay, give me a second", now: 0)
    memory.remember("I am checking the deploy now", now: 0.5)
    #expect(memory.isEcho("a second I am checking", now: 1))
  }

  @Test("forgets what was spoken more than the window ago")
  func window() {
    var memory = SpokenMemory()
    memory.remember(spoken, now: 0)
    #expect(memory.isEcho("hey I am here and here", now: 14))
    #expect(!memory.isEcho("hey I am here and here", now: 16))
  }

  @Test("keeps a genuine turn, and everything once cleared")
  func cleared() {
    var memory = SpokenMemory()
    memory.remember(spoken, now: 0)
    #expect(!memory.isEcho("what should we do next", now: 0.1))
    memory.clear()
    #expect(!memory.isEcho("hey I am here and here", now: 0.1))
  }
}

@Suite("call barge-in")
struct BargeInTests {
  @Test("lets an interruption word cut a reply short", arguments: [
    "stop", "Stop!", "WAIT", "hold on", "Hold on.", "pause", "no",
  ])
  func interruptions(_ text: String) {
    let memory = SpokenMemory()
    #expect(isCallBargeIn(text, memory: memory))
  }

  @Test("lets a sentence cut a reply short")
  func sentence() {
    let memory = SpokenMemory()
    #expect(isCallBargeIn("wait, what about the deploy", memory: memory))
    #expect(isInterimCallBargeIn("what about the deploy", memory: memory))
  }

  @Test("keeps playing through a one-word backchannel")
  func backchannel() {
    let memory = SpokenMemory()
    #expect(!isCallBargeIn("yeah", memory: memory))
    #expect(!isInterimCallBargeIn("yeah", memory: memory))
    #expect(!isInterimCallBargeIn("stop", memory: memory))
  }

  @Test("ignores the reply leaking back at the playback threshold")
  func leak() {
    var memory = SpokenMemory()
    memory.remember("I'm here and hearing you")
    #expect(!isCallBargeIn("I am here what about that", memory: memory))
    #expect(!isInterimCallBargeIn("I am here and hearing", memory: memory))
  }

  @Test("ignores an empty transcript")
  func empty() {
    let memory = SpokenMemory()
    #expect(!isCallBargeIn("   ", memory: memory))
    #expect(!isInterimCallBargeIn("", memory: memory))
  }
}

@Suite("isFarewell")
struct FarewellTests {
  @Test("hears the end of the call", arguments: [
    "That's all", "ok thanks, bye!", "Goodbye", "that'll be all for now", "hang up",
    "End the call.", "alright, I'm done, thanks",
  ])
  func ends(_ text: String) { #expect(isFarewell(text)) }

  @Test("keeps the call going", arguments: [
    "bye the way, can you check the deploy", "that's all wrong, redo it",
    "tell me about goodbye songs", "I'm done with the draft, what's next", "",
    "before we wrap up that's all I had on the deploy today",
  ])
  func continues(_ text: String) { #expect(!isFarewell(text)) }
}

@Suite("call client nonce")
struct CallNonceTests {
  @Test("round-trips the call id")
  func roundTrip() throws {
    let nonce = try #require(CallNonce.make(callID: "call-1"))
    #expect(CallNonce.isCall(nonce))
    #expect(CallNonce.callID(from: nonce) == "call-1")
  }

  @Test("stays unique per message within one call")
  func unique() {
    #expect(CallNonce.make(callID: "call-1") != CallNonce.make(callID: "call-1"))
  }

  @Test("rejects a call id that would blur the nonce format")
  func colon() { #expect(CallNonce.make(callID: "call:1") == nil) }

  @Test("reads the id up to the unique suffix, not the first colon")
  func suffix() {
    #expect(CallNonce.callID(from: "call:call:1:abc") == "call:1")
    #expect(CallNonce.callID(from: "call:call-1") == nil)
  }

  @Test("rejects plain nonces and other prefixed nonces")
  func others() {
    for nonce in [nil, "", "abc-123", "user-progress:run-1:0:x:y"] as [String?] {
      #expect(!CallNonce.isCall(nonce))
      #expect(CallNonce.callID(from: nonce) == nil)
    }
  }
}

@Suite("latestSpokenCallReply")
struct LatestCallReplyTests {
  private func message(
    _ id: String, _ role: String, call: String? = nil, run: String? = nil, marker: Bool = false
  ) -> ThreadMessage {
    ThreadMessage(
      id: id, role: role, blocks: [marker ? block("voice_call") : textBlock(id)], runId: run,
      callId: call)
  }

  @Test("returns the newest bot turn inside the call's open card")
  func newest() {
    let messages = [
      message("typed", "user"), message("u1", "user", call: "c1", run: "r1"),
      message("b1", "bot", run: "r1"), message("u2", "user", call: "c1", run: "r2"),
      message("b2", "bot", run: "r2"),
    ]
    #expect(latestSpokenCallReply(messages, callID: "c1")?.id == "b2")
  }

  @Test("ignores another call and a typed turn after the card")
  func other() {
    let messages = [
      message("u1", "user", call: "c1", run: "r1"), message("b1", "bot", run: "r1"),
      message("typed", "user"), message("b2", "bot", run: "r9"),
    ]
    #expect(latestSpokenCallReply(messages, callID: "c2") == nil)
    #expect(latestSpokenCallReply(messages, callID: "c1")?.id == "b1")
  }

  @Test("says nothing once the bot's hang-up marker closed the card")
  func marker() {
    let messages = [
      message("u1", "user", call: "c1", run: "r1"), message("b1", "bot", run: "r1"),
      message("end", "bot", call: "c1", run: "r1", marker: true), message("wrap", "bot", run: "r1"),
    ]
    #expect(latestSpokenCallReply(messages, callID: "c1") == nil)
  }
}
