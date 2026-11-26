import Foundation
import RakazoCore

/// Virtual clock: sleepers wake only when the test advances time.
actor ManualClock: StreamClock {
  private struct Sleeper {
    let id: Int
    let deadline: Duration
    let continuation: CheckedContinuation<Void, Error>
  }
  private var current: Duration = .zero
  private var sleepers: [Sleeper] = []
  private var nextID = 0
  private(set) var requested: [Duration] = []

  func sleep(for duration: Duration) async throws {
    let id = nextID
    nextID += 1
    requested.append(duration)
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        if Task.isCancelled {
          continuation.resume(throwing: CancellationError())
        } else {
          sleepers.append(Sleeper(id: id, deadline: current + duration, continuation: continuation))
        }
      }
    } onCancel: {
      Task { await self.cancel(id) }
    }
  }

  private func cancel(_ id: Int) {
    guard let index = sleepers.firstIndex(where: { $0.id == id }) else { return }
    sleepers.remove(at: index).continuation.resume(throwing: CancellationError())
  }

  func advance(by duration: Duration) async {
    current += duration
    let due = sleepers.filter { $0.deadline <= current }
    sleepers.removeAll { $0.deadline <= current }
    for sleeper in due { sleeper.continuation.resume() }
    await settle()
  }

  func now() -> Duration { current }
}

func settle() async {
  for _ in 0..<200 { await Task.yield() }
  try? await Task.sleep(for: .milliseconds(5))
}

/// Scripted transport: each `open` pops the next connection script.
actor FakeStreamTransport: StreamTransport {
  enum Script {
    case status(Int)
    case fail
    case stream(AsyncThrowingStream<Data, Error>.Continuation)
  }
  private var plan: [Script] = []
  private(set) var bodies: [String] = []
  private(set) var headers: [[String: String]] = []

  func enqueue(_ script: Script) { plan.append(script) }

  /// Returns a handle used by the test to push chunks into the next connection.
  func enqueueStream() -> AsyncThrowingStream<Data, Error>.Continuation {
    let (stream, continuation) = AsyncThrowingStream<Data, Error>.makeStream()
    streams.append(stream)
    plan.append(.stream(continuation))
    return continuation
  }
  private var streams: [AsyncThrowingStream<Data, Error>] = []

  func open(_ request: HTTPRequest) async throws -> StreamResponse {
    bodies.append(String(bytes: request.body ?? Data(), encoding: .utf8) ?? "")
    headers.append(request.headers)
    guard !plan.isEmpty else { throw URLError(.cannotConnectToHost) }
    switch plan.removeFirst() {
    case .status(let code):
      return StreamResponse(statusCode: code, chunks: AsyncThrowingStream { $0.finish() })
    case .fail:
      throw URLError(.networkConnectionLost)
    case .stream:
      return StreamResponse(statusCode: 200, chunks: streams.removeFirst())
    }
  }
}

/// Polls until `condition` holds (up to 10 s of real time). Use instead of `settle()` when the
/// test waits for something that must happen, so a loaded machine only makes it slower.
func eventually(_ condition: () async -> Bool) async {
  for _ in 0..<2000 {
    if await condition() { return }
    try? await Task.sleep(for: .milliseconds(5))
  }
}

actor Recorder {
  var resyncs = 0
  func resync() { resyncs += 1 }
}
