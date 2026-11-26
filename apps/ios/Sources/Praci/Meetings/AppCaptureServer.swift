import Foundation
import RakazoAPI
import RakazoCore

private struct StartInput: Encodable, Sendable {
  var clientId: String
  var title: String?
  var engine = "server"
  var tracks = [CaptureDisk.track]
  var consentConfirmed: Bool?
}

private struct CaptureIDInput: Encodable, Sendable { let captureId: String }
private struct FinishInput: Encodable, Sendable {
  var captureId: String
  var endedAt: String
  var lostChunks: Int?
}
private struct NoInput: Encodable, Sendable {}

/// The controller's server calls, made with the app's session. Every call names the recording's
/// own space, so changing the active space never moves a recording.
@MainActor
struct AppCaptureServer: CaptureServer {
  let app: AppModel

  func identity() async -> CaptureIdentity? {
    if !app.userConfirmed { await app.confirmUser() }
    guard app.userConfirmed, let user = app.userID else { return nil }
    return CaptureIdentity(apiBase: app.authentication.endpoint.absoluteString, userID: user)
  }

  func start(spaceID: String, clientID: String, title: String?, consentConfirmed: Bool) async throws -> String {
    let input = StartInput(
      clientId: clientID, title: title, consentConfirmed: consentConfirmed ? true : nil)
    let started: CaptureStarted = try await app.call(
      "meetingCaptures/start", input: input, spaceID: spaceID, timeout: 20)
    return started.captureId
  }

  func discard(spaceID: String, captureID: String) async {
    let _: OKResult? = try? await app.call(
      "meetingCaptures/discard", input: CaptureIDInput(captureId: captureID), spaceID: spaceID)
  }

  func finish(_ record: CaptureRecord) async throws {
    let input = FinishInput(
      captureId: record.captureId, endedAt: Date.now.formatted(.iso8601),
      lostChunks: record.lostChunks > 0 ? record.lostChunks : nil)
    do {
      let _: OKResult = try await app.call(
        "meetingCaptures/finish", input: input, spaceID: record.spaceId, timeout: 20)
    } catch RPCError.notSupported {
      throw CaptureFinishError.refused
    } catch RPCError.server(_, let status, _) where (400..<500).contains(status) {
      throw CaptureFinishError.refused
    } catch RPCError.unauthorized {
      throw CaptureFinishError.signedOut
    }
  }

  func active(spaceID: String) async throws -> ActiveCapture? {
    try await app.call("meetingCaptures/active", input: NoInput(), spaceID: spaceID)
  }

  func meetingID(spaceID: String, since: Date) async -> String? {
    let page: MeetingsPage? = try? await app.call("meetings/list", input: NoInput(), spaceID: spaceID)
    return page?.items.first { $0.provider == "praci" && $0.startedAt >= since }?.id
  }

  func upload(_ record: CaptureRecord) async -> UploadOutcome {
    let current = app.authentication.endpoint.absoluteString
    guard record.apiBase == current, record.userId == app.userID else { return .retryLater }
    return await ChunkUploader(
      auth: app.authentication.client, transport: URLSessionHTTPTransport(),
      disk: CaptureDisk(root: CaptureDisk.standardRoot())
    ).upload(record)
  }

  func sessionLost() async { await app.endSession() }
}
