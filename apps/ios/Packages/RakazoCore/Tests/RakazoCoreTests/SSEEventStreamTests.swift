import Foundation
import RakazoCore
import Testing

private struct TestEvent: SequencedEvent, Equatable {
  let seq: Int
  let type: String
}

private struct Input: Encodable {
  let botId: String
  let cursor: Int
}

private func message(_ seq: Int, type: String = "thread.progress") -> Data {
  Data("event: message\ndata: {\"json\":{\"seq\":\(seq),\"type\":\"\(type)\"}}\n\n".utf8)
}

private struct Harness {
  let transport = FakeStreamTransport()
  let clock = ManualClock()
  let recorder = Recorder()
  let stream: EventStream<TestEvent>

  init() async throws {
    let auth = try await signedInClient(FakeTransport([rpcResponse(#"{"user":{"id":"u1"}}"#)]))
    let transport = transport
    let clock = clock
    let recorder = recorder
    stream = EventStream(
      auth: auth, procedure: "threads/subscribe", transport: transport, clock: clock,
      input: { Input(botId: "bot-1", cursor: $0) },
      resync: { await recorder.resync() })
  }

  /// Collects events in the background so tests can interleave pushes and clock advances.
  func collect(after cursor: Int = 10) -> Collector {
    let collector = Collector()
    let events = stream.events(after: cursor)
    collector.task = Task {
      do {
        for try await event in events { await collector.add(event) }
        await collector.finish(nil)
      } catch {
        await collector.finish(error)
      }
    }
    return collector
  }
}

actor Collector {
  private(set) var seqs: [Int] = []
  private(set) var finished = false
  private(set) var error: (any Error)?
  nonisolated(unsafe) var task: Task<Void, Never>?
  func add(_ event: some SequencedEvent) { seqs.append(event.seq) }
  func finish(_ error: (any Error)?) {
    finished = true
    self.error = error
  }
}

@Test
func sendsAuthorizedSSERequestWithCursor() async throws {
  let harness = try await Harness()
  let live = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  let body = await harness.transport.bodies.first
  #expect(body?.contains(#""cursor":10"#) == true)
  let headers = await harness.transport.headers.first
  #expect(headers?["accept"] == "text/event-stream")
  #expect(headers?["authorization"] == "Bearer tok-1")
  live.yield(message(11))
  await settle()
  #expect(await collector.seqs == [11])
  collector.task?.cancel()
}

@Test
func heartbeatsAreSwallowedAndNeverAdvanceTheCursor() async throws {
  let harness = try await Harness()
  let first = await harness.transport.enqueueStream()
  let second = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  first.yield(message(0, type: "heartbeat"))
  first.yield(message(12))
  first.yield(message(0, type: "heartbeat"))
  first.yield(message(11))
  await settle()
  #expect(await collector.seqs == [12, 11])
  first.finish()
  await settle()
  await harness.clock.advance(by: .milliseconds(250))
  // Reconnects from the highest seq seen, not the last one delivered or the heartbeat.
  let bodies = await harness.transport.bodies
  #expect(bodies.last?.contains(#""cursor":12"#) == true)
  _ = second
  collector.task?.cancel()
}

@Test
func resyncRunsBeforeEachResubscribeWithDoublingBackoffCappedAtFiveSeconds() async throws {
  let harness = try await Harness()
  let collector = harness.collect()
  await settle()
  // Each open fails (empty script), so backoff doubles: 250ms ... 5s, then stays at 5s.
  let waits: [Duration] = [
    .milliseconds(250), .milliseconds(500), .seconds(1), .seconds(2), .seconds(4), .seconds(5),
    .seconds(5),
  ]
  for wait in waits {
    #expect(await harness.clock.requested.last == wait)
    await harness.clock.advance(by: wait)
  }
  #expect(await harness.recorder.resyncs == waits.count + 1)
  #expect(await harness.transport.bodies.count == waits.count + 1)
  collector.task?.cancel()
}

@Test
func backoffResetsAfterAnEventIsDelivered() async throws {
  let harness = try await Harness()
  await harness.transport.enqueue(.fail)
  let live = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  await harness.clock.advance(by: .milliseconds(250))
  live.yield(message(11))
  await settle()
  live.finish()
  await settle()
  // The failed open doubled the delay to 500ms, but delivery reset it, so this wait is 250ms.
  let requested = await harness.clock.requested
  #expect(requested.filter { $0 != .seconds(45) } == [.milliseconds(250), .milliseconds(250)])
  collector.task?.cancel()
}

@Test
func silentStreamIsAbandonedAfterFortyFiveSecondsAndHeartbeatKeepsItAlive() async throws {
  let harness = try await Harness()
  let first = await harness.transport.enqueueStream()
  _ = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  for _ in 0..<3 {
    await harness.clock.advance(by: .seconds(40))
    first.yield(message(0, type: "heartbeat"))
    await settle()
  }
  #expect(await harness.transport.bodies.count == 1)
  #expect(await harness.recorder.resyncs == 0)
  // Now go quiet for a full window.
  await harness.clock.advance(by: .seconds(45))
  await settle()
  #expect(await harness.recorder.resyncs == 1)
  await harness.clock.advance(by: .milliseconds(250))
  #expect(await harness.transport.bodies.count == 2)
  collector.task?.cancel()
}

@Test
func errorFrameWithStatus401EndsTheStreamAsUnauthorized() async throws {
  let harness = try await Harness()
  let live = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  live.yield(message(11))
  live.yield(
    Data(
      #"event: error\#ndata: {"json":{"defined":false,"code":"UNAUTHORIZED","status":401,"message":"x"}}\#n\#n"#
        .utf8))
  await eventually { await collector.finished }
  #expect(await collector.finished)
  #expect((await collector.error as? RPCError) == .unauthorized)
  #expect(await harness.recorder.resyncs == 0)
  #expect(await harness.transport.bodies.count == 1)
}

@Test
func http401OnOpenEndsTheStreamAsUnauthorized() async throws {
  let harness = try await Harness()
  await harness.transport.enqueue(.status(401))
  let collector = harness.collect()
  await eventually { await collector.finished }
  #expect((await collector.error as? RPCError) == .unauthorized)
}

@Test
func otherErrorFramesDoneAndServerErrorsReconnect() async throws {
  let harness = try await Harness()
  await harness.transport.enqueue(.status(500))
  let first = await harness.transport.enqueueStream()
  let second = await harness.transport.enqueueStream()
  _ = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  await harness.clock.advance(by: .milliseconds(250))
  first.yield(Data(#"event: error\#ndata: {"json":{"status":500,"code":"INTERNAL"}}\#n\#n"#.utf8))
  await settle()
  await harness.clock.advance(by: .milliseconds(500))
  second.yield(Data("event: done\ndata: \n\n".utf8))
  await settle()
  await harness.clock.advance(by: .seconds(1))
  #expect(await harness.transport.bodies.count == 4)
  #expect(await harness.recorder.resyncs == 3)
  #expect(await !collector.finished)
  collector.task?.cancel()
}

@Test
func cancellingTheConsumerStopsReconnectingWithoutAnotherRequest() async throws {
  let harness = try await Harness()
  let live = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  live.finish()
  await settle()
  collector.task?.cancel()
  await settle()
  await harness.clock.advance(by: .seconds(10))
  #expect(await harness.transport.bodies.count == 1)
  #expect(await collector.finished)
  #expect(await collector.error == nil)
}

@Test
func undecodableFramesAreSkippedWithoutDroppingTheStream() async throws {
  let harness = try await Harness()
  let live = await harness.transport.enqueueStream()
  let collector = harness.collect()
  await settle()
  live.yield(Data("event: message\ndata: not json\n\n".utf8))
  live.yield(message(11))
  await settle()
  #expect(await collector.seqs == [11])
  #expect(await harness.recorder.resyncs == 0)
  collector.task?.cancel()
}
