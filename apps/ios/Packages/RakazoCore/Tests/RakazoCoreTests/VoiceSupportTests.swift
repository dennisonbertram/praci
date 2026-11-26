import Foundation
import RakazoAPI
@testable import RakazoCore
import Testing

@Suite("voice status")
struct VoiceStatusTests {
  @Test("decodes the demo's unconfigured status")
  func unconfigured() throws {
    let json = """
      {"configured":false,"ready":false,"transcribe":false,"provider":null,"voiceId":"",\
      "transcriptionProvider":null,"transcriptionReady":false}
      """
    let status = try JSONDecoder().decode(CallVoiceStatus.self, from: Data(json.utf8))
    #expect(!status.canSpeak)
    #expect(!status.canTranscribe)
    #expect(status.provider == nil)
  }

  @Test("tolerates missing fields and reads a ready provider")
  func ready() throws {
    let status = try JSONDecoder().decode(
      CallVoiceStatus.self, from: Data(#"{"ready":true,"transcribe":true,"extra":1}"#.utf8))
    #expect(status.canSpeak)
    #expect(status.canTranscribe)
  }
}

private func feed(_ endpointer: inout SilenceEndpointer, _ level: Float) -> Bool {
  endpointer.feed(level: level)
}

@Suite("silence endpointer")
struct SilenceEndpointerTests {
  @Test("never stops before speech, then stops after 1.2 s of quiet")
  func endpoints() {
    var endpointer = SilenceEndpointer()
    for _ in 0..<20 { #expect(!feed(&endpointer, -60)) }
    #expect(!endpointer.heardSpeech)
    #expect(!feed(&endpointer, -20))
    for _ in 0..<5 { #expect(!feed(&endpointer, -60)) }
    #expect(feed(&endpointer, -60))
  }

  @Test("speech resets the quiet count")
  func resets() {
    var endpointer = SilenceEndpointer()
    _ = endpointer.feed(level: -20)
    for _ in 0..<5 { _ = endpointer.feed(level: -60) }
    #expect(!feed(&endpointer, -20))
    for _ in 0..<5 { #expect(!feed(&endpointer, -60)) }
    #expect(feed(&endpointer, -60))
  }

  @Test("stops at the 30 s cap even without a pause")
  func cap() {
    var endpointer = SilenceEndpointer()
    var stopped = 0
    for index in 1...150 where endpointer.feed(level: -20) { stopped = index }
    #expect(stopped == 150)
  }
}

@Suite("call reply tracker")
struct CallReplyTrackerTests {
  private func snapshot(_ messages: [ThreadMessage], run: ThreadRun? = nil) -> ThreadSnapshot {
    makeSnapshot(messages: messages, run: run)
  }

  private func run(_ status: String) -> ThreadRun {
    ThreadRun(id: "r1", botId: "bot-1", threadId: "thread-1", status: status)
  }

  private let user = ThreadMessage(id: "u1", role: "user", runId: "r1", callId: "c1")

  @Test("waits for the run to settle, then returns the reply once")
  func settles() {
    var tracker = CallReplyTracker(callID: "c1", snapshot: snapshot([]))
    let bot = ThreadMessage(id: "b1", role: "bot", blocks: [textBlock("It is green.")], runId: "r1")
    #expect(tracker.next(in: snapshot([user, bot], run: run("running"))) == nil)
    let reply = tracker.next(in: snapshot([user, bot], run: run("completed")))
    #expect(reply == CallReply(messageID: "b1", text: "It is green.", runID: "r1"))
    #expect(tracker.next(in: snapshot([user, bot], run: run("completed"))) == nil)
  }

  @Test("does not repeat what was already in the thread when the call started")
  func history() {
    let bot = ThreadMessage(id: "b1", role: "bot", blocks: [textBlock("Old.")], runId: "r1")
    var tracker = CallReplyTracker(callID: "c1", snapshot: snapshot([user, bot]))
    #expect(tracker.next(in: snapshot([user, bot])) == nil)
  }

  @Test("skips a reply with no spoken text")
  func empty() {
    var tracker = CallReplyTracker(callID: "c1", snapshot: snapshot([]))
    let bot = ThreadMessage(id: "b1", role: "bot", blocks: [block("card")], runId: "r1")
    #expect(tracker.next(in: snapshot([user, bot])) == nil)
  }
}
