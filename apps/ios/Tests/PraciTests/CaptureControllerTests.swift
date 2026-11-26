import AVFoundation
import Foundation
import RakazoAPI
import RakazoCore
import Testing

@testable import Praci

private struct Boom: Error {}

/// Synthetic audio pushed by the test instead of a microphone.
@MainActor
private final class ScriptedSource: AudioSource {
  var failOnStart = false
  var stopped = false
  private var sink: AudioSink?

  func start(_ sink: AudioSink) throws {
    if failOnStart { throw Boom() }
    self.sink = sink
  }

  func stop() { stopped = true }

  /// `seconds` of audio in tenths of a second: a tone, or silence.
  func push(seconds: Double, tone: Bool) {
    let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false)!
    for _ in 0..<Int(seconds * 10) {
      let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1_600)!
      buffer.frameLength = 1_600
      for index in 0..<1_600 {
        buffer.floatChannelData![0][index] = tone ? 0.3 * sin(Float(index) * 0.2) : 0
      }
      sink?.buffer(SendableBuffer(buffer: buffer))
    }
  }
}

@MainActor
private final class FakeServer: CaptureServer {
  let disk: CaptureDisk
  var who: CaptureIdentity? = CaptureIdentity(apiBase: "http://127.0.0.1:3301", userID: "user-1")
  var started: [String] = []
  var discarded: [String] = []
  var finished: [CaptureRecord] = []
  var chunksSeenByUpload = 0
  var finishError: (any Error)?
  var meeting: String? = "meeting-1"
  /// What the next upload does to the files and returns.
  var onUpload: (CaptureRecord) -> UploadOutcome = { _ in .done }
  var lostSessions = 0

  init(disk: CaptureDisk) { self.disk = disk }

  func identity() async -> CaptureIdentity? { who }
  func start(spaceID: String, clientID: String, title: String?, consentConfirmed: Bool) async throws -> String {
    started.append("cap-\(started.count + 1)")
    return started.last!
  }
  func discard(spaceID: String, captureID: String) async { discarded.append(captureID) }
  func finish(_ record: CaptureRecord) async throws {
    if let finishError { throw finishError }
    finished.append(record)
  }
  func active(spaceID: String) async throws -> ActiveCapture? { nil }
  func meetingID(spaceID: String, since: Date) async -> String? { meeting }
  func upload(_ record: CaptureRecord) async -> UploadOutcome {
    chunksSeenByUpload = max(chunksSeenByUpload, disk.chunks(record).count)
    return onUpload(record)
  }
  func sessionLost() async { lostSessions += 1 }
}

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

@MainActor
private struct Harness {
  let disk = CaptureDisk(root: FileManager.default.temporaryDirectory.appending(path: "captures-\(UUID().uuidString)"))
  let server: FakeServer
  let source = ScriptedSource()
  let controller: CaptureController

  init() {
    let disk = disk
    let server = FakeServer(disk: disk)
    let source = source
    self.server = server
    controller = CaptureController(
      server: server, disk: disk, makeSource: { source }, requestMicrophone: { true },
      retryDelay: .milliseconds(10), pollDelay: .milliseconds(10))
  }

  func records() -> [CaptureRecord] {
    disk.records(apiBase: server.who!.apiBase, userId: server.who!.userID)
  }

  /// Starts and records long enough for one chunk to be cut: 21 s of tone, then a quiet moment.
  func recordOneChunk() async throws {
    try await controller.start(spaceID: "space-1", title: "Weekly", consentConfirmed: false)
    source.push(seconds: 21, tone: true)
    source.push(seconds: 0.8, tone: false)
  }
}

@Suite(.serialized)
@MainActor
struct CaptureControllerTests {
  @Test
  func startFailureDiscardsTheServerCaptureAndLeavesNothingBehind() async {
    let harness = Harness()
    harness.source.failOnStart = true
    await #expect(throws: Boom.self) {
      try await harness.controller.start(spaceID: "space-1", title: nil, consentConfirmed: false)
    }
    #expect(harness.server.discarded == ["cap-1"])
    #expect(harness.records().isEmpty)
    #expect(harness.controller.live == nil)
    #expect(!VoiceAudio.meetingActive)
  }

  @Test
  func savedMeetingBarShowsUntilDismissed() {
    let harness = Harness()
    harness.controller.showSaved("meeting-1")
    #expect(harness.controller.savedMeetingID == "meeting-1")
    harness.controller.dismissSaved()
    #expect(harness.controller.savedMeetingID == nil)
  }

  @Test
  func stopUploadsFinishesWithLostChunksAndOpensTheMeeting() async throws {
    let harness = Harness()
    var opened: [String?] = []
    harness.controller.onStored = { opened.append($0) }
    // The real uploader counts a chunk the server refuses in record.json; do the same here.
    harness.server.onUpload = { record in
      var saved = harness.records().first { $0.captureId == record.captureId }!
      for chunk in harness.disk.chunks(saved) {
        harness.disk.removeChunk(chunk)
        saved.lostChunks += 1
      }
      try? harness.disk.save(saved)
      return .done
    }
    try await harness.recordOneChunk()
    #expect(harness.controller.isRecording)
    await harness.controller.stop()
    #expect(harness.server.chunksSeenByUpload >= 1)
    #expect(harness.server.finished.count == 1)
    #expect(harness.server.finished.first?.lostChunks ?? 0 >= 1)
    #expect(harness.server.finished.first?.stopped == true)
    #expect(opened == ["meeting-1"])
    #expect(harness.controller.storedCount == 1)
    #expect(harness.controller.live == nil)
    #expect(harness.records().isEmpty)
    #expect(harness.source.stopped)
  }

  @Test
  func anOfflineUploadKeepsTheFilesAndRetries() async throws {
    let harness = Harness()
    var attempts = 0
    harness.server.onUpload = { _ in
      attempts += 1
      return attempts < 3 ? .retryLater : .done
    }
    try await harness.recordOneChunk()
    await harness.controller.stop()
    #expect(attempts >= 3)
    #expect(harness.server.finished.count == 1)
  }

  @Test
  func aClosedCaptureShowsTheAlertAndDropsTheFiles() async throws {
    let harness = Harness()
    harness.server.onUpload = { _ in .ended(.closed) }
    try await harness.recordOneChunk()
    await harness.controller.stop()
    #expect(harness.controller.closedAlert == "This recording was closed and could not be saved.")
    #expect(harness.server.finished.isEmpty)
    #expect(harness.records().isEmpty)
    #expect(harness.controller.live == nil)
  }

  @Test
  func aMissingCaptureIsDroppedWithoutAnAlert() async throws {
    let harness = Harness()
    harness.server.onUpload = { _ in .ended(.notFound) }
    try await harness.recordOneChunk()
    await harness.controller.stop()
    #expect(harness.controller.closedAlert == nil)
    #expect(harness.records().isEmpty)
  }

  @Test
  func launchRecoveryDropsTheHalfWrittenPieceUploadsTheRestAndFinishes() async throws {
    let harness = Harness()
    let who = harness.server.who!
    let record = CaptureRecord(
      apiBase: who.apiBase, userId: who.userID, spaceId: "space-1", captureId: "left-over",
      startedAt: Date(timeIntervalSinceNow: -300), nextSeq: 2)
    try harness.disk.save(record)
    let part = try harness.disk.partURL(record, seq: 1, startMs: 30_000)
    try Data("half".utf8).write(to: part)
    await harness.controller.resume()
    #expect(!FileManager.default.fileExists(atPath: part.path))
    #expect(harness.server.finished.count == 1)
    #expect(harness.server.finished.first?.captureId == "left-over")
    #expect(harness.server.finished.first?.lostChunks == 1)
    #expect(harness.records().isEmpty)
    #expect(harness.controller.live == nil)
  }

  @Test
  func aSessionThatEndsWithoutTheSignOutHookStillStopsAndWipes() async throws {
    let harness = Harness()
    let storage = MemoryStorage()
    storage.session = StoredSession(endpoint: URL(string: "http://127.0.0.1:3301")!, token: "synthetic-token")
    let authentication = AuthenticationModel(
      client: AuthClient(
        endpoint: URL(string: "http://127.0.0.1:3301")!, storage: storage, transport: SessionEndsTransport()),
      defaults: UserDefaults(suiteName: UUID().uuidString)!)
    let app = AppModel(
      authentication: authentication, defaults: UserDefaults(suiteName: UUID().uuidString)!)
    await authentication.start()
    #expect(authentication.isSignedIn)
    harness.controller.attach(to: app)
    try await harness.recordOneChunk()
    #expect(!harness.records().isEmpty)
    // Foreground revalidation finds the session rejected; sign-out never ran.
    await authentication.revalidate()
    #expect(!authentication.isSignedIn)
    for _ in 0..<50 where harness.controller.live != nil { try await Task.sleep(for: .milliseconds(20)) }
    #expect(harness.controller.live == nil)
    #expect(harness.source.stopped)
    #expect(harness.records().isEmpty)
  }

  @Test
  func whenBackgroundTimeRunsOutTheFilesStayForTheNextLaunch() async throws {
    let harness = Harness()
    harness.server.onUpload = { _ in .retryLater }
    try await harness.recordOneChunk()
    let stopping = Task { await harness.controller.stop() }
    for _ in 0..<100 where harness.controller.live?.offline != true { try await Task.sleep(for: .milliseconds(20)) }
    harness.controller.expireBackgroundWork()
    await stopping.value
    #expect(harness.controller.live == nil)
    #expect(!harness.records().isEmpty)
    // The next foreground finishes it.
    harness.server.onUpload = { _ in .done }
    await harness.controller.resume()
    #expect(harness.server.finished.count == 1)
    #expect(harness.records().isEmpty)
  }

  @Test
  func signOutStopsTheMicrophoneAndDeletesTheRecording() async throws {
    let harness = Harness()
    let app = AppModel(
      authentication: AuthenticationModel(
        client: AuthClient(
          endpoint: URL(string: "http://127.0.0.1:3301")!, storage: MemoryStorage(),
          transport: FakeNoTransport()),
        defaults: UserDefaults(suiteName: UUID().uuidString)!),
      defaults: UserDefaults(suiteName: UUID().uuidString)!)
    var earlier = false
    app.authentication.beforeSessionEnds = { earlier = true }
    harness.controller.attach(to: app)
    try await harness.recordOneChunk()
    #expect(!harness.records().isEmpty)
    await app.authentication.beforeSessionEnds?()
    #expect(earlier)
    #expect(harness.source.stopped)
    #expect(harness.controller.live == nil)
    #expect(harness.records().isEmpty)
    #expect(!VoiceAudio.meetingActive)
  }
}

private struct FakeNoTransport: HTTPTransport {
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    HTTPResponse(statusCode: 500)
  }
}

/// Answers get-session once, then rejects the session.
private actor SessionEndsTransport: HTTPTransport {
  private var sessionChecks = 0

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    guard request.url.path.contains("get-session") else { return HTTPResponse(statusCode: 500) }
    sessionChecks += 1
    return sessionChecks == 1
      ? HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
      : HTTPResponse(statusCode: 401)
  }
}
