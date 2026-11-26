import Foundation
@testable import RakazoCore

/// Runs scheduled work when the test advances time; nothing waits on the real clock.
@MainActor
final class VoiceClock {
  private struct Item {
    var id: Int
    var due: Duration
    var work: @MainActor () -> Void
  }

  private var now = Duration.zero
  private var items: [Item] = []
  private var nextID = 0

  var pending: Int { items.count }

  var scheduler: VoiceScheduler {
    { [self] delay, work in
      nextID += 1
      let id = nextID
      items.append(Item(id: id, due: now + delay, work: work))
      return { [self] in items.removeAll { $0.id == id } }
    }
  }

  func advance(_ duration: Duration) {
    let target = now + duration
    while let next = items.filter({ $0.due <= target }).min(by: { $0.due < $1.due }) {
      items.removeAll { $0.id == next.id }
      now = next.due
      next.work()
    }
    now = target
  }
}

@MainActor
final class FakeRecognizer: SpeechRecognizing {
  var onEvent: (@MainActor (DictationEvent) -> Void)?
  var startCount = 0
  var abortCount = 0
  var languages: [String] = []

  func start(language: String) {
    startCount += 1
    languages.append(language)
  }

  func abort() { abortCount += 1 }

  func hear(_ text: String, isFinal: Bool = false) { onEvent?(.result(text, isFinal: isFinal)) }
  func end() { onEvent?(.ended) }
  func fail() { onEvent?(.fatalError) }
}

/// Lets queued main-actor tasks run.
@MainActor
func settleVoice() async {
  for _ in 0..<30 { await Task.yield() }
}
