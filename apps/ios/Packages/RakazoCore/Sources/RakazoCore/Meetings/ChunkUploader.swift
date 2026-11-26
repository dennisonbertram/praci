import Foundation

/// What one upload pass means for the controller.
public enum UploadOutcome: Sendable, Equatable {
  /// Every finished chunk was stored or dropped; nothing is left to upload.
  case done
  /// Offline, a server error or a rejected-but-retryable request. Files are kept; try again in 5 s.
  case retryLater
  /// The capture is gone or closed on the server; nothing more can be uploaded for it.
  case ended(EndReason)
  /// A 401. `.stale` came from an older session or a space rejection: keep the files and retry.
  /// `.ended` means the session itself was rejected.
  case unauthorized(Unauthorized)

  public enum EndReason: Sendable, Equatable {
    /// 404: no such capture (or discarded).
    case notFound
    /// 409 other than "Chunk already stored": the capture no longer takes audio.
    case closed
  }

  public enum Unauthorized: Sendable, Equatable { case stale, ended }
}

/// Uploads a capture's finished chunks in sequence order and sends finish. The rules match the
/// web's `classifyUpload` (`apps/web/src/lib/meeting-capture/buffer.ts`).
public struct ChunkUploader: Sendable {
  public typealias Authorize = @Sendable (
    _ path: String, _ method: String, _ body: Data?, _ contentType: String?, _ spaceID: String?
  ) async throws -> AuthorizedRequest
  public typealias HandleUnauthorized = @Sendable (AuthorizedRequest) async -> RPCError

  public static let retryDelay: TimeInterval = 5

  private let transport: any HTTPTransport
  private let disk: CaptureDisk
  private let authorize: Authorize
  private let handleUnauthorized: HandleUnauthorized

  public init(
    transport: any HTTPTransport, disk: CaptureDisk, authorize: @escaping Authorize,
    handleUnauthorized: @escaping HandleUnauthorized
  ) {
    self.transport = transport
    self.disk = disk
    self.authorize = authorize
    self.handleUnauthorized = handleUnauthorized
  }

  public init(auth: AuthClient, transport: any HTTPTransport, disk: CaptureDisk) {
    self.init(
      transport: transport, disk: disk,
      authorize: { path, method, body, contentType, spaceID in
        try await auth.authorized(
          path: path, method: method, body: body, contentType: contentType, spaceID: spaceID,
          timeout: 30)
      },
      handleUnauthorized: { sent in
        await auth.handleUnauthorized(generation: sent.generation, hadSpace: sent.hadSpace)
      })
  }

  /// One pass over the record's finished chunks. A stored chunk (201 or 200) is deleted; so is one
  /// the server refuses for good (400, 413, 409 "Chunk already stored"), and the record's
  /// `lostChunks` goes up on disk. Any retryable failure stops the pass with that chunk and every
  /// later one kept.
  public func upload(_ record: CaptureRecord) async -> UploadOutcome {
    var record = record
    for chunk in disk.chunks(record) {
      guard let bytes = try? Data(contentsOf: chunk.url) else {
        if !drop(chunk, &record) { return .retryLater }
        continue
      }
      let sent: AuthorizedRequest
      do {
        sent = try await authorized(record, chunk: chunk, bytes: bytes)
      } catch AuthClientError.unauthorized {
        return .unauthorized(.ended)
      } catch {
        return .retryLater
      }
      let response: HTTPResponse
      do {
        response = try await transport.send(sent.request, maximumResponseBytes: 64 * 1024)
      } catch {
        return .retryLater
      }
      switch response.statusCode {
      case 200..<300:
        disk.removeChunk(chunk)
      case 401:
        switch await handleUnauthorized(sent) {
        case .unauthorized: return .unauthorized(.ended)
        default: return .unauthorized(.stale)
        }
      case 404:
        return .ended(.notFound)
      case 409 where !Self.message(response).hasPrefix("Chunk already stored"):
        return .ended(.closed)
      case 400, 413, 409:
        if !drop(chunk, &record) { return .retryLater }
      default:
        return .retryLater
      }
    }
    return .done
  }

  /// The request for `meetingCaptures/finish`. Sends `lostChunks` only when it is above zero.
  public func finishRequest(_ record: CaptureRecord, endedAt: Date = Date()) async throws
    -> AuthorizedRequest
  {
    var payload: [String: Any] = [
      "captureId": record.captureId,
      "endedAt": endedAt.formatted(.iso8601.year().month().day().time(includingFractionalSeconds: true).timeZone(separator: .omitted)),
    ]
    if record.lostChunks > 0 { payload["lostChunks"] = record.lostChunks }
    let body = try JSONSerialization.data(withJSONObject: ["json": payload], options: [.sortedKeys])
    return try await authorize(
      "/rpc/meetingCaptures/finish", "POST", body, "application/json", record.spaceId)
  }

  private func authorized(_ record: CaptureRecord, chunk: StoredChunk, bytes: Data) async throws
    -> AuthorizedRequest
  {
    let base = try await authorize(
      "/api/meeting-captures/\(record.captureId)/chunks", "POST", bytes,
      "application/octet-stream", record.spaceId)
    var components = URLComponents(url: base.request.url, resolvingAgainstBaseURL: false)
    components?.queryItems = [
      URLQueryItem(name: "track", value: chunk.track),
      URLQueryItem(name: "seq", value: String(chunk.seq)),
      URLQueryItem(name: "startMs", value: String(chunk.startMs)),
      URLQueryItem(name: "endMs", value: String(chunk.endMs)),
    ]
    guard let url = components?.url else { throw AuthClientError.invalidEndpoint }
    let request = HTTPRequest(
      url: url, method: base.request.method, headers: base.request.headers,
      body: base.request.body, timeout: base.request.timeout)
    return AuthorizedRequest(request: request, generation: base.generation, hadSpace: base.hadSpace)
  }

  /// Counts a refused chunk in `record.json`, then deletes it. False when the count could not be
  /// saved, so the caller retries instead of losing it.
  private func drop(_ chunk: StoredChunk, _ record: inout CaptureRecord) -> Bool {
    record.lostChunks += 1
    guard (try? disk.save(record)) != nil else { return false }
    disk.removeChunk(chunk)
    return true
  }

  private static func message(_ response: HTTPResponse) -> String {
    let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any]
    return (object?["error"] as? String) ?? ""
  }
}
