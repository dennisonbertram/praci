import Foundation
import Observation
import RakazoAPI
import RakazoCore
import UIKit

struct CaptureIdentity: Equatable {
  let apiBase: String
  let userID: String
}

/// How finishing a capture failed in a way that retrying cannot fix.
enum CaptureFinishError: Error { case refused, signedOut }

/// A message to show when a recording cannot start.
struct CaptureError: LocalizedError {
  let errorDescription: String?
  init(_ message: String) { errorDescription = message }
}

/// What the controller needs from the server. The app's implementation is `AppCaptureServer`.
@MainActor
protocol CaptureServer {
  /// The confirmed signed-in user; nil while offline or signed out.
  func identity() async -> CaptureIdentity?
  func start(spaceID: String, clientID: String, title: String?, consentConfirmed: Bool) async throws -> String
  func discard(spaceID: String, captureID: String) async
  func finish(_ record: CaptureRecord) async throws
  func active(spaceID: String) async throws -> ActiveCapture?
  /// The stored meeting made from a recording that started at `since`.
  func meetingID(spaceID: String, since: Date) async -> String?
  func upload(_ record: CaptureRecord) async -> UploadOutcome
  /// The session was rejected while uploading.
  func sessionLost() async
}

/// Owns the recording on this phone from Record to a stored meeting: start, chunk uploads, Stop,
/// finish, and picking up recordings an earlier launch left behind. The web twin is
/// `apps/web/src/lib/meeting-capture/controller.ts`.
@MainActor
@Observable
final class CaptureController {
  struct Live: Equatable {
    let captureID: String
    let title: String?
    let startedAt: Date
    /// Chunks are waiting on this phone because an upload failed.
    var offline = false
    /// Stop was pressed (or a recovered recording is being stored).
    var transcribing = false
  }

  static let closedMessage = "This recording was closed and could not be saved."
  static let runningMessage = "A recording is already running."

  private(set) var live: Live?
  private(set) var starting = false
  /// Grows each time a recording becomes a stored meeting, so lists know to reload.
  private(set) var storedCount = 0
  /// A stored meeting the user has not been taken to; the bar offers Open for a few seconds.
  private(set) var savedMeetingID: String?
  @ObservationIgnored private var savedTask: Task<Void, Never>?
  /// Set when the server closed the recording; shown as an alert.
  var closedAlert: String?

  var isRecording: Bool { live.map { !$0.transcribing } ?? false }
  var isBusy: Bool { starting || live != nil }

  @ObservationIgnored private let server: any CaptureServer
  @ObservationIgnored private let disk: CaptureDisk
  @ObservationIgnored private let makeSource: () -> any AudioSource
  @ObservationIgnored private let requestMicrophone: () async -> Bool
  @ObservationIgnored private let retryDelay: Duration
  @ObservationIgnored private let pollDelay: Duration
  @ObservationIgnored var onStored: (String?) -> Void = { _ in }
  @ObservationIgnored private var identity: CaptureIdentity?
  @ObservationIgnored private var recorder: MeetingRecorder?
  @ObservationIgnored private var uploading: Task<Void, Never>?
  @ObservationIgnored private var retrying: Task<Void, Never>?
  @ObservationIgnored private var recovering = false
  /// Grows when a recording ends or is abandoned, so anything still waiting knows it is out of date.
  @ObservationIgnored private var epoch = 0

  init(
    server: any CaptureServer, disk: CaptureDisk = CaptureDisk(root: CaptureDisk.standardRoot()),
    makeSource: @escaping () -> any AudioSource = { MicrophoneSource() },
    requestMicrophone: @escaping () async -> Bool = { await VoiceAudio.requestMicrophone() },
    retryDelay: Duration = .seconds(ChunkUploader.retryDelay), pollDelay: Duration = .seconds(2)
  ) {
    self.server = server
    self.disk = disk
    self.makeSource = makeSource
    self.requestMicrophone = requestMicrophone
    self.retryDelay = retryDelay
    self.pollDelay = pollDelay
  }

  /// The app's controller. Debug builds launched with `-captureFixture <name>` record a bundled
  /// file instead of the microphone.
  convenience init(app: AppModel) {
    var source: () -> any AudioSource = { MicrophoneSource() }
    var permission: () async -> Bool = { await VoiceAudio.requestMicrophone() }
    #if DEBUG
      if let fixture = FileAudioSource.fromLaunchArguments() {
        source = { fixture }
        permission = { true }
      }
    #endif
    self.init(server: AppCaptureServer(app: app), makeSource: source, requestMicrophone: permission)
    attach(to: app)
  }

  /// Opens a stored meeting when the list is on screen, and stops and wipes a recording before the
  /// session ends (sign-out, server change, account deletion), after the hooks already set.
  func attach(to app: AppModel) {
    onStored = { [weak self] id in
      guard let id else { return }
      if app.path.last == .meetings { app.open(.meeting(id: id)) } else { self?.showSaved(id) }
    }
    watchSignIn(app)
    let previous = app.authentication.beforeSessionEnds
    app.authentication.beforeSessionEnds = { [weak self] in
      await previous?()
      self?.sessionEnding(apiBase: app.authentication.endpoint.absoluteString, userID: app.userID)
    }
  }

  func showSaved(_ id: String) {
    savedMeetingID = id
    savedTask?.cancel()
    savedTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(6))
      if !Task.isCancelled { self?.savedMeetingID = nil }
    }
  }

  func dismissSaved() {
    savedTask?.cancel()
    savedMeetingID = nil
  }

  /// Any change to signed-out (revalidation, an expired token, a rejected upload) ends the
  /// recording and wipes its files, the same as sign-out does.
  private func watchSignIn(_ app: AppModel) {
    withObservationTracking {
      _ = app.authentication.isSignedIn
    } onChange: { [weak self] in
      Task { @MainActor in
        guard let self else { return }
        if !app.authentication.isSignedIn {
          self.sessionEnding(apiBase: app.authentication.endpoint.absoluteString, userID: app.userID)
        }
        self.watchSignIn(app)
      }
    }
  }

  // MARK: Start

  /// Starts recording in `spaceID`. Throws a readable message when it cannot; nothing is left behind then.
  func start(spaceID: String, title: String?, consentConfirmed: Bool) async throws {
    guard !isBusy, !recovering else { throw CaptureError(Self.runningMessage) }
    starting = true
    defer { starting = false }
    let started = epoch
    guard let who = await server.identity() else { throw CaptureError("You were signed out.") }
    guard await requestMicrophone() else { throw CaptureError(VoiceAudio.meetingMicDenied) }
    let clientID = UUID().uuidString
    let captureID = try await server.start(
      spaceID: spaceID, clientID: clientID, title: title, consentConfirmed: consentConfirmed)
    let record = CaptureRecord(
      apiBase: who.apiBase, userId: who.userID, spaceId: spaceID, captureId: captureID,
      title: title, startedAt: Date())
    do {
      if epoch != started { throw CaptureError("You were signed out.") }
      try disk.save(record)
      let next = MeetingRecorder(
        record: record, disk: disk, source: makeSource(),
        onChunk: { [weak self] in self?.pump() },
        onFailure: { [weak self] in Task { await self?.stop() } })
      try next.start()
      recorder = next
    } catch {
      disk.remove(record)
      await server.discard(spaceID: spaceID, captureID: captureID)
      throw error
    }
    identity = who
    VoiceAudio.meetingActive = true
    live = Live(captureID: captureID, title: title, startedAt: record.startedAt)
  }

  // MARK: Stop

  /// Stops recording, uploads what is left, tells the server the recording is over and waits for
  /// the stored meeting.
  func stop() async {
    guard var current = live, !current.transcribing, let who = identity else { return }
    current.transcribing = true
    live = current
    recorder?.stop()
    recorder = nil
    retrying?.cancel()
    await uploading?.value
    guard var record = stored(current.captureID, who) else { return endRecording() }
    record.stopped = true
    try? disk.save(record)
    await finishFlow(record, who)
  }

  // MARK: Recovery

  /// A launch or foreground after a crash or a kill: for each recording this user left on the
  /// phone, throw away the half-written piece, upload the rest and finish it.
  func resume() async {
    if live != nil {
      pump()
      return
    }
    guard !isBusy, !recovering else { return }
    recovering = true
    defer { recovering = false }
    guard let who = await server.identity() else { return }
    identity = who
    let started = epoch
    for found in disk.records(apiBase: who.apiBase, userId: who.userID) {
      guard epoch == started, live == nil else { return }
      var record = (try? disk.recover(found)) ?? found
      record.stopped = true
      try? disk.save(record)
      live = Live(
        captureID: record.captureId, title: record.title, startedAt: record.startedAt, transcribing: true)
      VoiceAudio.meetingActive = true
      await finishFlow(record, who)
    }
  }

  /// Background time ran out: stop working on this recording but keep its files for `resume`.
  func expireBackgroundWork() { endRecording() }

  // MARK: Sign-out

  /// Stops the microphone and deletes everything this user recorded on the phone.
  func sessionEnding(apiBase: String, userID: String?) {
    let who = identity
    abandon()
    if let who { disk.wipe(apiBase: who.apiBase, userId: who.userID) }
    if let userID { disk.wipe(apiBase: apiBase, userId: userID) }
  }

  // MARK: Uploads

  /// One upload pass at a time, started when a chunk is closed and again after a failed pass.
  private func pump() {
    guard uploading == nil, let current = live, !current.transcribing, let who = identity,
      let record = stored(current.captureID, who)
    else { return }
    let started = epoch
    uploading = Task {
      let outcome = await server.upload(record)
      uploading = nil
      guard epoch == started, live?.captureID == record.captureId else { return }
      switch outcome {
      case .done:
        live?.offline = false
      case .retryLater, .unauthorized(.stale):
        live?.offline = true
        retrying = Task {
          try? await Task.sleep(for: retryDelay)
          if !Task.isCancelled { pump() }
        }
      case .ended(let reason):
        closeAsFailed(record, alert: reason == .closed)
      case .unauthorized(.ended):
        await server.sessionLost()
        sessionEnding(apiBase: record.apiBase, userID: record.userId)
      }
    }
  }

  // swiftlint:disable:next cyclomatic_complexity
  private func finishFlow(_ first: CaptureRecord, _ who: CaptureIdentity) async {
    let started = epoch
    // Background time covers the uploads and finish only; when it runs out, what is left stays on
    // disk and the next foreground or launch picks it up (`resume`).
    let window = BackgroundWindow()
    window.begin { [weak self] in
      if self?.epoch == started { self?.expireBackgroundWork() }
    }
    defer { window.end() }
    while epoch == started {
      guard let record = stored(first.captureId, who) else { return endRecording() }
      let outcome = await server.upload(record)
      guard epoch == started else { return }
      switch outcome {
      case .done:
        // The uploader saves chunks it dropped to disk, so read the record again for the count.
        let fresh = stored(first.captureId, who) ?? record
        do {
          try await server.finish(fresh)
          live?.offline = false
          window.end()
          return await waitForStored(fresh, started)
        } catch CaptureFinishError.refused {
          return closeAsFailed(fresh, alert: true)
        } catch CaptureFinishError.signedOut {
          return sessionEnding(apiBase: fresh.apiBase, userID: fresh.userId)
        } catch {
          live?.offline = true
        }
      case .retryLater, .unauthorized(.stale):
        live?.offline = true
      case .ended(let reason):
        return closeAsFailed(record, alert: reason == .closed)
      case .unauthorized(.ended):
        await server.sessionLost()
        return sessionEnding(apiBase: record.apiBase, userID: record.userId)
      }
      try? await Task.sleep(for: retryDelay)
    }
  }

  /// Polls until the server no longer lists the capture, then looks for its meeting.
  private func waitForStored(_ record: CaptureRecord, _ started: Int) async {
    while epoch == started {
      try? await Task.sleep(for: pollDelay)
      guard epoch == started else { return }
      let active: ActiveCapture?
      do { active = try await server.active(spaceID: record.spaceId) } catch { continue }
      // ponytail: `active` names only the newest open capture; an older one counts as stored once a newer one is open.
      if active?.captureId == record.captureId { continue }
      let meeting = await server.meetingID(
        spaceID: record.spaceId, since: record.startedAt.addingTimeInterval(-60))
      guard epoch == started else { return }
      disk.remove(record)
      storedCount += 1
      endRecording()
      onStored(meeting)
      return
    }
  }

  // MARK: Ending

  /// The server will not take this recording: forget it, and say so unless it was simply gone.
  private func closeAsFailed(_ record: CaptureRecord, alert: Bool) {
    recorder?.stop()
    disk.remove(record)
    endRecording()
    if alert { closedAlert = Self.closedMessage }
  }

  /// The microphone off and nothing in flight.
  private func abandon() {
    recorder?.stop()
    endRecording()
  }

  private func endRecording() {
    recorder = nil
    retrying?.cancel()
    retrying = nil
    uploading?.cancel()
    uploading = nil
    live = nil
    epoch += 1
    VoiceAudio.meetingActive = false
  }

  private func stored(_ captureID: String, _ who: CaptureIdentity) -> CaptureRecord? {
    disk.records(apiBase: who.apiBase, userId: who.userID).first { $0.captureId == captureID }
  }
}

/// One `beginBackgroundTask` assertion that ends itself when the system's time is up.
@MainActor
private final class BackgroundWindow {
  private var identifier = UIBackgroundTaskIdentifier.invalid

  func begin(onExpire: @escaping @MainActor () -> Void) {
    identifier = UIApplication.shared.beginBackgroundTask(withName: "meeting-finish") { [weak self] in
      onExpire()
      self?.end()
    }
  }

  func end() {
    guard identifier != .invalid else { return }
    UIApplication.shared.endBackgroundTask(identifier)
    identifier = .invalid
  }
}
