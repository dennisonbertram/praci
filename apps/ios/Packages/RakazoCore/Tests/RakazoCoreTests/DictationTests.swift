import Foundation
@testable import RakazoCore
import Testing

// Ported from apps/mobile/lib/dictation.test.ts (same case names).

@MainActor
@Suite("mobile dictation")
struct DictationTests {
  private final class Box { var finals: [String] = []; var interims: [String] = [] }

  // swiftlint:disable:next large_tuple
  private func make() -> (DictationSession, FakeRecognizer, VoiceClock, Box) {
    let clock = VoiceClock()
    let recognizer = FakeRecognizer()
    let box = Box()
    let session = DictationSession(
      recognizer: recognizer, schedule: clock.scheduler,
      onInterim: { box.interims.append($0) }, onFinal: { box.finals.append($0) })
    return (session, recognizer, clock, box)
  }

  @Test("ends the turn only after the silence window, not on the recognizer's own final")
  func silenceWindow() {
    let (session, fake, clock, box) = make()
    session.begin()
    #expect(fake.languages == ["en-US"])

    fake.hear("how is the")
    fake.hear("how is the", isFinal: true)
    clock.advance(dictationEndpointSilence - .milliseconds(400))
    #expect(box.finals.isEmpty)

    fake.hear("deploy going")
    clock.advance(dictationEndpointSilence - .milliseconds(1))
    #expect(box.finals.isEmpty)
    clock.advance(.milliseconds(1))

    #expect(box.finals == ["how is the deploy going"])
    #expect(box.interims == ["how is the", "how is the", "how is the deploy going"])
  }

  @Test("restarts a session that ended mid-turn and carries the words already heard")
  func restart() {
    let (session, fake, clock, box) = make()
    session.begin()
    fake.hear("hello there")

    fake.end()
    #expect(box.finals.isEmpty)
    clock.advance(.milliseconds(250))
    #expect(fake.startCount == 2)

    fake.hear("friend")
    clock.advance(dictationEndpointSilence)
    #expect(box.finals == ["hello there friend"])
  }

  @Test("gives up after restarts that hear nothing")
  func wedged() {
    let (session, fake, clock, box) = make()
    session.begin()
    fake.hear("half a sentence")
    clock.advance(.milliseconds(100))
    for _ in 0..<6 {
      fake.end()
      clock.advance(.milliseconds(2_000))
    }
    #expect(box.finals == ["half a sentence"])
  }

  @Test("never finalizes a stopped session")
  func stopped() {
    let (session, fake, clock, box) = make()
    session.begin()
    fake.hear("cancel this")

    session.stop()
    #expect(fake.abortCount == 1)
    fake.hear("and this", isFinal: true)
    fake.end()
    clock.advance(.seconds(10))
    #expect(box.finals.isEmpty)
  }

  @Test("ends the turn on a permission error instead of hanging on the mic")
  func permission() {
    let (session, fake, _, box) = make()
    session.begin()
    fake.hear("open the door")
    fake.fail()
    #expect(box.finals == ["open the door"])
  }
}
