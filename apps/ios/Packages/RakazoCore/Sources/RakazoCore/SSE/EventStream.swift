import Foundation
import RakazoAPI
import Synchronization

/// An event with a durable, increasing sequence number. `seq <= 0` marks a heartbeat, which
/// proves the connection is alive but never advances the cursor and is not delivered.
public protocol SequencedEvent: Decodable, Sendable {
  var seq: Int { get }
}

private struct ErrorFrameBody: Decodable {
  struct Inner: Decodable {
    let status: Int?
    let code: String?
  }
  let json: Inner
}

/// Small lock-protected box; `Mutex` itself is noncopyable and cannot be captured and shared.
final class Locked<Value: Sendable>: Sendable {
  private let mutex: Mutex<Value>
  init(_ value: Value) { mutex = Mutex(value) }
  func withLock<R>(_ body: (inout Value) -> R) -> R { mutex.withLock { body(&$0) } }
}

/// A resumable subscription to one oRPC SSE procedure (for example `threads/subscribe`).
///
/// On every drop (clean `done`, error frame, failed open, transport error, or 45 s of
/// silence) it runs `resync`, waits with backoff, then reopens from the highest `seq` seen.
/// An error frame or response with status 401 ends the stream with an `RPCError`.
public struct EventStream<Event: SequencedEvent>: Sendable {
  public static var idleTimeout: Duration { .seconds(45) }
  public static var initialBackoff: Duration { .milliseconds(250) }
  public static var maximumBackoff: Duration { .seconds(5) }

  private let auth: AuthClient
  private let transport: any StreamTransport
  private let clock: any StreamClock
  private let procedure: String
  private let spaceID: String?
  private let body: @Sendable (Int) throws -> Data
  private let resync: @Sendable () async -> Void

  /// - Parameters:
  ///   - input: builds the procedure input for a cursor, for example `{botId, cursor}`.
  ///   - resync: refetches the snapshot after a drop; failures are the callback's to absorb.
  public init<Input: Encodable & Sendable>(
    auth: AuthClient,
    procedure: String,
    spaceID: String? = nil,
    transport: any StreamTransport = URLSessionStreamTransport(),
    clock: any StreamClock = SystemStreamClock(),
    input: @escaping @Sendable (Int) -> Input,
    resync: @escaping @Sendable () async -> Void
  ) {
    self.auth = auth
    self.procedure = procedure
    self.spaceID = spaceID
    self.transport = transport
    self.clock = clock
    self.body = { try JSONEncoder().encode(RPCRequest(json: input($0))) }
    self.resync = resync
  }

  /// Events after `cursor`. Cancelling the consuming task ends the stream.
  public func events(after cursor: Int) -> AsyncThrowingStream<Event, Error> {
    AsyncThrowingStream { continuation in
      let task = Task {
        do {
          try await run(from: cursor, continuation)
          continuation.finish()
        } catch {
          continuation.finish(throwing: error)
        }
      }
      continuation.onTermination = { _ in task.cancel() }
    }
  }

  private func run(
    from start: Int, _ out: AsyncThrowingStream<Event, Error>.Continuation
  ) async throws {
    let cursor = Locked(start)
    let backoff = Locked(Self.initialBackoff)
    while !Task.isCancelled {
      do {
        try await connect(cursor, out) { backoff.withLock { $0 = Self.initialBackoff } }
      } catch is CancellationError {
        return
      } catch let error as RPCError {
        throw error
      } catch {
        // Transient failure: fall through to resync and reconnect.
      }
      if Task.isCancelled { return }
      await resync()
      let wait = backoff.withLock { current in
        defer { current = min(current * 2, Self.maximumBackoff) }
        return current
      }
      do { try await clock.sleep(for: wait) } catch { return }
    }
  }

  /// Runs one connection until it drops. Throws `RPCError` only for a 401.
  private func connect(
    _ cursor: Locked<Int>, _ out: AsyncThrowingStream<Event, Error>.Continuation,
    delivered: @escaping @Sendable () -> Void
  ) async throws {
    let sent: AuthorizedRequest
    do {
      sent = try await auth.authorized(
        path: "/rpc/\(procedure)", method: "POST", body: try body(cursor.withLock { $0 }),
        contentType: "application/json", spaceID: spaceID, timeout: 30)
    } catch AuthClientError.unauthorized {
      throw RPCError.unauthorized
    }
    var headers = sent.request.headers
    headers["accept"] = "text/event-stream"
    let request = HTTPRequest(
      url: sent.request.url, method: "POST", headers: headers, body: sent.request.body,
      timeout: sent.request.timeout)
    let response = try await transport.open(request)
    if response.statusCode == 401 {
      throw await auth.handleUnauthorized(generation: sent.generation, hadSpace: sent.hadSpace)
    }
    guard (200..<300).contains(response.statusCode) else { return }

    // The reader stamps `lastChunk` per chunk; the watchdog ends the connection once a whole
    // idle window has passed since the latest stamp.
    let clock = clock
    let lastChunk = Locked(await clock.now())
    try await withThrowingTaskGroup(of: Void.self) { group in
      group.addTask {
        var parser = SSEParser()
        for try await chunk in response.chunks {
          let stamp = await clock.now()
          lastChunk.withLock { $0 = stamp }
          for frame in parser.feed(chunk) {
            switch frame.event {
            case "message":
              delivered()
              guard
                let event = try? JSONDecoder().decode(
                  RPCEnvelope<Event>.self, from: Data(frame.data.utf8)
                ).json
              else { continue }
              guard event.seq > 0 else { continue }
              cursor.withLock { $0 = max($0, event.seq) }
              out.yield(event)
            case "done":
              return
            case "error":
              if Self.isUnauthorized(frame.data) {
                throw await auth.handleUnauthorized(
                  generation: sent.generation, hadSpace: sent.hadSpace)
              }
              return
            default:
              continue
            }
          }
        }
      }
      group.addTask {
        while true {
          let idle = await clock.now() - lastChunk.withLock { $0 }
          if idle >= Self.idleTimeout { return }
          try await clock.sleep(for: Self.idleTimeout - idle)
        }
      }
      defer { group.cancelAll() }
      try await group.next()
    }
  }

  private static func isUnauthorized(_ data: String) -> Bool {
    guard let body = try? JSONDecoder().decode(ErrorFrameBody.self, from: Data(data.utf8)) else {
      return false
    }
    return body.json.status == 401 || body.json.code == "UNAUTHORIZED"
  }
}
