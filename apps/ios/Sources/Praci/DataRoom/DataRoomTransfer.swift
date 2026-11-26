import Foundation
import RakazoAPI
import RakazoCore

enum DataRoomTransferError: LocalizedError {
  case badResponse(Int, String?)
  case invalidResponse
  case scopeChanged

  var errorDescription: String? {
    switch self {
    case .badResponse(_, let message?): message
    case .badResponse(let status, nil): "The server answered \(status)."
    case .invalidResponse: "The server returned an invalid response."
    case .scopeChanged: "The session changed, so the upload was cancelled."
    }
  }
}

/// The account a transfer was started for. An upload is only sent while this still matches the
/// signed-in session, so a sign-out and a new sign-in can never reuse the old picks.
struct DataRoomScope: Equatable, Sendable {
  let origin: URL
  let userID: String?
  let spaceID: String?
  let generation: UInt64

  /// Nil when the account changed while the generation was being read.
  @MainActor
  static func capture(_ app: AppModel) async -> DataRoomScope? {
    let origin = app.authentication.endpoint
    let userID = app.userID
    let spaceID = app.spaceID
    let generation = await app.authentication.client.snapshot().generation
    guard origin == app.authentication.endpoint, userID == app.userID, spaceID == app.spaceID else {
      return nil
    }
    return DataRoomScope(origin: origin, userID: userID, spaceID: spaceID, generation: generation)
  }
}

/// Refuses every redirect, so the bearer token and an upload body never reach another host, and
/// reports upload progress. Immutable, so it is safe to share.
final class UploadProgress: NSObject, URLSessionTaskDelegate, Sendable {
  let report: @Sendable (Double) -> Void
  init(_ report: @escaping @Sendable (Double) -> Void = { _ in }) { self.report = report }

  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }

  func urlSession(
    _ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64, totalBytesExpectedToSend: Int64
  ) {
    guard totalBytesExpectedToSend > 0 else { return }
    report(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
  }
}

/// Streams a file to `/api/data-room/upload` and downloads stored bytes, both with the session's
/// credentials from `AuthClient`. A body is read from disk by the system, never held in memory.
@MainActor
struct DataRoomTransfer {
  let app: AppModel

  private static func session() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil
    configuration.httpCookieStorage = nil
    return URLSession(configuration: configuration)
  }

  /// Returns the parsed result for 200 (duplicate), 201 (new) and 202 (zip import).
  func upload(  // swiftlint:disable:this function_parameter_count
    file: URL, name: String, mimeType: String, folderID: String?, scope: DataRoomScope,
    progress: @escaping @Sendable (Double) -> Void
  ) async throws -> DataRoomUploadResult {
    guard await DataRoomScope.capture(app) == scope else { throw DataRoomTransferError.scopeChanged }
    var request = try await authorized(
      path: "/api/data-room/upload", method: "POST", contentType: mimeType,
      query: [URLQueryItem(name: "name", value: name)]
        + (folderID.map { [URLQueryItem(name: "folderId", value: $0)] } ?? []))
    guard request.generation == scope.generation else { throw DataRoomTransferError.scopeChanged }
    request.request.timeoutInterval = 120
    let session = Self.session()
    defer { session.finishTasksAndInvalidate() }
    let (data, response) = try await session.upload(
      for: request.request, fromFile: file, delegate: UploadProgress(progress))
    guard let http = response as? HTTPURLResponse else { throw DataRoomTransferError.invalidResponse }
    // A redirect is refused by the delegate, so a 3xx arrives here and falls into the default case.
    switch http.statusCode {
    case 200, 201, 202:
      return try JSONDecoder().decode(DataRoomUploadResult.self, from: data)
    default:
      throw await failure(http.statusCode, data, request)
    }
  }

  /// Saves the file's bytes under a temporary folder and returns the file URL for Quick Look.
  func download(_ item: DataRoomItem) async throws -> URL {
    let request = try await authorized(
      path: "/api/data-room/items/\(item.id)/content", method: "GET", contentType: nil, query: [])
    let session = Self.session()
    defer { session.finishTasksAndInvalidate() }
    let (temporary, response) = try await session.download(for: request.request, delegate: UploadProgress())
    guard let http = response as? HTTPURLResponse else { throw DataRoomTransferError.invalidResponse }
    guard http.statusCode == 200 else {
      throw await failure(http.statusCode, (try? Data(contentsOf: temporary)) ?? Data(), request)
    }
    let folder = try DataRoomFiles.newTemporaryFolder(prefix: "dataroom-download")
    let destination = folder.appendingPathComponent(DataRoomFiles.safeName(item.name))
    try FileManager.default.moveItem(at: temporary, to: destination)
    try? FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: destination.path)
    return destination
  }

  func thumbnail(for id: String) async throws -> Data {
    let url = app.authentication.endpoint.appending(path: "/api/data-room/items/\(id)/thumbnail")
    return try await app.data(url: url)
  }

  /// The bearer token is only ever sent to the configured server.
  static func sameOrigin(_ url: URL, _ server: URL) -> Bool {
    func port(_ url: URL) -> Int? { url.port ?? (url.scheme?.lowercased() == "https" ? 443 : 80) }
    return url.scheme?.lowercased() == server.scheme?.lowercased()
      && url.host()?.lowercased() == server.host()?.lowercased() && port(url) == port(server)
  }

  private struct Sent {
    var request: URLRequest
    let generation: UInt64
    let hadSpace: Bool
  }

  private func authorized(
    path: String, method: String, contentType: String?, query: [URLQueryItem]
  ) async throws -> Sent {
    let sent: AuthorizedRequest
    do {
      sent = try await app.authentication.client.authorized(
        path: path, method: method, body: nil, contentType: contentType, spaceID: app.spaceID)
    } catch AuthClientError.unauthorized {
      await endSession()
      throw RPCError.unauthorized
    }
    var components = URLComponents(url: sent.request.url, resolvingAgainstBaseURL: false)
    if !query.isEmpty { components?.queryItems = query }
    guard let url = components?.url, Self.sameOrigin(url, app.authentication.endpoint) else {
      throw DataRoomTransferError.invalidResponse
    }
    var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
    request.httpMethod = method
    for (name, value) in sent.request.headers { request.setValue(value, forHTTPHeaderField: name) }
    return Sent(request: request, generation: sent.generation, hadSpace: sent.hadSpace)
  }

  private func failure(_ status: Int, _ body: Data, _ sent: Sent) async -> any Error {
    if status == 401 {
      let error = await app.authentication.client.handleUnauthorized(
        generation: sent.generation, hadSpace: sent.hadSpace)
      if error == .unauthorized { await endSession() }
      if error == .spaceRejected { app.spaceID = nil }
      return error
    }
    struct Body: Decodable { let error: String? }
    return DataRoomTransferError.badResponse(
      status, (try? JSONDecoder().decode(Body.self, from: body))?.error)
  }

  private func endSession() async {
    app.reset()
    await app.authentication.sync()
  }
}
