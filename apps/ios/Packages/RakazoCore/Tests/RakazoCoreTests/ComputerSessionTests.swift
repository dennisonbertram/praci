import Foundation
import RakazoAPI
import Synchronization
import Testing

@testable import RakazoCore

/// Sleepers wait until the test advances time.
private final class StepClock: ComputerClock {
  private struct State {
    var now = 1_710_000_000_000
    var sleepers: [Int: CheckedContinuation<Void, Error>] = [:]
    var nextID = 0
    var durations: [Duration] = []
  }
  private let state = Mutex(State())

  func nowMs() -> Int { state.withLock { $0.now } }

  func sleep(_ duration: Duration) async throws {
    let id = state.withLock { box -> Int in
      box.nextID += 1
      box.durations.append(duration)
      return box.nextID
    }
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        let cancelled = state.withLock { box -> Bool in
          if Task.isCancelled { return true }
          box.sleepers[id] = continuation
          return false
        }
        if cancelled { continuation.resume(throwing: CancellationError()) }
      }
    } onCancel: {
      let sleeper = state.withLock { $0.sleepers.removeValue(forKey: id) }
      sleeper?.resume(throwing: CancellationError())
    }
  }

  var sleeperCount: Int { state.withLock { $0.sleepers.count } }
  var durations: [Duration] { state.withLock { $0.durations } }

  /// Moves time forward and wakes every sleeper once.
  func advance(ms milliseconds: Int) async {
    let woken = state.withLock { box -> [CheckedContinuation<Void, Error>] in
      box.now += milliseconds
      let all = Array(box.sleepers.values)
      box.sleepers = [:]
      return all
    }
    woken.forEach { $0.resume() }
  }
}

@MainActor
private final class Harness {
  let clock = StepClock()
  var status = ComputerStatus(botId: "b")
  var url: String? = "https://app.example/novnc/session/view/1710003600000.tok/embed.html"
  var statusReads = 0
  var screenReads = 0
  var pings = 0
  var statuses: [ComputerStatus] = []
  var screens: [String?] = []
  lazy var session = ComputerSession(
    hooks: .init(
      readStatus: { [unowned self] in statusReads += 1; return status },
      readScreen: { [unowned self] _ in screenReads += 1; return url },
      heartbeat: { [unowned self] in pings += 1 },
      onStatus: { [unowned self] in statuses.append($0) },
      onScreen: { [unowned self] in screens.append($0) }),
    clock: clock)

  /// Lets queued tasks run until `condition` holds.
  func settle(_ condition: () -> Bool) async {
    for _ in 0..<200 where !condition() { await Task.yield() }
  }

  /// Waits for a poll or heartbeat task to be sleeping, then advances time.
  func tick(ms milliseconds: Int, sleepers: Int = 1) async {
    await settle { clock.sleeperCount >= sleepers }
    await clock.advance(ms: milliseconds)
  }
}

@MainActor @Test func startReadsStatusAndScreenOnce() async throws {
  let harness = Harness()
  try await harness.session.start()
  #expect(harness.statusReads == 1 && harness.screenReads == 1)
  #expect(harness.screens == [harness.url])
  harness.session.stop()
}

@MainActor @Test func pollsStatusEveryTwoSecondsWithoutRereadingTheScreen() async throws {
  let harness = Harness()
  try await harness.session.start()
  await harness.tick(ms: 2000)
  await harness.settle { harness.statusReads == 2 }
  await harness.tick(ms: 2000)
  await harness.settle { harness.statusReads == 3 }
  #expect(harness.statusReads == 3)
  #expect(harness.screenReads == 1)
  #expect(harness.clock.durations.allSatisfy { $0 == .seconds(2) || $0 == .seconds(60) })
  harness.session.stop()
}

@MainActor @Test func rereadsTheScreenWhenTheStatusThatShapesItChanges() async throws {
  let harness = Harness()
  try await harness.session.start()
  harness.status = ComputerStatus(botId: "b", controlHolder: .user, controlBotId: "b")
  await harness.tick(ms: 2000)
  await harness.settle { harness.screenReads == 2 }
  #expect(harness.screenReads == 2)
  harness.session.stop()
}

@MainActor @Test func renewsTheScreenAtFiftyMinutesWithoutAStatusChange() async throws {
  let harness = Harness()
  harness.url = "https://sandbox.example/stream?authKey=one&view_only=true"
  try await harness.session.start()
  await harness.tick(ms: 49 * 60_000)
  await harness.settle { harness.statusReads == 2 }
  #expect(harness.screenReads == 1)
  await harness.tick(ms: 60_000)
  await harness.settle { harness.screenReads == 2 }
  #expect(harness.screenReads == 2)
  harness.session.stop()
}

@MainActor @Test func aReusedSealRenewsFromItsOwnIssueTime() async throws {
  let harness = Harness()
  // Issued at the clock's start (expiry minus one hour), so renewal is due 50 minutes later.
  try await harness.session.start()
  await harness.tick(ms: 51 * 60_000)
  await harness.settle { harness.screenReads == 2 }
  #expect(harness.screenReads == 2)
  harness.session.stop()
}

@MainActor @Test func aFailedScreenReadKeepsTheLastUrlAndNullClearsIt() async throws {
  let harness = Harness()
  try await harness.session.start()
  harness.session.invalidateScreen()
  harness.url = nil
  await harness.tick(ms: 2000)
  await harness.settle { harness.screens.count == 2 }
  #expect(harness.screens.last == .some(nil))
  harness.session.stop()
}

@MainActor @Test func heartbeatPingsAtOnceThenEverySixtySecondsWhileRunning() async throws {
  let harness = Harness()
  try await harness.session.start()
  await harness.settle { harness.pings == 1 }
  await harness.tick(ms: 60_000, sleepers: 2)
  await harness.settle { harness.pings == 2 }
  #expect(harness.pings == 2)
  #expect(harness.clock.durations.contains(.seconds(60)))
  harness.status = ComputerStatus(botId: "b", state: .stopped)
  await harness.tick(ms: 2000, sleepers: 2)
  await harness.settle { harness.statuses.last?.state == .stopped }
  #expect(harness.statuses.last?.state == .stopped)
  let before = harness.pings
  await harness.clock.advance(ms: 120_000)
  for _ in 0..<20 { await Task.yield() }
  #expect(harness.pings == before)
  harness.session.stop()
}

@MainActor @Test func stopEndsPollingAndHeartbeats() async throws {
  let harness = Harness()
  try await harness.session.start()
  await harness.settle { harness.pings == 1 }
  harness.session.stop()
  await harness.clock.advance(ms: 120_000)
  for _ in 0..<50 { await Task.yield() }
  #expect(harness.statusReads == 1 && harness.pings == 1)
  #expect(!harness.session.isActive)
}

@MainActor @Test func performPausesPollingAndRefreshesAfterTheAction() async throws {
  let harness = Harness()
  try await harness.session.start()
  var ran = false
  let result = try await harness.session.perform {
    ran = true
    return 7
  }
  #expect(result == 7 && ran)
  #expect(harness.statusReads == 2 && harness.screenReads == 2)
  // Polling resumes afterwards.
  await harness.tick(ms: 2000)
  await harness.settle { harness.statusReads == 3 }
  #expect(harness.statusReads == 3)
  harness.session.stop()
}

@MainActor @Test func performDoesNotRefreshWhenTheActionThrows() async throws {
  struct Denied: Error {}
  let harness = Harness()
  try await harness.session.start()
  await #expect(throws: Denied.self) {
    _ = try await harness.session.perform { throw Denied() }
  }
  #expect(harness.statusReads == 1)
  harness.session.stop()
}
