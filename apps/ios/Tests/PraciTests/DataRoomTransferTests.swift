import Foundation
import RakazoCore
import Testing

@testable import Praci

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
  // Reason: tests touch it from one task at a time.
  var session: StoredSession?
  func load() throws -> StoredSession? { session }
  func save(_ session: StoredSession) throws { self.session = session }
  func clear() throws { session = nil }
}

private actor QuietTransport: HTTPTransport {
  private(set) var count = 0
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    count += 1
    return HTTPResponse(statusCode: 200, body: Data(#"{"user":{"id":"u1"}}"#.utf8))
  }
}

private let origin = URL(string: "http://127.0.0.1:3301")!

@MainActor
private func makeApp() async throws -> AppModel {
  let transport = QuietTransport()
  let storage = MemoryStorage()
  storage.session = StoredSession(endpoint: origin, token: "synthetic-token")
  let client = AuthClient(endpoint: origin, storage: storage, transport: transport)
  let authentication = AuthenticationModel(
    client: client, defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await client.restore()
  await authentication.sync()
  return AppModel(
    authentication: authentication, transport: transport,
    defaults: UserDefaults(suiteName: UUID().uuidString)!)
}

@Test("server file names lose separators and traversal", arguments: [
  ("../../etc/passwd", "passwd"), ("a/b.pdf", "b.pdf"), ("..\\x\\y.txt", "y.txt"),
  ("..", "file"), ("", "file"), ("a:b.txt", "ab.txt"), ("report.pdf", "report.pdf")
])
func safeName(input: String, expected: String) {
  #expect(DataRoomFiles.safeName(input) == expected)
}

@Test
@MainActor
func uploadsOnlyGoToTheConfiguredOrigin() {
  #expect(DataRoomTransfer.sameOrigin(URL(string: "http://127.0.0.1:3301/x")!, origin))
  #expect(!DataRoomTransfer.sameOrigin(URL(string: "http://evil.test:3301/x")!, origin))
  #expect(!DataRoomTransfer.sameOrigin(URL(string: "https://127.0.0.1:3301/x")!, origin))
  #expect(!DataRoomTransfer.sameOrigin(URL(string: "http://127.0.0.1:80/x")!, origin))
}

@Test
@MainActor
func redirectsAreRefused() {
  var followed: URLRequest? = URLRequest(url: origin)
  let response = HTTPURLResponse(url: origin, statusCode: 307, httpVersion: nil, headerFields: nil)!
  let task = URLSession.shared.dataTask(with: origin)
  UploadProgress().urlSession(
    .shared, task: task, willPerformHTTPRedirection: response,
    newRequest: URLRequest(url: URL(string: "http://evil.test/")!)
  ) { followed = $0 }
  #expect(followed == nil)
}

@Test
@MainActor
func uploadIsRejectedWhenTheSessionScopeChanged() async throws {
  let app = try await makeApp()
  app.spaceID = "space-1"
  let scope = try #require(await DataRoomScope.capture(app))
  app.spaceID = "space-2"
  let file = try DataRoomFiles.copyToTemporary(URL(fileURLWithPath: "/etc/hosts"))
  defer { DataRoomFiles.discard(file) }
  await #expect(throws: DataRoomTransferError.self) {
    _ = try await DataRoomTransfer(app: app).upload(
      file: file, name: "hosts", mimeType: "text/plain", folderID: nil, scope: scope,
      progress: { _ in })
  }
}

@Test
@MainActor
func cancellingUploadsDeletesTheirTemporaryFiles() async throws {
  let app = try await makeApp()
  let scope = try #require(await DataRoomScope.capture(app))
  let file = try DataRoomFiles.copyToTemporary(URL(fileURLWithPath: "/etc/hosts"))
  let model = DataRoomModel(folder: nil)
  model.uploads = [DataRoomModel.Upload(file: file, name: "hosts", scope: scope)]
  model.cancelAllUploads()
  #expect(model.uploads.isEmpty)
  #expect(!FileManager.default.fileExists(atPath: file.deletingLastPathComponent().path))
}
